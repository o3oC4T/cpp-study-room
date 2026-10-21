-- Daily limits are independent of GitHub monthly billing quotas.
-- Apply only after confirming that paid Actions overage is blocked.
create or replace function public.reserve_submission(
  p_user uuid, p_request uuid, p_problem text, p_mode text, p_source text
) returns public.submissions language plpgsql security definer set search_path = '' as $$
declare item public.submissions;
begin
  perform pg_advisory_xact_lock(731604210);
  if not exists(select 1 from public.members where user_id = p_user and active and not must_change_password) then
    raise exception '운영자가 발급하고 초기 비밀번호 변경을 마친 계정만 제출할 수 있어요.';
  end if;
  select * into item from public.submissions where user_id = p_user and request_id = p_request;
  if found then return item; end if;
  -- Retire interrupted requests so they cannot block a student indefinitely.
  update public.submissions set status = 'system_error', finished_at = now(),
    result = '{"message":"채점 연결이 중단되었습니다. 다시 제출해 주세요."}'::jsonb
    where status in ('preparing','queued','running') and created_at < now() - interval '20 minutes';
  if exists(select 1 from public.submissions where user_id = p_user and status in ('preparing','queued','running')) then
    raise exception '진행 중인 채점이 끝난 뒤 제출해 주세요.';
  end if;
  if (select count(*) from public.submissions where user_id = p_user and created_at > now() - interval '1 day') >= 50 then
    raise exception '하루 제출 한도(50회)에 도달했어요.';
  end if;
  if (select count(*) from public.submissions where created_at > now() - interval '1 day') >= 300 then
    raise exception '오늘 연습실의 채점 한도(300회)에 도달했어요.';
  end if;
  insert into public.submissions(request_id,user_id,problem_id,mode,source)
    values(p_request,p_user,p_problem,p_mode,p_source) returning * into item;
  return item;
end $$;
revoke all on function public.reserve_submission(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_submission(uuid,uuid,text,text,text) to service_role;
