import {escapeHTML as e, getLocal, setLocal} from './lib.js';
import {lessons} from './lessons.js';
import {findProblem} from './problems.js';
const key=(user,id)=>`cpp-room:lesson:${user || 'guest'}:${id}`;
export const lessonProgress=(user,id)=>getLocal(key(user,id),{answers:{},blank:false,complete:false});
export function learningOverview(user) {
 return `<main class="page-content learning-home"><div class="page-heading"><div><div class="eyebrow">LEARN BY DOING</div><h1>개념부터 직접 연결하기</h1><p>PDF의 개념을 읽고, 값과 실행 흐름을 따라가고, 코드로 확인하세요.</p></div><span class="pill">${lessons.length}개 단원 · ${lessons.filter(l=>lessonProgress(user,l.id).complete).length}개 완료</span></div>
 <div class="learning-path"><span>01 주소와 값</span><b>→</b><span>02 배열과 함수</span><b>→</b><span>03 구조체</span><b>→</b><span>04 동적 할당</span><b>→</b><span>05 기록 처리</span><b>→</b><span>06 중첩 메모리</span><b>→</b><span>07 예외 처리</span></div>
 <div class="lesson-grid">${lessons.map(l=>`<a class="lesson-card card" href="#/learn/${l.id}"><div><span class="lesson-number">${l.number}</span><span class="pill">${l.track}</span><span class="lesson-duration">약 ${l.minutes}분</span></div><h2>${e(l.title)}</h2><p>${e(l.summary)}</p><div class="lesson-card-footer"><span>개념 ${l.sections.length} · ${e(l.walkthroughLabel || '메모리 그림')} · 확인 문제</span><strong>${lessonProgress(user,l.id).complete?'복습하기 ✓':'학습 시작 →'}</strong></div></a>`).join('')}</div>
 <aside class="notice">교재 PDF를 바탕으로 다시 설명한 학습 자료입니다. 각 단원에 실제 PDF 페이지를 표시했습니다. C++ 예제는 Windows MSVC 기준으로 확인하며, 개념 확인 기록은 이 브라우저에 저장됩니다.</aside></main>`;
}
export function lessonHTML(l,user) {
 const state=lessonProgress(user,l.id);
 return `<main class="page-content lesson-page"><a class="back-link" href="#/learn">← 개념 학습</a><div class="page-heading"><div><div class="eyebrow">LESSON ${l.number} / ${e(l.track)}</div><h1>${e(l.title)}</h1><p>${e(l.summary)}</p></div><span class="pill">약 ${l.minutes}분</span></div>
 <div class="lesson-layout"><article class="lesson-content">
 ${l.sections.map((s,i)=>`<section class="lesson-section"><div class="section-kicker">${String(i+1).padStart(2,'0')}</div><h2>${e(s.title)}</h2><p>${e(s.text)}</p><div class="code-label">${s.full?'실행 가능한 전체 코드':'main() 안에서 실행할 코드 · iostream 포함, std 사용'}</div><pre class="lesson-code"><code>${e(s.code)}</code></pre>${s.output!==undefined?`<details class="example-output"><summary>실행 결과 확인</summary><pre>${e(s.output||'(출력 없음)')}</pre></details>`:''}${s.table?`<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>${s.table.headers.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(row=>`<tr>${row.map(cell=>`<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${s.note?`<p class="notice">${e(s.note)}</p>`:''}</section>`).join('')}
 <section class="lesson-section memory-lab"><div class="section-kicker">${l.scenarios?'EXECUTION FLOW':'MEMORY WALKTHROUGH'}</div><h2>한 줄씩 따라가기</h2><p>${e(l.walkthroughDescription || '‘다음 단계’를 눌러 값과 연결 대상의 변화를 확인하세요.')}</p>${l.scenarios?`<div class="walkthrough-selector"><label for="walkthrough-scenario">실행 예시</label><select id="walkthrough-scenario">${l.scenarios.map((s,i)=>`<option value="${i}">${e(s.label)}</option>`).join('')}</select></div>`:''}<div id="memory-frame" aria-live="polite"></div><div class="memory-controls"><button class="button light" id="memory-prev">← 이전 단계</button><span id="memory-position"></span><button class="button dark" id="memory-next">다음 단계 →</button></div></section>
 <section class="lesson-section"><div class="section-kicker">CHECK YOUR UNDERSTANDING</div><h2>직접 확인하기</h2>
 ${l.quizzes.map((q,i)=>`<fieldset class="quiz"><legend>${i+1}. ${e(q.q)}</legend>${q.options.map((o,j)=>`<label class="quiz-option"><input type="radio" name="quiz-${i}" value="${j}" ${state.answers[i]===j?'checked':''}><span>${e(o)}</span></label>`).join('')}<p class="quiz-feedback" id="quiz-feedback-${i}" role="status"></p></fieldset>`).join('')}
 <form id="blank-form" class="blank-exercise"><h3>코드 한 줄 채우기</h3><p>${e(l.blank.q)}</p><pre>${e(l.blank.before)}</pre><label class="visually-hidden" for="blank-answer">빈칸에 들어갈 코드</label><input id="blank-answer" class="code-input" autocomplete="off" spellcheck="false" placeholder="여기에 C++ 코드 한 줄을 작성하세요" maxlength="120" required><pre>${e(l.blank.after)}</pre><button class="button light" type="submit">답 확인</button><details><summary>힌트 보기</summary><p>${e(l.blank.hint)}</p></details><p id="blank-feedback" role="status">${state.blank?'이전에 통과한 문제예요. 다시 써 보며 복습할 수 있어요.':''}</p></form>
 <div class="lesson-finish"><span id="completion-hint">확인 문제 ${l.quizzes.length}개와 코드 빈칸을 맞히면 학습을 완료할 수 있어요.</span><button id="complete-lesson" class="button dark">${state.complete?'학습 완료 ✓':'학습 완료 표시'}</button></div></section>
 <div class="source-note"><strong>기반 자료</strong><p>${e(l.source)}</p><p>페이지 번호는 PDF 파일의 첫 페이지부터 센 번호입니다. 교재의 오타는 실행 가능한 형태로 수정했고, 새로운 예제로 설명합니다.</p></div>
 </article><aside class="lesson-side"><div class="card"><div class="eyebrow">NEXT: WRITE CODE</div><h3>배운 내용으로 풀기</h3>${l.practice.map(id=>{const p=findProblem(id);return `<a href="#/problem/${id}"><span>${e(p.title)}</span><small>${e(p.topic)} →</small></a>`;}).join('')}</div><div class="card"><h3>전체 학습 경로</h3>${lessons.map(x=>`<a href="#/learn/${x.id}" class="${x.id===l.id?'current':''}"><span>${x.number} ${e(x.title)}</span>${lessonProgress(user,x.id).complete?'<small>완료 ✓</small>':''}</a>`).join('')}</div></aside></div></main>`;
}
export function bindLesson(l,user,notify) {
 const state=lessonProgress(user,l.id);let frame=0, frames=l.frames;
 const save=()=>{if(!setLocal(key(user,l.id),state))notify('학습 기록을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');};
 function drawFrame(){
  const f=frames[frame];document.querySelector('#memory-frame').innerHTML=`<pre class="memory-code">${e(f.code)}</pre>${f.pointer?`<div class="memory-pointer">${e(f.pointer)}</div>`:''}<div class="memory-cells ${f.released?'released':''}">${f.cells.map(([name,value])=>`<div class="memory-cell ${name===f.target?'pointed':''}"><small>${e(name)}</small><strong>${e(value)}</strong></div>`).join('')}</div><p class="memory-note">${e(f.note)}</p>`;
  document.querySelector('#memory-position').textContent=`${frame+1} / ${frames.length}`;
  document.querySelector('#memory-prev').disabled=frame===0;document.querySelector('#memory-next').disabled=frame===frames.length-1;
 }
 function progress(){
  const ready=l.quizzes.every((q,i)=>state.answers[i]===q.answer)&&state.blank;
  document.querySelector('#complete-lesson').disabled=!ready;
  if(state.complete)document.querySelector('#completion-hint').textContent='학습 완료 기록이 이 브라우저에 저장되었어요.';
 }
 function feedback(i){const q=l.quizzes[i],value=state.answers[i];if(value===undefined)return;const correct=value===q.answer;const out=document.querySelector(`#quiz-feedback-${i}`);out.className='quiz-feedback '+(correct?'success-text':'error-text');out.textContent=(correct?'맞았어요. ':'다시 생각해 보세요. ')+q.why;}
 document.querySelector('#memory-prev').onclick=()=>{frame--;drawFrame();};
 document.querySelector('#memory-next').onclick=()=>{frame++;drawFrame();};
 l.quizzes.forEach((q,i)=>{feedback(i);document.querySelectorAll(`input[name="quiz-${i}"]`).forEach(el=>el.onchange=()=>{state.answers[i]=Number(el.value);save();feedback(i);progress();});});
 document.querySelector('#blank-form').onsubmit=ev=>{ev.preventDefault();const compact=s=>s.replace(/\s+/g,'');const correct=l.blank.answers.some(a=>compact(a)===compact(document.querySelector('#blank-answer').value));const out=document.querySelector('#blank-feedback');out.textContent=correct?'맞았어요. '+l.blank.hint:'아직 맞지 않아요. '+l.blank.hint;out.className=correct?'success-text':'error-text';if(correct){state.blank=true;save();}progress();};
 document.querySelector('#complete-lesson').onclick=()=>{state.complete=true;save();document.querySelector('#complete-lesson').textContent='학습 완료 ✓';progress();notify('학습을 완료했어요. 연결된 코딩 문제로 연습해 보세요.');};
 const scenario=document.querySelector('#walkthrough-scenario');
 if(scenario)scenario.onchange=()=>{frames=l.scenarios[Number(scenario.value)].frames;frame=0;drawFrame();};
 drawFrame();progress();
}
