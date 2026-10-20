export function accountInput(body: Record<string, unknown>) {
  if(typeof body.username!=='string'||!/^[a-z][a-z0-9_]{2,23}$/.test(body.username))
    throw Error('아이디는 영문 소문자로 시작하는 3~24자의 영문 소문자, 숫자, 밑줄입니다.');
  if(typeof body.displayName!=='string'||!body.displayName.trim()||body.displayName.length>30||/[\x00-\x1f\x7f]/.test(body.displayName))
    throw Error('표시 이름은 1~30자로 입력해 주세요.');
  return {username:body.username,displayName:body.displayName.trim()};
}
export function accountEmail(username: string){return `${username}@cpp-room.invalid`;}
export function initialPassword(){
  const bytes=crypto.getRandomValues(new Uint8Array(24));
  return 'Aa1!'+btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_');
}
export function passwordInput(body:Record<string,unknown>){
 if(typeof body.currentPassword!=='string'||body.currentPassword.length<1||body.currentPassword.length>200 ||
    typeof body.newPassword!=='string'||body.newPassword.length<12||new TextEncoder().encode(body.newPassword).length>72||body.newPassword===body.currentPassword)
   throw Error('새 비밀번호는 기존과 다른 12자 이상, UTF-8 기준 72바이트 이하로 입력해 주세요.');
 return {current:body.currentPassword,next:body.newPassword};
}
