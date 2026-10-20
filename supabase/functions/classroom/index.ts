import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { validateSubmission, validId, validateReport, terminal } from './validation.ts';
import { github, course, commitSolution, readReport } from './github.ts';
import { accountInput, accountEmail, initialPassword, passwordInput } from './accounts.ts';
import { readBounded } from './bounded.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession:false, autoRefreshToken:false },
});
const fields = 'id,problem_id,mode,status,created_at,finished_at,result';
const json = (body: unknown, status: number, cors: HeadersInit) => Response.json(body, {status,headers:{...cors,'Cache-Control':'no-store'}});

Deno.serve(async (req) => {
  const allowed = Deno.env.get('SITE_URL');
  const origin = req.headers.get('Origin');
  const cors = {
    'Access-Control-Allow-Origin': allowed ? new URL(allowed).origin : 'null',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
    'Access-Control-Allow-Methods':'POST,OPTIONS',
    'Vary':'Origin',
  };
  if (!allowed || (origin && origin !== new URL(allowed).origin)) return json({error:'허용되지 않은 사이트입니다.'},403,cors);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method !== 'POST') return json({error:'POST 요청만 허용됩니다.'},405,cors);
  try {
    const bearer = req.headers.get('Authorization');
    if (!bearer?.startsWith('Bearer ')) return json({error:'로그인이 필요합니다.'},401,cors);
    const {data:{user},error:authError} = await db.auth.getUser(bearer.slice(7));
    if (authError || !user) return json({error:'로그인이 만료됐어요. 다시 로그인해 주세요.'},401,cors);
    // Membership is keyed by the verified Auth UUID; roles never come from user_metadata.
    const {data:member,error:memberError} = await db.from('members').select('*').eq('user_id',user.id).eq('active',true).maybeSingle();
    if (memberError) throw new Error('회원 정보를 불러오지 못했습니다.');
    if (!member) return json({error:'운영자가 발급한 활성 계정만 이용할 수 있어요.'},403,cors);
    let raw;
    try { raw = new TextDecoder().decode(await readBounded(req.body,100000)); }
    catch { return json({error:'요청 크기 제한 초과'},413,cors); }
    let body;
    try { body = JSON.parse(raw); } catch { return json({error:'잘못된 요청입니다.'},400,cors); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'잘못된 요청입니다.'},400,cors);
    if (body.action === 'profile') {
      const {data:submissions,error} = await db.from('submissions').select(fields).eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
      if (error) throw new Error('제출 기록을 불러오지 못했습니다.');
      const {data:solved,error:solvedError}=await db.rpc('solved_problems',{p_user:user.id});
      if(solvedError)throw Error('학습 현황을 불러오지 못했습니다.');
      return json({solved:(solved||[]).map((s:any)=>s.problem_id),member:{username:member.username,display_name:member.display_name,role:member.role,must_change_password:member.must_change_password},submissions},200,cors);
    }
    if (body.action === 'change_password') {
      const input=passwordInput(body);
      const verifier=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data:verified,error:passwordError}=await verifier.auth.signInWithPassword({email:accountEmail(member.username),password:input.current});
      if(passwordError||verified.user?.id!==user.id) return json({error:'현재 비밀번호를 확인해 주세요.'},400,cors);
      try {
        const {error}=await db.auth.admin.updateUserById(user.id,{password:input.next});
        if(error)throw Error('비밀번호 변경에 실패했습니다.');
        const {error:saveError}=await db.from('members').update({must_change_password:false}).eq('user_id',user.id);
        if(saveError)throw Error('비밀번호는 변경되었지만 계정 상태 저장에 실패했습니다. 운영자에게 알려 주세요.');
      } finally { await verifier.auth.signOut({scope:'global'}); }
      return json({changed:true},200,cors);
    }
    if (body.action === 'create_account') {
      if(member.role!=='owner'||member.must_change_password) return json({error:'비밀번호 변경을 마친 운영자만 계정을 발급할 수 있어요.'},403,cors);
      const input=accountInput(body);
      const password=initialPassword();
      const {data:created,error}=await db.auth.admin.createUser({email:accountEmail(input.username),password,email_confirm:true});
      if(error||!created.user) return json({error:'계정 발급에 실패했습니다. 이미 사용 중인 아이디인지 확인해 주세요.'},400,cors);
      const {error:memberError}=await db.from('members').insert({user_id:created.user.id,username:input.username,display_name:input.displayName,role:'student',must_change_password:true});
      if(memberError){await db.auth.admin.deleteUser(created.user.id);throw Error('회원 정보 저장에 실패했습니다.');}
      return json({username:input.username,password},200,{...cors,'Cache-Control':'no-store'});
    }
    if (body.action === 'submit') {
      if(member.must_change_password)return json({error:'내 계정에서 초기 비밀번호를 변경한 뒤 제출해 주세요.'},403,cors);
      if (Deno.env.get('JUDGE_ENABLED') !== 'true') return json({error:'온라인 채점을 준비 중입니다. 코드는 파일로 저장할 수 있어요.'},503,cors);
      const input = validateSubmission(body);
      const {data:submission,error} = await db.rpc('reserve_submission', {
        p_user:user.id,p_request:input.requestId,p_problem:input.problemId,p_mode:input.mode,p_source:input.code,
      });
      if (error) return json({error:error.message.includes('제출') || error.message.includes('채점') ? error.message : '제출 접수에 실패했습니다.'},429,cors);
      if (submission.status === 'preparing' && !submission.commit_sha) {
        // Claim once; duplicate requests return the existing record.
        const {data:claim,error:claimError} = await db.from('submissions').update({status:'queued'})
          .eq('id',submission.id).eq('status','preparing').select('id').maybeSingle();
        if (claimError) throw new Error('제출 접수에 실패했습니다.');
        if (claim) {
          try {
            const sha = await commitSolution(submission);
            const {error:saveError} = await db.from('submissions').update({commit_sha:sha}).eq('id',submission.id);
            if (saveError) throw new Error('제출 기록 저장 실패');
          } catch {
            await db.from('submissions').update({status:'system_error',finished_at:new Date().toISOString(),result:{message:'GitHub에 제출을 저장하지 못했습니다. 운영자에게 알려 주세요.'}}).eq('id',submission.id);
          }
        }
      }
      const {data:record,error:readError} = await db.from('submissions').select(fields).eq('id',submission.id).eq('user_id',user.id).single();
      if (readError) throw new Error('접수 결과를 불러오지 못했습니다.');
      return json(record,200,cors);
    }
    if (body.action === 'result') {
      const id = validId(body.id);
      const {data:record,error} = await db.from('submissions').select('*').eq('id',id).eq('user_id',user.id).maybeSingle();
      if (error || !record) return json({error:'제출 기록을 찾지 못했습니다.'},404,cors);
      const {data:pollClaim,error:pollError} = terminal.has(record.status) ? {data:false,error:null}
        : await db.rpc('claim_result_poll',{p_id:id,p_user:user.id});
      if (pollError) throw new Error('채점 상태를 확인하지 못했습니다.');
      if (pollClaim) {
        if (Date.now() - Date.parse(record.created_at) > 20*60000) {
          record.status='system_error'; record.result={message:'채점 시간이 초과되었습니다. 운영자에게 알려 주세요.'};
        } else if (record.commit_sha) {
          const runs = await github(`${course()}/actions/workflows/grade.yml/runs?head_sha=${record.commit_sha}&event=push&per_page=10`);
          const run = runs.workflow_runs.find((r: any) => r.head_sha === record.commit_sha && r.head_branch === 'main' && r.event === 'push' && r.run_attempt === 1);
          if (run) {
            record.run_id=run.id;
            if (run.status === 'completed') {
              if (run.conclusion !== 'success') { record.status='system_error'; record.result={message:'채점 환경에서 오류가 발생했습니다. 운영자에게 알려 주세요.'}; }
              else {
                const report = validateReport(await readReport(run.id), record);
                record.status=report.status; record.result=report;
              }
            } else record.status='running';
          }
        }
        const finished = terminal.has(record.status) ? new Date().toISOString() : null;
        const {error:updateError} = await db.from('submissions').update({status:record.status,result:record.result,run_id:record.run_id,finished_at:finished})
          .eq('id',id).in('status',['preparing','queued','running']);
        if (updateError) throw new Error('채점 결과 저장에 실패했습니다.');
        record.finished_at=finished;
      }
      return json(Object.fromEntries(fields.split(',').map((key) => [key,record[key]])),200,cors);
    }
    return json({error:'지원하지 않는 요청입니다.'},400,cors);
  } catch (error) {
    // Do not include tokens, HTTP payloads, source code, or provider error objects.
    return json({error:error instanceof Error ? error.message : '요청을 처리하지 못했습니다.'},400,cors);
  }
});
