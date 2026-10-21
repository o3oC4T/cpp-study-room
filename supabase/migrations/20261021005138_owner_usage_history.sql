create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  username text not null,
  event_type text not null check (event_type in ('login','password_changed','account_created','submission_created','submission_finished')),
  problem_id text,
  mode text,
  status text,
  submission_id uuid,
  created_at timestamptz not null default now()
);
create index usage_events_username_id on public.usage_events(username,id desc);
alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;
grant select on public.usage_events to authenticated;
grant all on public.usage_events to service_role;
grant usage,select on sequence public.usage_events_id_seq to service_role;
create policy owner_read_usage on public.usage_events for select to authenticated using (
  exists (select 1 from public.members m where m.user_id=(select auth.uid())
    and m.role='owner' and m.active and not m.must_change_password)
);

-- Authentication fields are maintained by Auth, not supplied by the browser.
-- The trigger keeps only the event; passwords, hashes, tokens and IPs are never copied.
create function private.capture_auth_usage() returns trigger
language plpgsql security definer set search_path='' as $$
declare member_name text;
begin
  select username into member_name from public.members where user_id=new.id;
  if member_name is null then return new; end if;
  if new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.usage_events(user_id,username,event_type,created_at)
      values(new.id,member_name,'login',new.last_sign_in_at);
  end if;
  if new.encrypted_password is distinct from old.encrypted_password then
    insert into public.usage_events(user_id,username,event_type)
      values(new.id,member_name,'password_changed');
  end if;
  return new;
end $$;
revoke all on function private.capture_auth_usage() from public,anon,authenticated;
create trigger classroom_auth_usage after update of last_sign_in_at,encrypted_password on auth.users
  for each row execute function private.capture_auth_usage();

create function private.capture_member_usage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.usage_events(user_id,username,event_type,created_at)
    values(new.user_id,new.username,'account_created',new.created_at);
  return new;
end $$;
revoke all on function private.capture_member_usage() from public,anon,authenticated;
create trigger classroom_member_usage after insert on public.members
  for each row execute function private.capture_member_usage();

create function private.capture_submission_usage() returns trigger
language plpgsql security definer set search_path='' as $$
declare member_name text;
begin
  select username into member_name from public.members where user_id=new.user_id;
  if member_name is null then return new; end if;
  if tg_op='INSERT' then
    insert into public.usage_events(user_id,username,event_type,problem_id,mode,status,submission_id,created_at)
      values(new.user_id,member_name,'submission_created',new.problem_id,new.mode,new.status,new.id,new.created_at);
  elsif new.status is distinct from old.status and new.status not in ('preparing','queued','running') then
    insert into public.usage_events(user_id,username,event_type,problem_id,mode,status,submission_id)
      values(new.user_id,member_name,'submission_finished',new.problem_id,new.mode,new.status,new.id);
  end if;
  return new;
end $$;
revoke all on function private.capture_submission_usage() from public,anon,authenticated;
create trigger classroom_submission_usage after insert or update of status on public.submissions
  for each row execute function private.capture_submission_usage();

-- Preserve the issuance time of the accounts already provisioned before this feature.
insert into public.usage_events(user_id,username,event_type,created_at)
  select user_id,username,'account_created',created_at from public.members order by created_at;
