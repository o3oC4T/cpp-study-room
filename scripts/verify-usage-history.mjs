// Live authorization and database-event verification; uses disposable accounts only.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:service,SUPABASE_PUBLISHABLE_KEY:key}=process.env;
if(!url||!service||!key)throw Error('Set the three Supabase verification environment variables.');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,service,options),anonymous=createClient(url,key,options);
const users=[],clients=[];
const report={startedAt:new Date().toISOString(),checks:[]};
async function account(role){
 const username=`usage_${randomBytes(6).toString('hex')}`,password='Aa1!'+randomBytes(24).toString('base64url');
 const result=await admin.auth.admin.createUser({email:`${username}@cpp-room.invalid`,password,email_confirm:true});
 assert.equal(result.error,null);const id=result.data.user.id;users.push(id);
 assert.equal((await admin.from('members').insert({user_id:id,username,display_name:'사용 기록 검증',role,must_change_password:role!=='owner'})).error,null);
 const client=createClient(url,key,options);clients.push(client);
 assert.equal((await client.auth.signInWithPassword({email:`${username}@cpp-room.invalid`,password})).error,null);
 return {id,username,password,client};
}
async function invoke(client,body){
 const {data:{session}}=await client.auth.getSession();
 const response=await fetch(`${url}/functions/v1/classroom`,{method:'POST',headers:{Authorization:`Bearer ${session?.access_token||key}`,apikey:key,'Content-Type':'application/json',Origin:'https://o3oc4t.github.io'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 return {status:response.status,body:await response.json()};
}
try{
 const owner=await account('owner'),student=await account('student');
 const events=await admin.from('usage_events').select('event_type').eq('user_id',student.id);
 assert.equal(events.error,null);assert.ok(events.data.some(e=>e.event_type==='account_created'));assert.ok(events.data.some(e=>e.event_type==='login'));
 const nextPassword='Bb2!'+randomBytes(24).toString('base64url');
 const changed=await invoke(student.client,{action:'change_password',currentPassword:student.password,newPassword:nextPassword});
 assert.equal(changed.status,200);
 await student.client.auth.signOut({scope:'local'});
 assert.equal((await student.client.auth.signInWithPassword({email:`${student.username}@cpp-room.invalid`,password:nextPassword})).error,null);
 const changes=await admin.from('usage_events').select('id').eq('user_id',student.id).eq('event_type','password_changed');
 assert.equal(changes.data.length,1);
 report.checks.push('Actual account creation, Auth login and password change generate database events.');

 const request=randomUUID();
 const reservation={p_user:student.id,p_request:request,p_problem:'midterm-1',p_mode:'full',p_source:'int main(){}'};
 const reserved=await admin.rpc('reserve_submission',reservation);assert.equal(reserved.error,null);
 const repeated=await admin.rpc('reserve_submission',reservation);assert.equal(repeated.data.id,reserved.data.id);
 // Synthetic verdict tests the database trigger only; actual Windows judging is tested separately.
 assert.equal((await admin.from('submissions').update({status:'accepted',finished_at:new Date().toISOString()}).eq('id',reserved.data.id)).error,null);
 assert.equal((await admin.from('submissions').update({status:'accepted'}).eq('id',reserved.data.id)).error,null);
 const submissionEvents=await admin.from('usage_events').select('event_type,status').eq('submission_id',reserved.data.id);
 assert.equal(submissionEvents.data.length,2);assert.ok(submissionEvents.data.some(e=>e.event_type==='submission_finished'&&e.status==='accepted'));
 report.checks.push('Submission and terminal-result triggers preserve events without duplicates on repeated requests or updates.');

 const allowed=await invoke(owner.client,{action:'usage_history',username:student.username});
 assert.equal(allowed.status,200);assert.ok(allowed.body.events.length>=6);
 assert.ok(allowed.body.events.every(e=>e.username===student.username));
 const serialized=JSON.stringify(allowed.body);
 for(const forbidden of [student.password,nextPassword,'encrypted_password','access_token','source'])assert.equal(serialized.includes(forbidden),false);
 const directOwner=await owner.client.from('usage_events').select('id').eq('user_id',student.id);assert.equal(directOwner.error,null);assert.ok(directOwner.data.length);
 assert.equal((await invoke(student.client,{action:'usage_history'})).status,403);
 const directStudent=await student.client.from('usage_events').select('*');assert.equal(directStudent.error,null);assert.deepEqual(directStudent.data,[]);
 assert.ok((await anonymous.from('usage_events').select('*')).error);
 assert.ok((await student.client.from('usage_events').insert({user_id:student.id,username:student.username,event_type:'login'})).error);
 await student.client.auth.updateUser({data:{role:'owner'}});
 assert.equal((await invoke(student.client,{action:'usage_history'})).status,403);
 report.checks.push('Owner can read all members; students/anonymous users cannot read or forge records, including role metadata spoofing.');

 const fillers=Array.from({length:102},()=>({user_id:student.id,username:student.username,event_type:'login'}));
 assert.equal((await admin.from('usage_events').insert(fillers)).error,null);
 const first=await invoke(owner.client,{action:'usage_history',username:student.username,event:'login'});
 assert.equal(first.status,200);assert.equal(first.body.events.length,100);assert.ok(first.body.nextBefore);
 const second=await invoke(owner.client,{action:'usage_history',username:student.username,event:'login',before:first.body.nextBefore});
 assert.equal(second.status,200);assert.equal(second.body.nextBefore,null);
 const ids=[...first.body.events,...second.body.events].map(e=>e.id);
 assert.equal(new Set(ids).size,ids.length);
 const count=await admin.from('usage_events').select('id',{count:'exact',head:true}).eq('username',student.username).eq('event_type','login');assert.equal(ids.length,count.count);
 assert.ok([...first.body.events,...second.body.events].every(e=>e.event_type==='login'));
 assert.equal((await invoke(owner.client,{action:'usage_history',before:'1,role.eq.owner'})).status,400);
 report.checks.push('Username/event filters and cursor pagination include every matching record once; malformed cursors are denied.');

 await admin.from('members').update({role:'student'}).eq('user_id',owner.id);
 assert.equal((await invoke(owner.client,{action:'usage_history'})).status,403);
 assert.deepEqual((await owner.client.from('usage_events').select('id')).data,[]);
 await admin.from('members').update({role:'owner',must_change_password:true}).eq('user_id',owner.id);
 assert.equal((await invoke(owner.client,{action:'usage_history'})).status,403);
 await admin.from('members').update({must_change_password:false,active:false}).eq('user_id',owner.id);
 assert.equal((await invoke(owner.client,{action:'usage_history'})).status,403);
 report.checks.push('Demotion, initial-password restriction and deactivation block existing owner sessions immediately.');
}finally{
 for(const client of clients)await client.auth.signOut({scope:'global'});
 for(const id of users){
  assert.equal((await admin.from('submissions').delete().eq('user_id',id)).error,null);
  assert.equal((await admin.auth.admin.deleteUser(id)).error,null);
  assert.equal((await admin.from('usage_events').delete().eq('user_id',id)).error,null);
 }
}
report.completedAt=new Date().toISOString();report.disposableDataRemoved=true;
await mkdir('.local/verification',{recursive:true});
await writeFile('.local/verification/usage-history.json',JSON.stringify(report,null,2)+'\n');
console.log('Owner usage history: real events, filters, pagination and access-control checks passed.');
