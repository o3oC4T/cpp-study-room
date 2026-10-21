import {test, expect} from '@playwright/test';

async function connectJudge(page, initialPending = false) {
  await page.clock.install();
  await page.route('**/src/api.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `
      export const configured=true, judgeReady=true;
      let notify, user='poll-user';
      const pending={id:'89d9d0fc-bdc8-4d0e-9bd3-e87f47828549',problem_id:'midterm-2',mode:'full',status:'queued',created_at:new Date().toISOString(),result:null};
      if (${initialPending} && !localStorage.getItem('poll-fixture')) localStorage.setItem('poll-fixture',JSON.stringify(pending));
      const read=()=>JSON.parse(localStorage.getItem('poll-fixture')||'null');
      const save=record=>{localStorage.setItem('poll-fixture',JSON.stringify(record));return record;};
      window.resultRequests=0;window.submitRequests=0;
      window.emitAuth=(event,id='poll-user')=>{user=id;notify(event,id?{user:{id}}:null);};
      export const supabase={auth:{onAuthStateChange(callback){notify=callback;setTimeout(()=>window.emitAuth('INITIAL_SESSION'),0);},async signOut(){window.emitAuth('SIGNED_OUT',null);}}};
      export async function login(){}
      export async function api(action,data){
        if(action==='profile')return {member:{username:user,display_name:user,role:'student',must_change_password:false},submissions:user==='poll-user'&&read()?[read()]:[],solved:[]};
        if(action==='submit'){
          window.submitRequests++;
          if(window.delaySubmit)await new Promise(resolve=>window.releaseSubmit=resolve);
          return save({...pending,mode:data.mode});
        }
        if(action==='result'){
          window.resultRequests++;
          if(window.failNext){window.failNext=false;throw Error('Temporary network failure');}
          if(window.delayResult)await new Promise(resolve=>window.releaseResult=resolve);
          const record=read();
          return save(window.completeJudge?{...record,status:'accepted',result:{tests:[{status:'accepted',sample:true,expected:'ok',actual:'ok'}]}}:{...record,status:'running'});
        }
      }
    `,
  }));
  await page.goto('/#/problem/midterm-2');
  await expect(page.getByRole('button',{name:'poll-user',exact:true})).toBeVisible();
}

test('same-user sign-in keeps the editor and polling; transient failure retries to completion',async({page})=>{
  await connectJudge(page);
  const editor=page.locator('.cm-content');
  await editor.fill('int main() { return 0; }');
  await editor.evaluate(el=>el.dataset.retained='yes');
  await page.getByRole('button',{name:'제출하기',exact:true}).click();
  await expect(page.locator('#result')).toContainText('대기 중');
  await page.evaluate(()=>{window.failNext=true;window.emitAuth('SIGNED_IN');});
  await expect(editor).toHaveAttribute('data-retained','yes');
  await expect(editor).toContainText('return 0;');
  await expect(page.locator('#result')).toContainText('자동으로 다시 확인');
  await page.evaluate(()=>window.completeJudge=true);
  await page.clock.fastForward(13000);
  await expect(page.locator('#result')).toContainText('맞았습니다');
  await expect(page.getByRole('button',{name:'제출하기',exact:true})).toBeEnabled();
  const calls=await page.evaluate(()=>window.resultRequests);
  await page.clock.fastForward(60000);
  expect(await page.evaluate(()=>window.resultRequests)).toBe(calls);
  expect(await page.evaluate(()=>window.submitRequests)).toBe(1);
});

test('pending result resumes after reload and continues in the history dialog',async({page})=>{
  await connectJudge(page,true);
  await expect(page.locator('#result')).toContainText('채점 중');
  await page.locator('.cm-content').fill('int main() { return 7; }');
  await page.reload();
  await expect(page.getByRole('button',{name:'poll-user',exact:true})).toBeVisible();
  await expect(page.locator('#result')).toContainText('채점 중');
  await expect(page.locator('.cm-content')).toContainText('return 7;');
  await page.getByRole('link',{name:'내 제출',exact:true}).click();
  await page.locator('.submission').click();
  await expect(page.locator('#dialog-result')).toContainText('채점 중');
  await page.evaluate(()=>window.completeJudge=true);
  await page.clock.fastForward(7000);
  await expect(page.locator('#dialog-result')).toContainText('맞았습니다');
  await expect(page.locator('.submission')).toContainText('맞았습니다');
  expect(await page.evaluate(()=>window.submitRequests)).toBe(0);
});

test('late polling response cannot restore another account after logout',async({page})=>{
  await connectJudge(page,true);
  await expect(page.locator('#result')).toContainText('채점 중');
  await page.evaluate(()=>window.delayResult=true);
  await page.clock.fastForward(7000);
  await expect.poll(()=>page.evaluate(()=>typeof window.releaseResult)).toBe('function');
  await page.evaluate(()=>window.emitAuth('SIGNED_OUT',null));
  await expect(page.getByRole('button',{name:'로그인',exact:true})).toBeVisible();
  await page.evaluate(()=>{window.completeJudge=true;window.releaseResult();});
  await page.clock.fastForward(1000);
  await expect(page.locator('#result')).not.toContainText('맞았습니다');
  await page.getByRole('link',{name:'내 제출',exact:true}).click();
  await expect(page.getByRole('heading',{name:'로그인하면 기록이 쌓여요'})).toBeVisible();
  await expect(page.locator('.submission')).toHaveCount(0);
});

test('submission shows immediate progress and survives navigation during reception',async({page})=>{
  await connectJudge(page);
  await page.evaluate(()=>window.delaySubmit=true);
  await page.getByRole('button',{name:'제출하기',exact:true}).click();
  await expect(page.locator('#result')).toContainText('접수 중');
  await expect(page.getByRole('button',{name:'제출하기',exact:true})).toBeDisabled();
  await page.getByRole('link',{name:'내 제출',exact:true}).click();
  await page.goto('/#/problem/midterm-2');
  await page.evaluate(()=>window.releaseSubmit());
  await expect(page.locator('#result')).toContainText('대기 중');
  await page.evaluate(()=>window.completeJudge=true);
  await page.clock.fastForward(7000);
  await expect(page.locator('#result')).toContainText('맞았습니다');
  expect(await page.evaluate(()=>window.submitRequests)).toBe(1);
});
