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
