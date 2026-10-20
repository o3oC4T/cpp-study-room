import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('PC navigation and all four statements render without browser errors', async ({page}) => {
  const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'오늘도, 한 문제씩.'})).toBeVisible();
  await expect(page.locator('.problem-row')).toHaveCount(4);
  for(let i=1;i<=4;i++){
    await page.goto(`/#/problem/midterm-${i}`);
    await expect(page.locator('.cm-editor')).toBeVisible();
    await expect(page.getByRole('heading',{name:'작성 조건'})).toBeVisible();
    await expect(page.getByRole('button',{name:'제출하기'})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await page.getByRole('link',{name:'내 제출',exact:true}).click();
  await expect(page.getByRole('heading',{name:'로그인하면 기록이 쌓여요'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('draft survives navigation and reload; reset requires an explicit click', async ({page}) => {
  await page.goto('/#/problem/midterm-1');
  const content=page.locator('.cm-content');
  await content.fill('int main() { return 42; }\n');
  await expect(page.locator('#save-state')).toContainText('저장됨');
  await page.getByRole('link',{name:'문제 목록',exact:true}).first().click();
  await expect(page.locator('.problem-row').first()).toContainText('작성 중');
  await page.reload();
  await page.getByRole('link',{name:/이어서 풀기/}).click();
  await expect(content).toContainText('return 42;');
  await page.getByRole('button',{name:'기본 코드로 되돌리기',exact:true}).click();
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await expect(content).toContainText('return 42;');
  await page.getByRole('button',{name:'기본 코드로 되돌리기',exact:true}).click();
  await page.getByRole('button',{name:'되돌리기',exact:true}).click();
  await expect(content).toContainText('#include');
});
test('source upload and Windows .cpp download preserve Korean, BOM and CRLF', async ({page}) => {
  await page.goto('/#/problem/midterm-4');
  const source='#include <iostream>\r\nint main(){std::cout << "안녕";}\r\n';
  await page.locator('#source-file').setInputFiles({name:'sample.cpp',mimeType:'text/plain',buffer:Buffer.from('\uFEFF'+source)});
  await page.getByRole('button',{name:'가져오기',exact:true}).click();
  await expect(page.locator('.cm-content')).toContainText('안녕');
  await page.getByRole('button',{name:'C++ 파일 저장',exact:true}).click();
  await page.getByRole('textbox',{name:'학번',exact:true}).fill('2026000000');
  await page.getByRole('textbox',{name:'이름',exact:true}).fill('테스트');
  const event=page.waitForEvent('download');
  await page.getByRole('button',{name:'파일 저장',exact:true}).click();
  const download=await event;
  expect(download.suggestedFilename()).toBe('2026000000_테스트_4.cpp');
  const bytes=await fs.readFile(await download.path());
  expect([...bytes.subarray(0,3)]).toEqual([239,187,191]);
  expect(bytes.toString('utf8')).toBe('\uFEFF'+source);
});
test('unconnected login explains the limitation without pretending to authenticate',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'GitHub 로그인',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('연결을 준비');
  await expect(page.locator('.progress-box')).toContainText('0');
});

async function mockConnectedApi(page, result) {
  // A test-only module replacement: no production fixture or fake judge is shipped.
  await page.route('**/src/api.js', route => route.fulfill({
    contentType:'application/javascript',
    body:`export const configured=true;
      export const supabase={auth:{onAuthStateChange(callback){setTimeout(()=>callback('SIGNED_IN',{user:{id:'test-user'}}),0)},async signOut(){}}};
      export async function login(){}
      export async function api(action){if(action==='profile')return {member:{github_login:'test-student',role:'student'},submissions:[]};return ${JSON.stringify(result)};}`,
  }));
}
test('counterexample feedback shows reproducible input, expected output and actual output',async({page})=>{
  await mockConnectedApi(page,{
    id:'test-result',problem_id:'midterm-4',mode:'counterexample',status:'counterexample_found',
    created_at:new Date().toISOString(),
    result:{tested:2,tests:[{status:'wrong_answer',sample:false,counterexample:true,input:'0\n2\nN\n',expected:'입력 오류\n',actual:'16000원\n'}]},
  });
  await page.goto('/#/problem/midterm-4');
  await expect(page.getByRole('button',{name:'test-student'})).toBeVisible();
  await page.getByRole('button',{name:'반례 찾기',exact:true}).click();
  await expect(page.locator('#result')).toContainText('반례 발견');
  await expect(page.locator('#result')).toContainText('틀리는 입력');
  await expect(page.locator('#result')).toContainText('16000원');
  await expect(page.locator('#result')).toContainText('2개 입력을 검사');
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.getByRole('button',{name:'입력 복사',exact:true}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('0\n2\nN\n');
  await page.getByRole('link',{name:'문제 목록',exact:true}).first().click();
  await expect(page.locator('.progress-box')).toContainText('0');
});
test('no counterexample is distinct from accepted, and compiler diagnostics are escaped',async({page})=>{
  const record={id:'test-result',problem_id:'midterm-1',mode:'counterexample',status:'no_counterexample',created_at:new Date().toISOString(),result:{tested:25,tests:[]}};
  await mockConnectedApi(page,record);
  await page.goto('/#/problem/midterm-1');
  await expect(page.getByRole('button',{name:'test-student'})).toBeVisible();
  await page.getByRole('button',{name:'반례 찾기',exact:true}).click();
  await expect(page.locator('#result')).toContainText('정답임을 보장하는 결과는 아닙니다');
  await page.unroute('**/src/api.js');
  await mockConnectedApi(page,{...record,mode:'full',status:'compile_error',result:{message:'error C2143: <img src=x onerror=alert(1)>'}});
  await page.reload();
  await expect(page.getByRole('button',{name:'test-student'})).toBeVisible();
  await page.getByRole('button',{name:'제출하기',exact:true}).click();
  await expect(page.locator('#result')).toContainText('컴파일 에러');
  await expect(page.locator('#result')).toContainText('error C2143: <img');
  await expect(page.locator('#result img')).toHaveCount(0);
});
