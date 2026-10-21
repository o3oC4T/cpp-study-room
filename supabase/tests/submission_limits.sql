-- Run with the trusted SQL connection. All fixture/member changes are rolled back
-- by the inner exception block, including when an assertion fails. No job is sent.
set statement_timeout = '15s';
set lock_timeout = '5s';
do $$
declare
  learner uuid;
  other_learner uuid;
  marker text := 'quota-verification-' || gen_random_uuid()::text;
  request uuid;
  item public.submissions;
  duplicate public.submissions;
begin
  select user_id into learner from public.members where role='student' order by created_at,user_id limit 1;
  select user_id into other_learner from public.members where role='student' and user_id<>learner order by created_at,user_id limit 1;
  if learner is null or other_learner is null then
    raise exception 'Two provisioned test targets are required.';
  end if;
  -- Match reserve_submission's lock so concurrent reservations cannot see fixtures.
  perform pg_advisory_xact_lock(731604210);
  begin
    update public.members set active=true,must_change_password=false where user_id=learner;
    update public.submissions set created_at=now()-interval '2 days'
      where created_at>now()-interval '1 day';

    insert into public.submissions(request_id,user_id,problem_id,mode,source,status)
      select gen_random_uuid(),learner,'midterm-1',
        case n%3 when 0 then 'sample' when 1 then 'full' else 'counterexample' end,
        marker,'compile_error' from generate_series(1,49) n;
    request:=gen_random_uuid();
    item:=public.reserve_submission(learner,request,'midterm-1','full',marker);
    if item.status<>'preparing' then raise exception '50th submission was not accepted.'; end if;
    duplicate:=public.reserve_submission(learner,request,'midterm-1','full',marker);
    if duplicate.id<>item.id then raise exception 'Duplicate request was counted twice.'; end if;
    update public.submissions set status='compile_error',finished_at=now() where id=item.id;
    begin
      perform public.reserve_submission(learner,gen_random_uuid(),'midterm-1','counterexample',marker);
      raise exception '51st submission was incorrectly accepted.';
    exception when sqlstate 'P0001' then
      if sqlerrm<>'하루 제출 한도(50회)에 도달했어요.' then raise; end if;
    end;
    delete from public.submissions where source=marker;

    insert into public.submissions(request_id,user_id,problem_id,mode,source,status)
      select gen_random_uuid(),other_learner,'midterm-1','sample',marker,'compile_error'
      from generate_series(1,299);
    request:=gen_random_uuid();
    item:=public.reserve_submission(learner,request,'midterm-1','counterexample',marker);
    if item.status<>'preparing' then raise exception '300th shared submission was not accepted.'; end if;
    duplicate:=public.reserve_submission(learner,request,'midterm-1','counterexample',marker);
    if duplicate.id<>item.id then raise exception 'Shared-limit retry lost idempotency.'; end if;
    update public.submissions set status='compile_error',finished_at=now() where id=item.id;
    begin
      perform public.reserve_submission(learner,gen_random_uuid(),'midterm-1','sample',marker);
      raise exception '301st shared submission was incorrectly accepted.';
    exception when sqlstate 'P0001' then
      if sqlerrm<>'오늘 연습실의 채점 한도(300회)에 도달했어요.' then raise; end if;
    end;

    update public.submissions set created_at=now()-interval '2 days' where source=marker;
    item:=public.reserve_submission(learner,gen_random_uuid(),'midterm-1','sample',marker);
    if item.status<>'preparing' then raise exception 'Expired submissions still consume quota.'; end if;
    begin
      perform public.reserve_submission(learner,gen_random_uuid(),'midterm-1','sample',marker);
      raise exception 'Concurrent submission protection was removed.';
    exception when sqlstate 'P0001' then
      if sqlerrm<>'진행 중인 채점이 끝난 뒤 제출해 주세요.' then raise; end if;
    end;
    -- Deliberately roll back every fixture and temporary edit on successful checks.
    raise exception using errcode='P9001',message='quota verification complete';
  exception when sqlstate 'P9001' then null;
  end;
  if exists(select 1 from public.submissions where source=marker) then
    raise exception 'Verification fixtures were not rolled back.';
  end if;
  if has_function_privilege('authenticated','public.reserve_submission(uuid,uuid,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.reserve_submission(uuid,uuid,text,text,text)','EXECUTE') then
    raise exception 'Submission reservation was exposed to clients.';
  end if;
end $$;
reset statement_timeout;
reset lock_timeout;
select 'passed' as result,
  array['50th accepted / 51st blocked','300th accepted / 301st blocked',
    'shared sample/full/counterexample quota','idempotent retries',
    '24-hour expiry','one pending submission per user','fixtures rolled back',
    'service-only reservation'] as checks;
