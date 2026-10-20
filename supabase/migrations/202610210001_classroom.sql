create table public.members (
  github_id text primary key check (github_id ~ '^[0-9]{1,20}$'),
  github_login text not null,
  user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'student' check (role in ('owner', 'student')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null check (problem_id in ('midterm-1','midterm-2','midterm-3','midterm-4')),
  mode text not null check (mode in ('sample','full','counterexample')),
  source text not null check (octet_length(source) between 1 and 65536),
  status text not null default 'preparing'
    check (status in ('preparing','queued','running','accepted','wrong_answer','compile_error',
                     'runtime_error','time_limit','memory_limit','output_limit','system_error','counterexample_found','no_counterexample')),
  commit_sha text,
  run_id bigint,
  last_polled_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (user_id, request_id)
);
create index submissions_user_created on public.submissions(user_id, created_at desc);
create index submissions_created on public.submissions(created_at);

alter table public.members enable row level security;
alter table public.submissions enable row level security;
revoke all on public.members, public.submissions from anon, authenticated;
grant select on public.members, public.submissions to authenticated;
grant all on public.members, public.submissions to service_role;
create policy member_read_self on public.members for select to authenticated using (user_id = auth.uid());
create policy submission_read_self on public.submissions for select to authenticated using (
  user_id = auth.uid() and exists (select 1 from public.members m where m.user_id = auth.uid() and m.active)
);

-- Trusted Edge Function only. One lock makes limits/idempotency atomic across users.
create function public.reserve_submission(
  p_user uuid, p_request uuid, p_problem text, p_mode text, p_source text
) returns public.submissions language plpgsql security definer set search_path = '' as $$
declare item public.submissions;
begin
  perform pg_advisory_xact_lock(731604210);
  if not exists(select 1 from public.members where user_id = p_user and active) then
    raise exception '초대된 계정만 제출할 수 있어요.';
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
  if (select count(*) from public.submissions where user_id = p_user and created_at > now() - interval '1 day') >= 5 then
    raise exception '하루 제출 한도(5회)에 도달했어요.';
  end if;
  if (select count(*) from public.submissions where created_at > now() - interval '1 day') >= 20 then
    raise exception '오늘 연습실의 채점 한도(20회)에 도달했어요.';
  end if;
  insert into public.submissions(request_id,user_id,problem_id,mode,source)
    values(p_request,p_user,p_problem,p_mode,p_source) returning * into item;
  return item;
end $$;
revoke all on function public.reserve_submission(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_submission(uuid,uuid,text,text,text) to service_role;

create function public.claim_result_poll(p_id uuid,p_user uuid) returns boolean
language sql security definer set search_path = '' as $$
  with claimed as (
    update public.submissions set last_polled_at = now()
    where id = p_id and user_id = p_user and status in ('preparing','queued','running')
      and (last_polled_at is null or last_polled_at < now() - interval '5 seconds')
    returning id
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_result_poll(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_result_poll(uuid,uuid) to service_role;

-- Existing connected GitHub account; membership cannot be self-assigned by the client.
insert into public.members(github_id,github_login,role)
values ('261565264','o3oC4T','owner');
