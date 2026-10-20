import { EditorView, basicSetup } from 'codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { problems, findProblem } from './problems.js';
import { escapeHTML as e, getLocal, setLocal, downloadSource, statusNames, modeNames, firstDifference } from './lib.js';
import { configured, supabase, api, login } from './api.js';
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
const solved = (id) => history.some((s) => s.problem_id === id && s.mode === 'full' && s.status === 'accepted');

function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 4200);
}
function saveDraft() {
  if (!editor || !activeProblem) return;
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
  const user = member?.github_login || (session ? '내 계정' : null);
  app.innerHTML = `
    <header class="header">
      <a class="brand" href="#/"><span class="brand-icon">${icon('code')}</span><span>코드연습실<small>C++ STUDY ROOM</small></span></a>
      <nav aria-label="주 메뉴">
        <a class="${page === 'problems' ? 'active' : ''}" href="#/">문제 목록</a>
        <a class="${page === 'history' ? 'active' : ''}" href="#/history">내 제출</a>
      </nav>
      <div class="account">
        <span class="environment"><span class="dot"></span>Visual Studio · C++</span>
        <button class="button ${session ? 'quiet' : 'dark'} small" data-action="${session ? 'account' : 'login'}">${icon('github')}<span>${e(user || 'GitHub 로그인')}</span></button>
      </div>
    </header>
    ${content}
    <footer><span>코드로 이해하고, 함께 성장하기.</span><span>C++ · Windows MSVC</span></footer>
    <dialog id="dialog"></dialog>
  `;
}
function dashboard() {
  activeProblem = null;
  const done = problems.filter((p) => solved(p.id)).length;
  const last = problems.map((p) => ({ p, d: draft(p.id) })).filter(({d}) => d).sort((a,b) => b.d.updatedAt - a.d.updatedAt)[0];
  shell(`
    <main class="dashboard">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow"><span class="dot"></span> OUR LITTLE CODING CLUB</span>
          <h1>오늘도,<br><span>한 문제씩.</span></h1>
          <p>배운 만큼 직접 써 보고, 틀린 곳에서 다시 시작해요.<br>친구들과 함께하는 작은 C++ 연습실.</p>
          <a class="button dark hero-button" href="#/problem/${last?.p.id || problems[0].id}">${last ? '이어서 풀기' : '첫 문제 시작하기'} ${icon('arrow')}</a>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <div class="code-card"><div class="code-title"><i></i><i></i><i></i><span>practice.cpp</span></div>
            <div class="code-lines"><span><b>01</b><em>#include</em> &lt;iostream&gt;</span><span><b>02</b><em>using namespace</em> std;</span><span><b>03</b></span><span><b>04</b><em>int</em> main()</span><span><b>05</b>{</span><span><b>06</b>    cout &lt;&lt; <strong>"작은 시작"</strong>;</span><span><b>07</b>    <em>return</em> <strong>0</strong>;</span><span><b>08</b>}</span></div>
          </div><span class="art-note">${icon('code')} ONE LINE AT A TIME</span>
        </div>
      </section>
      <section class="collection">
        <div class="section-heading"><div><div class="eyebrow">PRACTICE COLLECTION 01</div><h2>중간고사 준비하기 <span class="count">4</span></h2><p>문자열부터 예외 처리까지, 배운 내용을 연결해 봐요.</p></div>
          <div class="progress-box"><span>내 학습 현황 <b>${done}<small> / 4</small></b></span><div class="progress-track"><div style="width:${done * 25}%"></div></div></div>
        </div>
        <div class="table-heading"><span>문제</span><span>학습 키워드</span><span>진행 상태</span></div>
        <div class="problem-list">${problems.map((p) => `<a class="problem-row" href="#/problem/${p.id}">
          <span class="problem-number">${p.number}</span>
          <span class="problem-title"><strong>${e(p.title)}</strong><small>${e(p.subtitle)}</small></span>
          <span class="tags">${p.tags.map((t) => `<span>${e(t)}</span>`).join('')}</span>
          <span class="problem-status ${solved(p.id) ? 'done' : draft(p.id) ? 'draft' : ''}">${solved(p.id) ? icon('check') + '통과' : draft(p.id) ? '작성 중' : '시작 전'}</span>
          <span class="row-arrow">${icon('arrow')}</span>
        </a>`).join('')}</div>
      </section>
      <section class="bottom-notes">
        <div>${icon('book')}<div><strong>배운 범위 안에서 차근차근</strong><p>과제 조건을 먼저 확인하고, 교재에서 배운 방법으로 풀어 보세요.</p></div></div>
        <div>${icon(configured ? 'check' : 'clock')}<div><strong>${configured ? '내 코드, 내 기록' : '코드 작성은 지금 바로'}</strong><p>${configured ? '초대된 GitHub 계정으로 로그인하면 제출 기록을 모아 볼 수 있어요.' : '코드 작성·자동 저장·파일 다운로드를 사용할 수 있어요. 온라인 채점은 연결 준비 중이에요.'}</p></div></div>
      </section>
    </main>
  `);
}
function problemPage(p) {
  activeProblem = p;
  const saved = draft(p.id);
  shell(`<main class="workspace">
    <div class="workspace-heading">
      <a class="back-link" href="#/">← 문제 목록</a>
      <div class="workspace-title"><span class="problem-number">${p.number}</span><h1>${e(p.title)}</h1><span class="pill">${e(p.topic)}</span></div>
      <div class="problem-nav">${problems.map((q) => `<a href="#/problem/${q.id}" class="${q.id === p.id ? 'selected' : ''}" aria-label="${e(q.title)}" ${q.id === p.id ? 'aria-current="page"' : ''}>${q.number}</a>`).join('')}</div>
    </div>
    <div class="workspace-grid">
      <article class="statement">
        <div class="panel-title">${icon('book')} 문제 설명<span>중간고사 대비 · 실습 ${Number(p.number)}</span></div>
        <div class="statement-body">
          <div class="eyebrow">THE CHALLENGE</div><h2>${e(p.title)}</h2>
          ${p.description.map((s) => `<p>${e(s)}</p>`).join('')}
          ${p.note ? `<aside class="notice">${e(p.note)}</aside>` : ''}
          <h3>작성 조건</h3><ul class="requirements">${p.requirements.map((r) => `<li>${e(r)}</li>`).join('')}</ul>
          <h3>입력</h3><p>${e(p.input)}</p>
          <h3>입출력 예제</h3>
          <p class="small-note">출력에는 프로그램이 출력한 문자만 표시합니다. 입력한 값은 자동으로 되풀이되지 않아 입력 안내 문구가 붙어 보일 수 있어요.</p>
          ${p.samples.map((s, i) => `<section class="sample"><div class="sample-title">예제 ${i+1}</div><div class="sample-label">입력<button class="text-button" data-action="copy-input" data-index="${i}">복사</button></div><pre>${e(s.input)}</pre><div class="sample-label">기대 출력<button class="text-button" data-action="copy-output" data-index="${i}">복사</button></div><pre>${e(s.output)}</pre></section>`).join('')}
          <h3>채점 안내</h3><p class="small-note">시간 제한 2초 · 메모리 제한 256MB · 출력 제한 64KB</p><p class="small-note">Windows MSVC에서 컴파일하고 입력별 출력을 비교합니다. 줄바꿈의 CRLF/LF 차이만 허용하며 공백·빈 줄·숫자 정밀도는 그대로 비교합니다. 출력 통과만으로 함수 사용, 메모리 해제, 학습 범위 준수가 모두 검증되지는 않으니 작성 조건도 직접 확인하세요.</p>
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
        <div class="run-bar"><div><span class="dot ${configured ? '' : 'muted'}"></span>${configured ? 'Windows · MSVC' : '온라인 채점 연결 준비 중'}</div><button class="button light" data-action="submit-sample" ${!configured ? 'disabled' : ''}>${icon('play')} 예제 실행</button><button class="button light" data-action="counterexample" ${!configured ? 'disabled' : ''}>${icon('search')} 반례 찾기</button><button class="button dark" data-action="submit" ${!configured ? 'disabled' : ''}>제출하기 ${icon('arrow')}</button></div>
        <section class="result-panel" aria-live="polite"><div class="panel-title">${icon('code')} 실행 결과</div><div id="result"><div class="empty-result"><span class="empty-icon">${icon('code')}</span><strong>${configured ? '작성한 코드를 확인해 볼까요?' : '코드부터 차근차근 작성해 보세요'}</strong><p>${configured ? '예제를 실행하거나 제출하면 결과가 여기에 표시돼요.' : '지금은 .cpp 파일로 저장해 Visual Studio에서 실행할 수 있어요.<br>온라인 채점은 서버 연결 후 사용할 수 있어요.'}</p></div></div></section>
      </section>
    </div>
    <input type="file" accept=".cpp,.cc,.cxx,.txt" id="source-file" hidden />
  </main>`);
  editor = new EditorView({
    doc: saved?.code ?? p.starter,
    extensions: [
      basicSetup, cpp(),
      syntaxHighlighting(HighlightStyle.define([
        { tag: tags.keyword, color: '#b5cda0' },
        { tag: [tags.typeName, tags.className], color: '#91c9b8' },
        { tag: [tags.string, tags.special(tags.string)], color: '#dbdfa4' },
        { tag: tags.number, color: '#e6be9e' },
        { tag: tags.comment, color: '#99ae96', fontStyle: 'italic' },
        { tag: [tags.meta, tags.processingInstruction], color: '#b6c7da' },
        { tag: tags.function(tags.variableName), color: '#d8e9be' },
        { tag: tags.operator, color: '#c1d0bb' },
      ])),
      EditorView.contentAttributes.of({ 'aria-label': 'C++ 코드', spellcheck: 'false' }),
      EditorView.updateListener.of((update) => { if (update.docChanged) saveDraft(); }),
      EditorView.theme({
        '&': { background: '#172923', color: '#e1eee4', fontSize: '13px', height: '100%' },
        '.cm-content': { fontFamily: '"Cascadia Code", Consolas, monospace', padding: '18px 0', caretColor: '#d2efaa', minHeight: '420px' },
        '.cm-gutters': { background: '#172923', color: '#778a7e', border: 'none', paddingRight: '10px' },
        '.cm-activeLineGutter': { background: '#20382f' },
        '.cm-activeLine': { background: '#20382f80' },
        '.cm-cursor': { borderLeftColor: '#d2efaa' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { background: '#415f50 !important' },
        '.cm-scroller': { overflow: 'auto', lineHeight: '1.8' },
        '.cm-tooltip': { background: '#fff', color: '#20382f' },
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
  shell(`<main class="history-page"><div class="eyebrow">MY SUBMISSIONS</div><h1>한 번씩, 더 나아지기.</h1><p class="page-intro">내가 제출한 코드와 채점 결과를 모아 봐요.</p>
    ${!session ? `<div class="large-empty">${icon('clock')}<h2>로그인하면 기록이 쌓여요</h2><p>${configured ? '초대된 GitHub 계정으로 로그인해 주세요.' : '로그인과 온라인 채점 연결을 준비 중이에요.<br>작성 중인 코드는 이 브라우저에 자동 저장됩니다.'}</p><button class="button dark" data-action="login">${icon('github')} GitHub 로그인</button></div>` : !history.length ? `<div class="large-empty">${icon('code')}<h2>아직 제출한 코드가 없어요</h2><p>첫 문제를 풀고 나만의 기록을 시작해 보세요.</p><a class="button dark" href="#/">문제 보러 가기 ${icon('arrow')}</a></div>` : `<div class="submission-list">${history.map((s) => `<button class="submission" data-action="show-result" data-id="${e(s.id)}"><span class="status-badge ${e(s.status)}">${e(statusNames[s.status] || s.status)}</span><span><strong>${e(findProblem(s.problem_id)?.title || s.problem_id)}</strong><small>${e(modeNames[s.mode] || s.mode)} · ${e(new Date(s.created_at).toLocaleString('ko-KR'))}</small></span>${icon('arrow')}</button>`).join('')}</div>`}
  </main>`, 'history');
}
function showDialog(title, body) {
  const dialog = document.querySelector('#dialog');
  dialog.innerHTML = `<div class="dialog-heading"><h2>${e(title)}</h2><button class="icon-button" data-close aria-label="닫기">${icon('close')}</button></div>${body}`;
  dialog.querySelectorAll('[data-close]').forEach((b) => b.onclick = closeDialog);
  dialog.showModal();
}
function closeDialog() { document.querySelector('#dialog').close(); }
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
  if (!session) { toast('제출하려면 GitHub 로그인이 필요해요.'); return; }
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
  member = null; history = [];
  if (!session) return;
  const userId = session.user.id;
  try {
    const data = await api('profile');
    if (session?.user.id !== userId) return;
    member = data.member;
    history = data.submissions;
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
  else dashboard();
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === 'login') await login();
    if (action === 'account') {
      showDialog('내 계정', `<p>${e(member?.github_login || 'GitHub 계정')}으로 로그인했어요.</p>${member?.role === 'owner' ? '<p>친구의 GitHub 아이디를 입력하면 이 연습실에 초대합니다.</p><form id="invite-form"><label for="invite-login">GitHub 아이디</label><div class="input-row"><input id="invite-login" required pattern="[a-zA-Z0-9-]{1,39}" autocomplete="off" placeholder="친구의 GitHub 아이디"><button class="button dark">초대</button></div><p id="invite-result" role="status"></p></form>' : ''}<div class="dialog-actions"><button class="button light" id="logout">로그아웃</button><button class="button dark" data-close>닫기</button></div>`);
      document.querySelector('[data-close].button').onclick = closeDialog;
      document.querySelector('#logout').onclick = async () => { saveDraft(); await supabase.auth.signOut(); closeDialog(); };
      const form = document.querySelector('#invite-form');
      if (form) form.onsubmit = async (ev) => { ev.preventDefault(); const output = document.querySelector('#invite-result'); try { const r = await api('invite', { login: document.querySelector('#invite-login').value.trim() }); output.textContent = `${r.login}님을 초대했어요. 사이트 주소를 알려 주세요.`; } catch(error) { output.textContent = error.message; } };
    }
    if (action === 'upload') document.querySelector('#source-file').click();
    if (action === 'download') {
      const profile = getLocal('cpp-room:filename', { student: '', name: '' });
      showDialog('C++ 파일로 저장', `<p>Visual Studio에서 열 수 있도록 UTF-8 BOM과 Windows 줄바꿈으로 저장해요.</p><form id="download-form"><div class="input-row"><label>학번<input name="student" value="${e(profile.student)}" placeholder="학번" pattern="[0-9]{4,20}" required></label><label>이름<input name="name" value="${e(profile.name)}" placeholder="이름" maxlength="30" required></label></div><p class="small-note">파일명: 학번_이름_${Number(activeProblem.number)}.cpp</p><div class="dialog-actions"><button type="button" class="button light" data-close>취소</button><button class="button dark">${icon('down')} 파일 저장</button></div></form>`);
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
