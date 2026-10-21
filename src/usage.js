import {escapeHTML as e,statusNames,modeNames} from './lib.js';
import {findProblem} from './problems.js';

const eventNames={login:'로그인',account_created:'계정 발급',password_changed:'비밀번호 변경',submission_created:'채점 제출',submission_finished:'채점 완료'};
export function usagePage({member,shell,api,isCurrent}) {
  if(member?.role!=='owner'||member.must_change_password){
    shell(`<main class="history-page"><h1>사용 기록</h1><div class="large-empty"><h2>운영자 전용 화면</h2><p>${member?.role==='owner'?'내 계정에서 초기 비밀번호를 변경한 뒤 확인해 주세요.':'운영자 계정으로 로그인해야 전체 사용 기록을 볼 수 있어요.'}</p></div></main>`,'usage');
    return;
  }
  shell(`<main class="history-page"><div class="page-heading"><div><div class="eyebrow">OWNER ONLY</div><h1>사용 기록</h1><p>회원의 로그인, 계정 변경, 채점 제출과 결과를 확인하세요. 시간은 한국 기준입니다.</p></div></div>
    <form id="usage-filter" class="usage-filter"><label>회원 아이디<input name="username" placeholder="전체 회원 · 아이디 입력" maxlength="24" autocomplete="off"></label><label>기록 종류<select name="event"><option value="">전체 기록</option>${Object.entries(eventNames).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><button class="button light">조회 · 새로고침</button></form>
    <p id="usage-message" role="status" class="small-note"></p>
    <div class="card usage-table-wrap"><table class="usage-table"><thead><tr><th>시간</th><th>회원</th><th>활동</th><th>문제 · 채점 방식</th><th>결과</th></tr></thead><tbody id="usage-rows"></tbody></table></div>
    <button id="usage-more" class="button light" hidden>이전 기록 더 보기</button>
    <p class="small-note usage-note">로그인은 인증 성공 시 기록됩니다. 현재 비밀번호를 확인하는 과정에서도 로그인 기록이 남을 수 있어요. 기록은 이 기능을 켠 시점부터 남습니다.</p>
  </main>`,'usage');
  let nextBefore=null,filter={},requestVersion=0;
  const form=document.querySelector('#usage-filter'),rows=document.querySelector('#usage-rows'),message=document.querySelector('#usage-message'),more=document.querySelector('#usage-more');
  async function load(reset){
    const version=++requestVersion;
    form.querySelector('button').disabled=true;more.disabled=true;
    if(reset){nextBefore=null;rows.replaceChildren();more.hidden=true;}
    message.textContent='기록을 불러오는 중이에요.';
    try{
      const result=await api('usage_history',{...filter,before:nextBefore});
      if(!isCurrent()||version!==requestVersion)return;
      const html=result.events.map(record=>{
        const title=record.problem_id?findProblem(record.problem_id)?.title||record.problem_id:'—';
        return `<tr><td><time datetime="${e(record.created_at)}">${e(new Date(record.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}))}</time></td><td>${e(record.username)}</td><td>${e(eventNames[record.event_type]||record.event_type)}</td><td>${e(title)}${record.mode?`<small>${e(modeNames[record.mode]||record.mode)}</small>`:''}</td><td>${record.status?`<span class="status-badge ${e(record.status)}">${e(statusNames[record.status]||record.status)}</span>`:'—'}</td></tr>`;
      }).join('');
      rows.insertAdjacentHTML('beforeend',html);
      nextBefore=result.nextBefore;more.hidden=nextBefore===null;
      message.textContent=rows.children.length?`${rows.children.length}개 기록 · 최근 기록부터 표시`:'조건에 맞는 기록이 없어요.';
    }catch(error){if(isCurrent()&&version===requestVersion)message.textContent=error.message;}
    finally{if(isCurrent()&&version===requestVersion){form.querySelector('button').disabled=false;more.disabled=false;}}
  }
  form.onsubmit=event=>{event.preventDefault();const data=new FormData(form);filter={username:String(data.get('username')).trim().toLowerCase(),event:data.get('event')};load(true);};
  more.onclick=()=>load(false);
  load(true);
}
