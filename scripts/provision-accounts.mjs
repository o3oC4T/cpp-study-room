// Run only in a trusted terminal. Credentials are never compiled into the frontend.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be supplied as process environment.
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {mkdir,open} from 'node:fs/promises';
import path from 'node:path';
import {randomAccountName} from './account-names.mjs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Set server-only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the process environment.');
if(new URL(url).protocol!=='https:')throw Error('HTTPS is required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:registry,error:registryError}=await db.from('members').select('username,role');
if(registryError)throw Error('Cannot read account registry. Apply migrations first.');
const names=new Set(registry.map(account=>account.username));
const accounts=[];
if(!registry.some(account=>account.role==='owner'))accounts.push({username:'roomowner',display_name:'운영자',role:'owner'});
for(let i=registry.filter(account=>account.role==='student').length;i<5;i++){
  let username;
  do {username=randomAccountName();} while(names.has(username));
  names.add(username);accounts.push({username,display_name:`친구 ${i+1}`,role:'student'});
}
if(!accounts.length){console.log('The owner and at least five student accounts already exist; no account or password was changed.');process.exit(0);}
const directory=path.resolve('.local/credentials');
await mkdir(directory,{recursive:true,mode:0o700});
const filename=path.join(directory,`initial-accounts-${Date.now()}.txt`);
const file=await open(filename,'wx',0o600);
let createdCount=0;
try {
 await file.write('코드연습실 계정 전달용 초기 비밀번호\n첫 로그인 뒤 비밀번호를 변경해야 제출할 수 있습니다.\n변경 뒤 이 초기 비밀번호는 사용할 수 없습니다. 안전하게 전달한 뒤 이 파일을 삭제하세요.\n\n');
 for(const account of accounts){
  const {data:existing,error:readError}=await db.from('members').select('user_id').eq('username',account.username).maybeSingle();
  if(readError)throw Error('Cannot read account registry. Apply migrations first.');
  if(existing)continue; // Never reset an existing user's password during a rerun.
  if(account.role==='owner'){
   const {data:owners,error}=await db.from('members').select('user_id').eq('role','owner').limit(1);
   if(error)throw Error('Cannot check existing owner.');
   if(owners.length)throw Error('An owner already exists; use their account management screen.');
  }
  const password='Aa1!'+randomBytes(24).toString('base64url');
  const {data,error}=await db.auth.admin.createUser({email:`${account.username}@cpp-room.invalid`,password,email_confirm:true});
  if(error||!data.user)throw Error(`Could not create ${account.username}; no existing password was changed.`);
  const {error:saveError}=await db.from('members').insert({...account,user_id:data.user.id,must_change_password:true});
  if(saveError){await db.auth.admin.deleteUser(data.user.id);throw Error('Could not save membership.');}
  await file.write(`아이디: ${account.username}\n표시 이름: ${account.display_name}\n초기 비밀번호: ${password}\n\n`);
  await file.sync();createdCount++;
 }
} finally {await file.close();}
console.log(`Created ${createdCount} accounts. Private delivery file: ${filename}`);
