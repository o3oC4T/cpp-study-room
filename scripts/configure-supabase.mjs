// Initial hosted setup. Keep the management token in the process environment only.
import {spawnSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';

const ref=process.env.SUPABASE_PROJECT_REF;
const token=process.env.SUPABASE_ACCESS_TOKEN;
if(!ref||!/^[a-z]{20}$/.test(ref)||!token)throw Error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN.');
const site='https://o3oc4t.github.io/cpp-study-room/';
const url=`https://${ref}.supabase.co`;
async function management(path,method='GET',body){
  const response=await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`,{
    method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw Error(`Supabase management ${method} ${path}: HTTP ${response.status}`);
  const raw=await response.text();
  return raw?JSON.parse(raw):null;
}
const project=await management('');
if(project.name!=='cpp-study-room')throw Error('This script only configures the cpp-study-room project.');
const current=await management('/config/auth');
const auth={
  site_url:site,uri_allow_list:'',disable_signup:true,
  external_email_enabled:true,external_phone_enabled:false,external_anonymous_users_enabled:false,
  jwt_exp:900,password_min_length:12,
  security_update_password_require_current_password:true,
  security_update_password_require_reauthentication:true,
  mailer_secure_email_change_enabled:true,
};
for(const key of Object.keys(current)){
  if(/^external_.*_enabled$/.test(key)&&key!=='external_email_enabled')auth[key]=false;
}
await management('/config/auth','PATCH',auth);
const applied=await management('/config/auth');
for(const [key,value] of Object.entries(auth)){
  if(applied[key]!==value)throw Error(`Auth configuration did not persist: ${key}`);
}
await management('/secrets','POST',[
  {name:'SITE_URL',value:site},
  {name:'COURSE_REPOSITORY',value:'o3oC4T/cpp-coursework'},
  {name:'JUDGE_ENABLED',value:'false'},
]);
const keys=await management('/api-keys?reveal=true');
const service=keys.find(k=>k.name==='service_role'&&!k.disabled)?.api_key;
const publishable=keys.find(k=>k.type==='publishable'&&!k.disabled)?.api_key;
if(!service||!publishable)throw Error('Required project keys are unavailable.');
await mkdir('.local/verification',{recursive:true,mode:0o700});
await writeFile('.local/verification/hosted-auth-config.json',JSON.stringify({
  checkedAt:new Date().toISOString(),project:ref,auth,
},null,2)+'\n',{mode:0o600});
await writeFile('.local/project.json',JSON.stringify({projectId:ref,url,publishableKey:publishable},null,2)+'\n',{mode:0o600});
const provision=spawnSync(process.execPath,['scripts/provision-accounts.mjs'],{
  env:{...process.env,SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:service},stdio:'inherit',
});
if(provision.status!==0)throw Error('Account provisioning did not complete.');
console.log('Hosted auth policy verified. Classroom configured; judge stays disabled pending its live checks.');
