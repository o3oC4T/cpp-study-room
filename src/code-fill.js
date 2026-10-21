import {escapeHTML as e} from './lib.js';

const tokens=code=>JSON.stringify(code.match(/[A-Za-z_]\w*|\d+|[^\s]/g)||[]);
export const matchesCodeLine=(code,answers)=>answers.some(answer=>tokens(code)===tokens(answer));

export function codeFillHTML(exercise) {
 return `<form id="${e(exercise.id)}" class="blank-exercise code-fill" aria-labelledby="${e(exercise.id)}-title"><h3 id="${e(exercise.id)}-title">${e(exercise.title)}</h3><p>${e(exercise.description)}</p>
 ${exercise.fields.map((field,i)=>`<div class="code-fill-field"><label for="${e(exercise.id)}-${i}">${e(field.label)}</label>${field.before?`<pre>${e(field.before)}</pre>`:''}<input id="${e(exercise.id)}-${i}" class="code-input" data-answer="${i}" aria-describedby="${e(exercise.id)}-feedback-${i}" autocomplete="off" spellcheck="false" maxlength="120" placeholder="C++ 코드 한 줄을 작성하세요"><details><summary>힌트 보기</summary><p>${e(field.hint)}</p></details><p id="${e(exercise.id)}-feedback-${i}" data-feedback="${i}"></p></div>`).join('')}
 <button class="button light" type="submit">답 확인</button><p data-summary role="status"></p></form>`;
}

export function bindCodeFill(exercise,state,save) {
 state.exercises??={};
 const record=state.exercises[exercise.id]??={answers:[],checked:[]};
 const form=document.getElementById(exercise.id);
 const inputs=[...form.querySelectorAll('[data-answer]')];
 function feedback(){
  let passed=0;
  exercise.fields.forEach((field,i)=>{
   const checked=record.checked[i]===true;
   const correct=matchesCodeLine(record.answers[i]||'',field.answers);
   if(checked&&correct)passed++;
   const output=form.querySelector(`[data-feedback="${i}"]`);
   output.textContent=checked?(correct?'맞았어요.':`다시 생각해 보세요. ${field.hint}`):'';
   output.className=checked?(correct?'success-text':'error-text'):'';
   inputs[i].setAttribute('aria-invalid',String(checked&&!correct));
  });
  const summary=form.querySelector('[data-summary]');
  summary.textContent=passed===exercise.fields.length?exercise.success:`${exercise.fields.length}줄 중 ${passed}줄 정답 · 작성한 코드는 이 브라우저에 자동 저장됩니다.`;
  summary.className=passed===exercise.fields.length?'success-text':'';
 }
 inputs.forEach((input,i)=>{
  input.value=record.answers[i]||'';
  input.oninput=()=>{record.answers[i]=input.value;record.checked[i]=false;save();feedback();};
 });
 form.onsubmit=event=>{event.preventDefault();record.checked=exercise.fields.map(()=>true);save();feedback();};
 feedback();
}
