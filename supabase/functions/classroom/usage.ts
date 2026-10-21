export function usageInput(body: Record<string, unknown>) {
  const username=body.username===undefined||body.username===''?null:body.username;
  if(username!==null&&(typeof username!=='string'||!/^[a-z][a-z0-9_]{2,23}$/.test(username)))throw Error('올바른 아이디를 입력해 주세요.');
  const events=['login','password_changed','account_created','submission_created','submission_finished'];
  const event=body.event===undefined||body.event===''?null:body.event;
  if(event!==null&&(typeof event!=='string'||!events.includes(event)))throw Error('올바른 기록 종류를 선택해 주세요.');
  const before=body.before===undefined||body.before===null?null:body.before;
  if(before!==null&&(!Number.isSafeInteger(before)||Number(before)<1))throw Error('기록 페이지가 올바르지 않습니다.');
  return {username:username as string|null,event:event as string|null,before:before as number|null};
}
