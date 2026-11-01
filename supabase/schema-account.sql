-- "Delete my account" (Profile). Idempotent: paste into Supabase → SQL Editor → Run.
-- Deletes the signed-in athlete's login. Every table that belongs to the athlete references profiles, which references
-- the login, with "on delete cascade", so plan, activities, body data, nutrition, coach messages and connections go
-- with it. Feedback is kept "on delete set null" for other reasons, so the athlete's own feedback rows are deleted first.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.feedback where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- The optional "why are you deleting your account" answer, saved just before the deletion with no link to the person
-- (user_id empty), so it is kept. Only a signed-in athlete can send one.
drop policy if exists "account deleted reason" on public.feedback;
create policy "account deleted reason" on public.feedback for insert to authenticated
  with check (tab = 'account-deleted' and user_id is null);
