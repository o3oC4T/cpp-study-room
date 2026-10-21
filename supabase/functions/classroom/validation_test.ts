import {validateSubmission,validateReport} from './validation.ts';
import {readBounded} from './bounded.ts';
import {usageInput} from './usage.ts';
const assert=(condition:unknown)=>{if(!condition)throw new Error('Assertion failed')};
const throws=(fn:()=>unknown)=>{let failed=false;try{fn()}catch{failed=true}assert(failed)};
const submission={id:'12345678-1234-4234-8234-123456789012',commit_sha:'a'.repeat(40),problem_id:'midterm-4',mode:'full'};
const base={schema:1,submissionId:submission.id,commitSha:submission.commit_sha,problemId:submission.problem_id,mode:'full',status:'accepted',tests:[{sample:false,status:'accepted',input:'hidden input',expected:'secret expected',actual:'secret actual'}]};

Deno.test('usage history only accepts bounded cursors and explicit filters',()=>{
  assert(usageInput({username:'friend01',event:'login',before:100}).before===100);
  assert(usageInput({}).before===null);
  for(const body of [{username:'friend01,role.eq.owner'},{event:'source'},{before:'1'},{before:-1},{before:1.5},{before:1e20}])throws(()=>usageInput(body));
});

Deno.test('input validation rejects path traversal, oversized UTF-8 and invalid modes',()=>{
  const valid={problemId:'midterm-4',mode:'counterexample',requestId:submission.id,code:'int main(){}'};
  assert(validateSubmission(valid).mode==='counterexample');
  throws(()=>validateSubmission({...valid,problemId:'../../etc'}));
  throws(()=>validateSubmission({...valid,code:'가'.repeat(22000)}));
  throws(()=>validateSubmission({...valid,code:'a\0b'}));
  throws(()=>validateSubmission({...valid,mode:'shell'}));
});
Deno.test('reports must match exact submission and hide private test data',()=>{
  const report=validateReport(base,submission);
  assert(!('input' in report.tests[0]) && !('expected' in report.tests[0]));
  throws(()=>validateReport({...base,commitSha:'b'.repeat(40)},submission));
  throws(()=>validateReport({...base,tests:[]},submission));
  throws(()=>validateReport({...base,tests:[{sample:false,status:'wrong_answer'}]},submission));
});
Deno.test('counterexample results are not accepted verdicts and only reveal their own mode data',()=>{
  const counter={...submission,mode:'counterexample'};
  const raw={...base,mode:'counterexample',status:'counterexample_found',tested:1,tests:[{sample:false,counterexample:true,status:'wrong_answer',input:'0\n2\nN\n',expected:'error\n',actual:'16000\n'}]};
  assert(validateReport(raw,counter).tests[0].input==='0\n2\nN\n');
  throws(()=>validateReport(raw,submission));
  throws(()=>validateReport({...base,mode:'counterexample'},counter));
  throws(()=>validateReport({...raw,status:'no_counterexample',tested:0,tests:[]},counter));
  assert(validateReport({...raw,status:'no_counterexample',tested:28,tests:[]},counter).tested===28);
});
Deno.test('stream size limit cancels before buffering the entire request',async()=>{
  let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(1024))},cancel(){cancelled=true}});
  let failed=false;
  try{await readBounded(stream,1500)}catch{failed=true}
  assert(failed && cancelled);
  const small=new Response('한글').body;
  assert(new TextDecoder().decode(await readBounded(small,6))==='한글');
});

import {accountInput,initialPassword,passwordInput} from './accounts.ts';
Deno.test('pre-issued accounts reject unsafe names and weak passwords',()=>{
 assert(accountInput({username:'friend01',displayName:'친구'}).username==='friend01');
 for(const username of ['A','x','../admin','<script>','friend@evil.com'])throws(()=>accountInput({username,displayName:'test'}));
 throws(()=>passwordInput({currentPassword:'old',newPassword:'short'}));
 throws(()=>passwordInput({currentPassword:'old',newPassword:'가'.repeat(25)}));
 throws(()=>passwordInput({currentPassword:'samepassword123',newPassword:'samepassword123'}));
 assert(passwordInput({currentPassword:'old',newPassword:'a long passphrase 123'}).next==='a long passphrase 123');
 const passwords=Array.from({length:100},()=>initialPassword());
 assert(new Set(passwords).size===100&&passwords.every(p=>p.length>=32&&p.length<=72));
});
Deno.test('all expanded problem IDs are accepted but out of range sets are rejected',()=>{
 for(let s=1;s<=8;s++)for(let p=1;p<=4;p++)assert(validateSubmission({problemId:`practice-${s}-${p}`,mode:'full',requestId:submission.id,code:'int main(){}'}));
 for(const problemId of ['practice-0-1','practice-9-1','practice-1-5','practice-1-1/../x'])throws(()=>validateSubmission({problemId,mode:'full',requestId:submission.id,code:'int main(){}'}));
});
