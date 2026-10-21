alter policy member_read_self on public.members using (user_id = (select auth.uid()));
alter policy submission_read_self on public.submissions using (
  user_id = (select auth.uid()) and exists (
    select 1 from public.members m where m.user_id = (select auth.uid()) and m.active
  )
);
