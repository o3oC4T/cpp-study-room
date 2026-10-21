import { EditorView, basicSetup } from 'codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { problems, findProblem } from './problems.js';
import { escapeHTML as e, getLocal, setLocal, downloadSource, statusNames, modeNames, firstDifference } from './lib.js';
import { configured, judgeReady, supabase, api, login } from './api.js';
import {collections, findCollection} from './collections.js';
import {lessons, findLesson} from './lessons.js';
import {learningOverview, lessonHTML, bindLesson} from './learning.js';
import {usagePage} from './usage.js';
import '@tabler/core/dist/css/tabler.min.css';
import './style.css';

const icons = {
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-15-4 18"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  book: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m4-13h4m-4 4h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  down: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  github: '<path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1-.4-2-1-2 3-.3 6-1.4 6-6 0-1.2-.4-2.3-1.2-3 .2-1 .2-2-.3-3-1.4-.1-3 1-3.5 1a13 13 0 0 0-6 0c-.5 0-2.1-1.1-3.5-1-.5 1-.5 2-.3 3C4.4 7.7 4 8.8 4 10c0 4.6 3 5.7 6 6-.6.4-1 1.4-1 2v4"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.code}</svg>`;
const app = document.querySelector('#app');
let editor, activeProblem, session, member, history = [], currentResult, polling, routeVersion = 0, busy = false;
const storageKey = (id) => `cpp-room:draft:${session?.user.id || 'guest'}:${id}`;
const draft = (id) => getLocal(storageKey(id));
let solvedProblemIds = new Set();
const solved = (id) => solvedProblemIds.has(id) || history.some((s) => s.problem_id === id && s.mode === 'full' && s.status === 'accepted');

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4200);
}
function saveDraft() {
  if (!editor || !activeProblem) return;
  if (editor.state.doc.toString() === activeProblem.starter && !draft(activeProblem.id)) return;
  const ok = setLocal(storageKey(activeProblem.id), { code: editor.state.doc.toString(), updatedAt: Date.now() });
  const el = document.querySelector('#save-state');
  if (el) el.textContent = ok ? '이 브라우저에 저장됨' : '저장 공간 부족 · 파일로 저장하세요';
}
function cleanup() {
  saveDraft();
  editor?.destroy();
  editor = null;
  clearTimeout(polling);
  currentResult = null;
}
function shell(content, page = 'problems') {
  const user = member?.display_name || member?.username || (session ? '내 계정' : null);
  app.innerHTML = `<div class="page">
    <aside class="navbar navbar-vertical sidebar" aria-label="주 메뉴">
      <a class="brand" href="#/"><span class="brand-icon">${icon('code')}</span><span>코드연습실<small>C++ WORKSPACE</small></span></a>
      <div class="sidebar-label">WORKSPACE</div>
      <nav class="sidebar-nav"><a class="${page === 'problems' ? 'active' : ''}" href="#/" aria-label="문제 목록">${icon('code')} 문제 목록 <small>${problems.length}</small></a><a class="${page === 'learn' ? 'active' : ''}" href="#/learn" aria-label="개념 학습">${icon('book')} 개념 학습 <small>6</small></a><a class="${page === 'history' ? 'active' : ''}" href="#/history">${icon('clock')} 내 제출</a></nav>
      <div class="sidebar-label">PRACTICE SETS</div><nav class="set-nav">${collections.map(c=>`<a href="#/set/${c.id}" class="${location.hash===`#/set/${c.id}`?'active':''}"><span>${c.number}</span>${e(c.title)}</a>`).join('')}</nav>
      <div class="sidebar-bottom"><span class="environment"><span class="dot"></span>Windows · MSVC</span><p>배운 범위 안에서,<br>직접 쓰면서 이해하기.</p><a href="https://github.com/o3oC4T/cpp-study-room" target="_blank" rel="noreferrer">${icon('github')} 프로젝트</a></div>
    </aside>
    <div class="page-wrapper"><header class="header"><div class="header-path"><span>코드연습실</span><b>/</b>${page==='learn'?'개념 학습':page==='history'?'내 제출':page==='usage'?'사용 기록':'문제 풀이'}</div><div class="account"><span class="environment">C++ · PC 실습 환경</span><button class="button ${session?'light':'dark'} small" data-action="${session?'account':'login'}">${icon('code')}<span>${e(user || '로그인')}</span></button></div></header>
    ${content}<footer><span>코드연습실 · C++ 연습 워크스페이스</span><span>Tabler 기반 · Windows MSVC</span></footer></div>
    <dialog id="dialog"></dialog></div>`;
  if(member?.role==='owner')document.querySelector('.sidebar-nav').insertAdjacentHTML('beforeend',`<a class="${page==='usage'?'active':''}" href="#/usage">${icon('clock')} 사용 기록 <small>운영자</small></a>`);
}
function problemRows(list) {
 return list.map(p=>`<a class="problem-row" href="#/problem/${p.id}"><span class="problem-number">${p.number}</span><span class="problem-title"><strong>${e(p.title)}</strong><small>${e(p.topic)}</small></span><span class="problem-status ${solved(p.id)?'done':draft(p.id)?'draft':''}">${solved(p.id)?'통과 ✓':draft(p.id)?'작성 중':'시작 전'}</span><span class="row-arrow">${icon('arrow')}</span></a>`).join('');
}
function dashboard(collection) {
  activeProblem = null;
  const done=problems.filter(p=>solved(p.id)).length;
  const drafts=problems.map(p=>({p,d:draft(p.id)})).filter(x=>x.d).sort((a,b)=>b.d.updatedAt-a.d.updatedAt);
  const last=drafts[0];
  const visible=collection?[collection]:collections;
  shell(`<main class="page-content dashboard"><div class="page-heading"><div><div class="eyebrow">${collection?'PRACTICE SET '+collection.number:'YOUR CODING WORKSPACE'}</div><h1>${collection?e(collection.title):'문제 풀이 워크스페이스'}</h1><p>${collection?e(collection.subtitle):'네 가지 주제를 한 세트로. 배운 개념을 코드로 연결해 보세요.'}</p></div><a class="button dark" href="#/problem/${collection?problems.find(p=>p.collection===collection.id).id:last?.p.id||'midterm-1'}">${last&&!collection?'이어서 풀기':'문제 시작하기'} ${icon('arrow')}</a></div>
   ${!collection?`<div class="overview-grid"><div class="card stat-card"><span>연습 문제</span><strong>${problems.length}<small>문제</small></strong><p>9세트 × 4문제</p></div><div class="card stat-card progress-box"><span>전체 채점 통과</span><strong>${done}<small>/ ${problems.length}</small></strong><div class="progress-track"><div style="width:${done/problems.length*100}%"></div></div></div><div class="card stat-card"><span>작성 중인 코드</span><strong>${drafts.filter(x=>!solved(x.p.id)).length}<small>개</small></strong><p>이 브라우저에 자동 저장</p></div><a class="card study-entry" href="#/learn"><span class="pill">CONCEPT LAB</span><h2>포인터 · struct · 동적 할당</h2><p>메모리 그림으로 이해하고<br>코드 한 줄로 확인하기</p><strong>개념 학습 열기 →</strong></a></div>`:''}
   <div class="library-heading"><div><h2>${collection?'이번 세트의 4문제':'연습 세트'}</h2><p>${collection?'작성 조건, 입력 범위, 출력 예시를 먼저 확인하세요.':'기존 중간고사 대비 4문제 + 교재 기반 새 문제 32개'}</p></div><label class="search-field">${icon('search')}<input id="problem-search" type="search" placeholder="문제 이름 · 키워드 검색" aria-label="문제 검색"></label></div>
   <div id="collection-grid" class="collection-grid ${collection?'single':''}">${visible.map(c=>`<section class="card collection-card" data-collection="${c.id}"><div class="collection-card-heading"><span class="set-number">${c.number}</span><div><a href="#/set/${c.id}"><h3>${e(c.title)}</h3></a><p>${e(c.subtitle)}</p></div><span class="pill">${c.id==='midterm'?'교수님 과제':'연습 4문제'}</span></div><div class="problem-list">${problemRows(problems.filter(p=>p.collection===c.id))}</div><div class="collection-card-footer"><span>${e(c.topics)}</span><span>${problems.filter(p=>p.collection===c.id&&solved(p.id)).length}/4 통과</span></div></section>`).join('')}</div><p id="search-empty" class="large-empty" hidden>검색 결과가 없어요. 다른 키워드로 찾아보세요.</p>
   <div class="connection-note"><span class="dot ${configured?'':'muted'}"></span>${judgeReady?'발급받은 계정으로 로그인하면 채점과 제출 기록을 사용할 수 있어요.':configured?'발급받은 계정으로 로그인할 수 있어요. 온라인 채점은 준비 중이며, 문제 풀이와 코드 저장은 바로 사용할 수 있어요.':'문제 풀이 · 개념 학습 · 코드 저장은 바로 사용 가능해요. 로그인과 온라인 채점은 서버 연결 준비 중입니다.'}</div>
  </main>`);
  document.querySelector('#problem-search').oninput=ev=>{
    const query=ev.target.value.toLowerCase().trim();let count=0;
    document.querySelectorAll('[data-collection]').forEach(card=>{
      const list=problems.filter(p=>p.collection===card.dataset.collection && `${p.title} ${p.topic} ${p.tags.join(' ')}`.toLowerCase().includes(query));
      card.hidden=!list.length;card.querySelector('.problem-list').innerHTML=problemRows(list);count+=list.length;
    });document.querySelector('#search-empty').hidden=count>0;
  };
}
function problemPage(p) {
  activeProblem = p;
  const saved = draft(p.id);
  shell(`<main class="workspace">
    <div class="workspace-heading">
      <a class="back-link" href="#/set/${p.collection}">← ${e(findCollection(p.collection)?.title || '문제 목록')}</a>
      <div class="workspace-title"><span class="problem-number">${p.number}</span><h1>${e(p.title)}</h1><span class="pill">${e(p.topic)}</span></div>
      <div class="problem-nav">${problems.filter(q=>q.collection===p.collection).map((q) => `<a href="#/problem/${q.id}" class="${q.id === p.id ? 'selected' : ''}" aria-label="${e(q.title)}" ${q.id === p.id ? 'aria-current="page"' : ''}>${q.number}</a>`).join('')}</div>
    </div>
    <div class="workspace-grid">
      <article class="statement">
        <div class="panel-title">${icon('book')} 문제 설명<span>${e(findCollection(p.collection)?.title)} · ${Number(p.number)}번</span></div>
        <div class="statement-body">
          <div class="eyebrow">THE CHALLENGE</div><h2>${e(p.title)}</h2>
          ${p.description.map((s) => `<p>${e(s)}</p>`).join('')}
          ${p.note ? `<aside class="notice">${e(p.note)}</aside>` : ''}
          <h3>작성 조건</h3><ul class="requirements">${p.requirements.map((r) => `<li>${e(r)}</li>`).join('')}</ul>
          <h3>입력</h3><p>${e(p.input)}</p>
          <h3>입출력 예제</h3>
          <p class="small-note">출력에는 프로그램이 출력한 문자만 표시합니다. 입력한 값은 자동으로 되풀이되지 않아 입력 안내 문구가 붙어 보일 수 있어요.</p>
          ${p.samples.map((s, i) => `<section class="sample"><div class="sample-title">예제 ${i+1}</div><div class="sample-label">입력<button class="text-button" data-action="copy-input" data-index="${i}">복사</button></div><pre>${e(s.input)}</pre><div class="sample-label">기대 출력<button class="text-button" data-action="copy-output" data-index="${i}">복사</button></div><pre>${e(s.output)}</pre></section>`).join('')}
          <div class="source-note"><strong>기반 자료</strong><p>${e(p.source)}</p></div><h3>채점 안내</h3><p class="small-note">시간 제한 2초 · 메모리 제한 256MB · 출력 제한 64KB</p><p class="small-note">Windows MSVC에서 컴파일하고 입력별 출력을 비교합니다. 줄바꿈의 CRLF/LF 차이만 허용하며 공백·빈 줄·숫자 정밀도는 그대로 비교합니다. 출력 통과만으로 함수 사용, 메모리 해제, 학습 범위 준수가 모두 검증되지는 않으니 작성 조건도 직접 확인하세요.</p>
        </div>
      </article>
      <section class="coding">
        <div class="editor-panel">
          <div class="editor-toolbar"><span><span class="file-symbol">C++</span> main.cpp</span><div>
            <button class="icon-button" data-action="upload" title="C++ 파일 가져오기" aria-label="C++ 파일 가져오기">${icon('upload')}</button>
            <button class="icon-button" data-action="download" title="C++ 파일 저장" aria-label="C++ 파일 저장">${icon('down')}</button>
            <button class="icon-button" data-action="reset" title="기본 코드로 되돌리기" aria-label="기본 코드로 되돌리기">${icon('reset')}</button>
          </div></div>
          <div id="editor" aria-label="C++ 코드 편집기"></div>
          <div class="editor-bottom"><span id="save-state">${saved ? '이 브라우저에 저장됨' : '작성하면 자동 저장돼요'}</span><span>UTF-8 · C++</span></div>
        </div>
        <div class="run-bar"><div><span class="dot ${judgeReady ? '' : 'muted'}"></span>${judgeReady ? 'Windows · MSVC' : '온라인 채점 연결 준비 중'}</div><button class="button light" data-action="submit-sample" ${!judgeReady ? 'disabled' : ''}>${icon('play')} 예제 실행</button><button class="button light" data-action="counterexample" ${!judgeReady ? 'disabled' : ''}>${icon('search')} 반례 찾기</button><button class="button dark" data-action="submit" ${!judgeReady ? 'disabled' : ''}>제출하기 ${icon('arrow')}</button></div>
        <section class="result-panel" aria-live="polite"><div class="panel-title">${icon('code')} 실행 결과</div><div id="result"><div class="empty-result"><span class="empty-icon">${icon('code')}</span><strong>${judgeReady ? '작성한 코드를 확인해 볼까요?' : '코드부터 차근차근 작성해 보세요'}</strong><p>${judgeReady ? '예제를 실행하거나 제출하면 결과가 여기에 표시돼요.' : '지금은 .cpp 파일로 저장해 Visual Studio에서 실행할 수 있어요.<br>온라인 채점은 서버 연결 후 사용할 수 있어요.'}</p></div></div></section>
      </section>
    </div>
    <input type="file" accept=".cpp,.cc,.cxx,.txt" id="source-file" hidden />
  </main>`);
  editor = new EditorView({
    doc: saved?.code ?? p.starter,
    extensions: [
      basicSetup, cpp(),
      syntaxHighlighting(HighlightStyle.define([
        { tag: tags.keyword, color: '#c4a5ff' },
        { tag: [tags.typeName, tags.className], color: '#7dd3fc' },
        { tag: [tags.string, tags.special(tags.string)], color: '#a9d992' },
        { tag: tags.number, color: '#f7bf80' },
        { tag: tags.comment, color: '#77869f', fontStyle: 'italic' },
        { tag: [tags.meta, tags.processingInstruction], color: '#c4a5ff' },
        { tag: tags.function(tags.variableName), color: '#8bbfff' },
        { tag: tags.operator, color: '#b6c1d7' },
      ])),
      EditorView.contentAttributes.of({ 'aria-label': 'C++ 코드', spellcheck: 'false' }),
      EditorView.updateListener.of((update) => { if (update.docChanged) saveDraft(); }),
      EditorView.theme({
        '&': { background: '#101522', color: '#d7e0ef', fontSize: '13px', height: '100%' },
        '.cm-content': { fontFamily: '"Cascadia Code", Consolas, monospace', padding: '18px 0', caretColor: '#8daaff', minHeight: '420px' },
        '.cm-gutters': { background: '#101522', color: '#65728a', border: 'none', paddingRight: '10px' },
        '.cm-activeLineGutter': { background: '#202c46' },
        '.cm-activeLine': { background: '#202c4680' },
        '.cm-cursor': { borderLeftColor: '#8daaff' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { background: '#35456d !important' },
        '.cm-scroller': { overflow: 'auto', lineHeight: '1.8' },
        '.cm-tooltip': { background: '#fff', color: '#202c46' },
      }, { dark: true }),
    ],
    parent: document.querySelector('#editor'),
  });
  document.querySelector('#source-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 65536) return toast('64KB 이하의 C++ 파일을 선택해 주세요.');
    const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    showDialog('파일 가져오기', `<p>현재 코드를 <b>${e(file.name)}</b>의 내용으로 바꿀까요?</p><div class="dialog-actions"><button class="button light" data-close>취소</button><button class="button dark" id="confirm-upload">가져오기</button></div>`);
    document.querySelector('#confirm-upload').onclick = () => {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
      closeDialog(); toast('파일을 가져왔어요.');
    };
    event.target.value = '';
  });
}
function historyPage() {
  activeProblem = null;
  shell(`<main class="history-page"><div class="eyebrow">MY SUBMISSIONS</div><h1>내 제출 기록</h1><p class="page-intro">최근 제출 100개의 채점 결과를 확인하세요. 통과 현황은 전체 제출에서 집계합니다.</p>
    ${!session ? `<div class="large-empty">${icon('clock')}<h2>로그인하면 기록이 쌓여요</h2><p>${configured ? '발급받은 아이디와 비밀번호로 로그인해 주세요.' : '로그인과 온라인 채점 연결을 준비 중이에요.<br>작성 중인 코드는 이 브라우저에 자동 저장됩니다.'}</p><button class="button dark" data-action="login">${icon('code')} 로그인</button></div>` : !history.length ? `<div class="large-empty">${icon('code')}<h2>아직 제출한 코드가 없어요</h2><p>첫 문제를 풀고 나만의 기록을 시작해 보세요.</p><a class="button dark" href="#/">문제 보러 가기 ${icon('arrow')}</a></div>` : `<div class="submission-list">${history.map((s) => `<button class="submission" data-action="show-result" data-id="${e(s.id)}"><span class="status-badge ${e(s.status)}">${e(statusNames[s.status] || s.status)}</span><span><strong>${e(findProblem(s.problem_id)?.title || s.problem_id)}</strong><small>${e(modeNames[s.mode] || s.mode)} · ${e(new Date(s.created_at).toLocaleString('ko-KR'))}</small></span>${icon('arrow')}</button>`).join('')}</div>`}
  </main>`, 'history');
}
function showDialog(title, body) {
  const dialog = document.querySelector('#dialog');
  dialog.innerHTML = `<div class="dialog-heading"><h2>${e(title)}</h2><button class="icon-button" data-close aria-label="닫기">${icon('close')}</button></div>${body}`;
  dialog.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeDialog);
  dialog.onclose=()=>{if(!dialog.open)dialog.replaceChildren();};
  dialog.showModal();
}
function closeDialog() { const dialog=document.querySelector('#dialog'); dialog.close(); dialog.replaceChildren(); }
function showLogin() {
 showDialog('로그인', `<p>운영자에게 받은 아이디와 비밀번호를 입력하세요.</p><form id="login-form" class="login-form"><label>아이디<input name="username" autocomplete="username" required maxlength="24" placeholder="발급받은 아이디"></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label><p id="login-error" class="form-error" role="status">${configured?'':'인증 서버 연결을 준비 중입니다. 연결 후 발급 계정으로 이용할 수 있어요.'}</p><button class="button dark" ${configured?'':'disabled'}>로그인</button></form><p class="login-note">회원가입은 제공하지 않습니다. 계정 발급이나 비밀번호 재설정은 운영자에게 요청하세요. 로그인·제출 기록은 운영자가 확인할 수 있습니다.</p>`);
 document.querySelector('#login-form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget;const button=form.querySelector('button');button.disabled=true;const data=new FormData(form);try{await login(data.get('username'),data.get('password'));form.reset();closeDialog();}catch(error){document.querySelector('#login-error').textContent=error.message;}finally{button.disabled=false;}};
}
function showAccount() {
 showDialog('내 계정', `<p>${e(member?.display_name || member?.username || '내 계정')}으로 로그인했어요.</p>${member?.must_change_password?'<p class="notice">처음 발급된 비밀번호를 변경한 뒤 제출할 수 있어요.</p>':''}<form id="password-form"><h3>비밀번호 변경</h3><label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" required maxlength="200"></label><label>새 비밀번호<input name="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="72"></label><label>새 비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="72"></label><p class="small-note">12자 이상으로 입력하세요. 변경하면 모든 기기에서 다시 로그인해야 합니다.</p><button class="button light">비밀번호 변경</button><p id="password-result" role="status"></p></form>${member?.role==='owner'?'<hr><h3>친구 계정 발급</h3><form id="create-account-form"><label>새 아이디<input name="username" required pattern="[a-z][a-z0-9_]{2,23}" minlength="3" maxlength="24" autocomplete="off" placeholder="friend01"></label><label>표시 이름<input name="displayName" required maxlength="30" autocomplete="off"></label><button class="button light">계정 발급</button><p id="create-account-result" role="status"></p></form>':''}<div class="dialog-actions"><button class="button light" id="logout">로그아웃</button><button class="button dark" data-close>닫기</button></div>`);
 document.querySelector('#logout').onclick=async()=>{saveDraft();await supabase.auth.signOut();closeDialog();};
 document.querySelector('#password-form').onsubmit=async ev=>{ev.preventDefault();const form=ev.currentTarget;const data=new FormData(form);const output=document.querySelector('#password-result');if(data.get('newPassword')!==data.get('confirmPassword')){output.textContent='새 비밀번호가 서로 달라요.';return;}const button=form.querySelector('button');button.disabled=true;try{await api('change_password',{currentPassword:data.get('currentPassword'),newPassword:data.get('newPassword')});form.reset();await supabase.auth.signOut({scope:'local'});closeDialog();toast('비밀번호를 변경했어요. 새 비밀번호로 다시 로그인해 주세요.');}catch(error){output.textContent=error.message;}finally{button.disabled=false;}};
 const create=document.querySelector('#create-account-form');
 if(create)create.onsubmit=async ev=>{ev.preventDefault();const data=new FormData(create);const button=create.querySelector('button');button.disabled=true;const output=document.querySelector('#create-account-result');try{const result=await api('create_account',{username:data.get('username'),displayName:data.get('displayName')});create.reset();output.innerHTML=`<span>이 창을 닫으면 초기 비밀번호를 다시 볼 수 없어요. 친구에게 직접 전달하세요.</span><pre class="credentials">아이디: ${e(result.username)}\n초기 비밀번호: ${e(result.password)}</pre>`;}catch(error){output.textContent=error.message;}finally{button.disabled=false;}};
}
function renderResult(result) {
  const error = ['compile_error','system_error'].includes(result.status);
  const tests = result.result?.tests || [];
  const pending = ['queued','preparing','running'].includes(result.status);
  const details = tests.map((t,i) => {
    const visible = t.sample || t.counterexample;
    const diff = t.expected !== undefined && t.actual !== undefined ? firstDifference(t.expected,t.actual) : null;
    const input = t.counterexample ? `<div class="counter-input"><div class="sample-label">틀리는 입력<button class="text-button" data-action="copy-counter">입력 복사</button></div><pre>${e(t.input)}</pre></div>` : '';
    const output = visible && t.actual !== undefined ? `<div class="diff-grid"><div><b>정답 출력</b><pre>${e(t.expected ?? '')}</pre></div><div><b>내 출력</b><pre>${e(t.actual)}</pre></div></div>
      ${t.truncated ? '<p class="small-note">출력이 길어 앞의 4,096자만 표시합니다.</p>' : ''}
      ${diff ? `<p class="small-note">${diff.line}행 ${diff.column}열에서 처음 달라요. 공백과 빈 줄도 확인해 보세요.</p>` : ''}` : '<p class="small-note">비공개 테스트의 입력과 출력은 표시하지 않습니다.</p>';
    return `<details class="test-result" ${t.status !== 'accepted' ? 'open' : ''}><summary><span>${t.counterexample ? '찾은 반례' : `${t.sample ? '예제' : '테스트'} ${i+1}`}</span><span class="${t.status === 'accepted' ? 'success-text' : 'error-text'}">${e(statusNames[t.status] || t.status)}</span></summary>${input}${output}</details>`;
  }).join('');
  return `<div class="result-content"><div class="result-heading"><span class="status-badge ${e(result.status)}">${e(statusNames[result.status] || result.status)}</span><span>${e(modeNames[result.mode] || result.mode)}</span></div>
    ${pending ? '<p class="small-note"><span class="spinner"></span> Windows 채점 환경을 준비하고 있어요. 시작까지 몇 분 걸릴 수 있습니다.</p>' : ''}
    ${error ? `<pre class="compiler-output">${e(result.result?.message || '채점 결과를 불러올 수 없습니다.')}</pre>` : ''}
    ${result.mode === 'counterexample' && !pending && !error ? `<p class="small-note">${Number(result.result?.tested || 0)}개 입력을 검사했어요.</p>` : ''}
    ${details}
    ${result.status === 'no_counterexample' ? '<p class="notice">검사한 경계값과 무작위 입력에서는 반례를 찾지 못했어요. 모든 입력에서 정답임을 보장하는 결과는 아닙니다.</p>' : ''}
    ${result.status === 'accepted' && result.mode === 'full' ? '<p class="success-note">출력 테스트를 모두 통과했어요. 문제의 작성 조건도 한 번 더 확인해 주세요.</p>' : ''}
  </div>`;
}
async function submit(mode) {
  if (busy) return;
  if (!session) { toast('제출하려면 로그인이 필요해요.'); return; }
  if (!editor.state.doc.toString().trim()) return toast('코드를 먼저 작성해 주세요.');
  busy = true;
  const version = routeVersion;
  try {
    const result = await api('submit', { problemId: activeProblem.id, mode, code: editor.state.doc.toString(), requestId: crypto.randomUUID() });
    history = [result, ...history.filter((s) => s.id !== result.id)];
    if (version === routeVersion) {
      currentResult = result;
      document.querySelector('#result').innerHTML = renderResult(result);
      if (['queued','preparing','running'].includes(result.status)) pollResult(result.id, version);
    }
  } catch (error) { toast(error.message); }
  finally { busy = false; }
}
async function pollResult(id, version) {
  if (version !== routeVersion) return;
  polling = setTimeout(async () => {
    if (version !== routeVersion) return;
    try {
      const result = await api('result', { id });
      history = [result, ...history.filter((s) => s.id !== id)];
      if (version !== routeVersion) return;
      currentResult = result;
      const target = document.querySelector('#result');
      if (target) target.innerHTML = renderResult(result);
      if (['queued','preparing','running'].includes(result.status)) pollResult(id, version);
    } catch (error) { toast(error.message); }
  }, 6000);
}
async function refreshAccount() {
  member = null; history = []; solvedProblemIds = new Set();
  if (!session) return;
  const userId = session.user.id;
  try {
    const data = await api('profile');
    if (session?.user.id !== userId) return;
    member = data.member;
    history = data.submissions;
    solvedProblemIds = new Set(data.solved || []);
  } catch (error) { toast(error.message); }
}
function route() {
  cleanup();
  routeVersion++;
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'problem') {
    const p = findProblem(parts[1]);
    if (p) problemPage(p);
    else { location.hash = '#/'; toast('문제를 찾지 못했어요.'); }
  } else if (parts[0] === 'history') historyPage();
  else if (parts[0] === 'usage') {activeProblem=null;const version=routeVersion;usagePage({member,shell,api,isCurrent:()=>version===routeVersion});}
  else if (parts[0] === 'set' && findCollection(parts[1])) dashboard(findCollection(parts[1]));
  else if (parts[0] === 'learn') {
    activeProblem=null;const lesson=findLesson(parts[1]);
    shell(lesson?lessonHTML(lesson,session?.user.id):learningOverview(session?.user.id),'learn');
    if(lesson)bindLesson(lesson,session?.user.id,toast);
  } else dashboard();
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'login') showLogin();
    if (action === 'account') showAccount();
    if (action === 'upload') document.querySelector('#source-file').click();
    if (action === 'download') {
      const profile = getLocal('cpp-room:filename', { student: '', name: '' });
      showDialog('C++ 파일로 저장', `<p>Visual Studio에서 열 수 있도록 UTF-8 BOM과 Windows 줄바꿈으로 저장해요.</p><form id="download-form"><div class="input-row"><label>학번<input name="student" value="${e(profile.student)}" placeholder="학번" pattern="[0-9]{4,20}" required></label><label>이름<input name="name" value="${e(profile.name)}" placeholder="이름" maxlength="30" required></label></div><p class="small-note">파일명: 학번_이름_${Number(activeProblem.number)}.cpp<br>저장 폴더: ${e(findCollection(activeProblem.collection)?.title)}<br>다른 세트의 같은 번호 파일과 겹치지 않게 세트별 폴더에 저장하세요.</p><div class="dialog-actions"><button type="button" class="button light" data-close>취소</button><button class="button dark">${icon('down')} 파일 저장</button></div></form>`);
      document.querySelector('#download-form').onsubmit = (ev) => {
        ev.preventDefault();
        const data = new FormData(ev.target), student = data.get('student'), name = data.get('name').trim();
        if (!name || /[\\/:*?"<>|.\x00-\x1f]/.test(name)) return toast('파일 이름에 사용할 수 있는 이름을 입력해 주세요.');
        setLocal('cpp-room:filename', { student, name });
        downloadSource(editor.state.doc.toString(), `${student}_${name}_${Number(activeProblem.number)}.cpp`);
        closeDialog(); toast('C++ 파일을 저장했어요.');
      };
    }
    if (action === 'reset') {
      showDialog('기본 코드로 되돌리기', '<p>지금 작성한 내용이 기본 코드로 바뀝니다. 필요한 코드는 먼저 파일로 저장해 주세요.</p><div class="dialog-actions"><button class="button light" data-close>취소</button><button class="button dark" id="confirm-reset">되돌리기</button></div>');
      document.querySelector('#confirm-reset').onclick = () => { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: activeProblem.starter } }); closeDialog(); };
    }
    if (action === 'copy-input' || action === 'copy-output') {
      await navigator.clipboard.writeText(activeProblem.samples[Number(button.dataset.index)][action === 'copy-input' ? 'input' : 'output']);
      toast('복사했어요.');
    }
    if (action === 'copy-counter') { await navigator.clipboard.writeText(currentResult.result.tests[0].input); toast('반례 입력을 복사했어요.'); }
    if (action === 'counterexample') await submit('counterexample');
    if (action === 'submit') await submit('full');
    if (action === 'submit-sample') await submit('sample');
    if (action === 'show-result') {
      const record = await api('result', { id: button.dataset.id });
      currentResult = record;
      showDialog(findProblem(record.problem_id)?.title || '제출 결과', renderResult(record));
    }
  } catch (error) { toast(error.message); }
});
window.addEventListener('hashchange', route);
window.addEventListener('pagehide', saveDraft);
route();
if (supabase) {
  supabase.auth.onAuthStateChange((event, next) => {
    if (event === 'TOKEN_REFRESHED') { session = next; return; }
    saveDraft(); editor?.destroy(); editor = null;
    session = next;
    setTimeout(async () => { await refreshAccount(); route(); }, 0);
  });
}
