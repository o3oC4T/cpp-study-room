import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { validateSubmission, validId, validateReport, terminal } from './validation.ts';
import { github, course, commitSolution, readReport } from './github.ts';
import { readBounded } from './bounded.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession:false, autoRefreshToken:false },
});
const fields = 'id,problem_id,mode,status,created_at,finished_at,result';
const json = (body: unknown, status: number, cors: HeadersInit) => Response.json(body, {status,headers:cors});

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
    // Identity data is supplied by the verified OAuth provider, not mutable user_metadata.
    const githubIdentity = user.identities?.find((identity) => identity.provider === 'github');
    const githubId = String(githubIdentity?.identity_data?.provider_id ?? githubIdentity?.identity_data?.sub ?? '');
    if (!/^\d{1,20}$/.test(githubId)) return json({error:'GitHub 계정으로 로그인해 주세요.'},403,cors);
    const {data:member,error:memberError} = await db.from('members').select('*').eq('github_id',githubId).eq('active',true).maybeSingle();
    if (memberError) throw new Error('회원 정보를 불러오지 못했습니다.');
    if (!member || (member.user_id && member.user_id !== user.id)) return json({error:'초대된 계정만 이용할 수 있어요. 운영자에게 GitHub 아이디를 알려 주세요.'},403,cors);
    if (!member.user_id) {
      const {error} = await db.from('members').update({user_id:user.id}).eq('github_id',githubId).is('user_id',null);
      if (error) throw new Error('회원 연결에 실패했습니다.');
    }
    let raw;
    try { raw = new TextDecoder().decode(await readBounded(req.body,100000)); }
    catch { return json({error:'요청 크기 제한 초과'},413,cors); }
    let body;
    try { body = JSON.parse(raw); } catch { return json({error:'잘못된 요청입니다.'},400,cors); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'잘못된 요청입니다.'},400,cors);
    if (body.action === 'profile') {
      const {data:submissions,error} = await db.from('submissions').select(fields).eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
      if (error) throw new Error('제출 기록을 불러오지 못했습니다.');
      return json({member:{github_login:member.github_login,role:member.role},submissions},200,cors);
    }
    if (body.action === 'invite') {
      if (member.role !== 'owner') return json({error:'운영자만 초대할 수 있습니다.'},403,cors);
      if (typeof body.login !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(body.login))
        return json({error:'올바른 GitHub 아이디를 입력해 주세요.'},400,cors);
      const account = await github(`/users/${encodeURIComponent(body.login)}`);
      if (account.type !== 'User') return json({error:'개인 GitHub 계정만 초대할 수 있습니다.'},400,cors);
      const {error} = await db.from('members').upsert({github_id:String(account.id),github_login:account.login}, {onConflict:'github_id',ignoreDuplicates:true});
      if (error) throw new Error('초대에 실패했습니다.');
      return json({login:account.login},200,cors);
    }
    if (body.action === 'submit') {
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
