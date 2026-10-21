// Uses disposable accounts and removes only artifacts created by this verification.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const pub=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url?.startsWith('https://')||!key||!pub)throw Error('Server-only and publishable project credentials are required.');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,key,options);
const fresh=()=>createClient(url,pub,options);
const origin='https://o3oc4t.github.io';
const created=[];
const clients=[];
const report=[];
const temporarySubmissions=[];
const password=()=>`Aa1!${randomBytes(24).toString('base64url')}`;
const email=name=>`${name}@cpp-room.invalid`;
function passed(name){report.push({name,passed:true});console.log(`PASS ${name}`);}
async function invoke(client,body){
  const {data:{session}}=await client.auth.getSession();
  const response=await fetch(`${url}/functions/v1/classroom`,{
    method:'POST',headers:{apikey:pub,Authorization:`Bearer ${session?.access_token||pub}`,Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(30000),
  });
  return {status:response.status,body:await response.json()};
}
async function disposable(role){
  const username=`verify_${randomBytes(6).toString('hex')}`;
  const initial=password();
  const {data,error}=await admin.auth.admin.createUser({email:email(username),password:initial,email_confirm:true});
  assert.equal(error,null,'Disposable Auth account must be created.');
  const id=data.user.id;created.push(id);
  const saved=await admin.from('members').insert({user_id:id,username,display_name:'자동 검증 임시 계정',role,must_change_password:true});
  assert.equal(saved.error,null,'Disposable membership must be created.');
  const client=fresh();clients.push(client);
  assert.equal((await client.auth.signInWithPassword({email:email(username),password:initial})).error,null);
  return {id,username,initial,client};
}
try{
  const delivery=await readFile(process.argv[2],'utf8');
  const accounts=[...delivery.matchAll(/아이디: ([a-z0-9_]+)\r?\n표시 이름: [^\r\n]+\r?\n초기 비밀번호: ([^\r\n]+)/g)];
  assert.equal(accounts.length,6,'Delivery file must contain all six newly issued accounts.');
  for(const [,username,initial]of accounts){
    const client=fresh();clients.push(client);
    assert.equal((await client.auth.signInWithPassword({email:email(username),password:initial})).error,null,`${username} login`);
    const profile=await invoke(client,{action:'profile'});
    assert.equal(profile.status,200);
    assert.equal(profile.body.member.username,username);
    assert.equal(profile.body.member.role,username==='roomowner'?'owner':'student');
    assert.equal(profile.body.member.must_change_password,true);
    await client.auth.signOut();
  }
  passed('All six delivered accounts log in and receive their own profile.');
  const anonymous=fresh();
  assert.equal((await invoke(anonymous,{action:'profile'})).status,401);
  assert.ok((await anonymous.from('members').select('*')).error);
  const registration=await anonymous.auth.signUp({email:`verify-${randomUUID()}@example.com`,password:password()});
  assert.equal(registration.error?.code,'signup_disabled');
  passed('Unauthenticated profile/table access and public signup are denied.');

  const owner=await disposable('owner');
  const student=await disposable('student');
  assert.equal((await invoke(owner.client,{action:'create_account',username:'verify_should_not_exist',displayName:'검증'})).status,403);
  assert.equal((await invoke(student.client,{action:'submit',problemId:'midterm-1',mode:'sample',requestId:randomUUID(),code:'int main(){}'})).status,403);
  passed('Initial password change is required before account creation and submission.');

  const next=password();
  assert.equal((await invoke(owner.client,{action:'change_password',currentPassword:'incorrect-current-password',newPassword:next})).status,400);
  assert.ok((await owner.client.auth.updateUser({password:password()})).error,'Direct password changes without current password must fail.');
  const changed=await invoke(owner.client,{action:'change_password',currentPassword:owner.initial,newPassword:next});
  assert.equal(changed.status,200);
  assert.ok((await fresh().auth.signInWithPassword({email:email(owner.username),password:owner.initial})).error);
  assert.equal((await owner.client.auth.signInWithPassword({email:email(owner.username),password:next})).error,null);
  assert.equal((await invoke(owner.client,{action:'profile'})).body.member.must_change_password,false);
  passed('Current password is required; password changes invalidate the previous password.');

  const newName=`verify_${randomBytes(6).toString('hex')}`;
  const issued=await invoke(owner.client,{action:'create_account',username:newName,displayName:'추가 발급 검증'});
  assert.equal(issued.status,200);
  const row=await admin.from('members').select('user_id,role,must_change_password').eq('username',newName).single();
  assert.equal(row.error,null);created.push(row.data.user_id);
  assert.equal(row.data.role,'student');assert.equal(row.data.must_change_password,true);
  const issuedClient=fresh();clients.push(issuedClient);
  assert.equal((await issuedClient.auth.signInWithPassword({email:email(newName),password:issued.body.password})).error,null);
  passed('A verified owner can issue a working student account.');

  await student.client.auth.updateUser({data:{role:'owner'}});
  assert.equal((await invoke(student.client,{action:'create_account',username:'verify_denied',displayName:'검증'})).status,403);
  const ownMembers=await student.client.from('members').select('user_id');
  assert.equal(ownMembers.error,null);assert.deepEqual(ownMembers.data,[{user_id:student.id}]);
  assert.ok((await student.client.from('members').update({role:'owner'}).eq('user_id',student.id)).error);
  const id=randomUUID();temporarySubmissions.push(id);
  assert.equal((await admin.from('submissions').insert({id,request_id:randomUUID(),user_id:owner.id,problem_id:'midterm-1',mode:'sample',source:'// disposable verification',status:'system_error'})).error,null);
  const hidden=await student.client.from('submissions').select('*').eq('id',id);
  assert.equal(hidden.error,null);assert.deepEqual(hidden.data,[]);
  assert.equal((await invoke(student.client,{action:'result',id})).status,404);
  passed('Students cannot elevate their role or read another member’s submission.');

  assert.equal((await admin.from('members').update({active:false}).eq('user_id',student.id)).error,null);
  assert.equal((await invoke(student.client,{action:'profile'})).status,403);
  passed('Inactive members are denied service access.');
} finally {
  for(const client of clients)await client.auth.signOut({scope:'global'});
  for(const id of temporarySubmissions){
    const result=await admin.from('submissions').delete().eq('id',id);
    if(result.error)throw Error('Disposable submission cleanup failed.');
  }
  for(const id of created.reverse()){
    const result=await admin.auth.admin.deleteUser(id);
    if(result.error)throw Error('Disposable account cleanup failed.');
  }
}
const remaining=await admin.from('members').select('username,role,must_change_password').order('username');
assert.equal(remaining.error,null);assert.equal(remaining.data.length,6);
await mkdir('.local/verification',{recursive:true,mode:0o700});
await writeFile('.local/verification/hosted-auth.json',JSON.stringify({checkedAt:new Date().toISOString(),checks:report,members:remaining.data,disposableAccountsRemoved:true},null,2)+'\n',{mode:0o600});
console.log('Live authentication verification complete; exactly six issued members remain.');
