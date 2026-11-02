-- Admin panel (2 Nov 2026): plans and access, an audit log, coach usage and cost, account actions.
-- Idempotent: paste into Supabase → SQL Editor → Run. Needs schema.sql, schema-integrations.sql, schema-calendar.sql,
-- schema-coach.sql and schema-account.sql first (all already run on the live project).
--
-- Rule: the admin sees account facts and counts, never an athlete's own data (workouts, meals, body data, coach
-- messages, calendar events). Nothing below returns any of it.

-- ---------- who is the admin (used by every function below) ----------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- ---------- access: Free, Trial, Pro (paid) or Free Pro (given by the admin) ----------
-- A row only for athletes who have more than Free. Athletes can read their own row and nothing else; only the admin
-- functions below write it (and, later, the Stripe webhook with the server key). Nothing in the app is locked by it yet.
create table if not exists public.access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('trial', 'comp', 'paid')),   -- comp = Free Pro, given by the admin
  ends_at timestamptz,                                              -- null = no end date
  note text,
  stripe_customer text,
  stripe_subscription text,
  granted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.access enable row level security;
drop policy if exists "read own access" on public.access;
create policy "read own access" on public.access for select using (auth.uid() = user_id);

-- what the athlete has right now: free | trial | pro | free_pro | ended
create or replace function public.access_status(k text, ends timestamptz)
returns text language sql stable as $$
  select case
    when k is null then 'free'
    when ends is not null and ends <= now() then 'ended'
    when k = 'paid' then 'pro'
    when k = 'comp' then 'free_pro'
    else 'trial' end;
$$;

-- ---------- audit log: every admin action, newest first ----------
-- user_id empties itself when that account is deleted (no personal data is kept after a deletion).
create table if not exists public.admin_audit (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  admin_id uuid references public.profiles(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  detail text
);
alter table public.admin_audit enable row level security; -- no policies: only through the admin functions

-- ---------- deleted accounts: a date, nothing else ----------
create table if not exists public.account_deletions (
  id bigserial primary key,
  deleted_at timestamptz not null default now(),
  by_admin boolean not null default false
);
alter table public.account_deletions enable row level security; -- no policies

-- "Delete my account" now also counts the deletion (same function as schema-account.sql, which has the same body)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.feedback where user_id = uid;
  insert into public.account_deletions (by_admin) values (false);
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- the optional reason saved before a deletion (schema-account.sql; repeated here so it is in place)
drop policy if exists "account deleted reason" on public.feedback;
create policy "account deleted reason" on public.feedback for insert to authenticated
  with check (tab = 'account-deleted' and user_id is null);

-- ---------- coach usage: one row per coach request, no message content ----------
-- Written by /api/coach with the athlete's own login. Kept after an account is deleted, without the link to it.
create table if not exists public.coach_usage (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  tier text not null check (tier in ('fast', 'strong', 'capped', 'failed')),
  model text,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(12, 6)
);
create index if not exists coach_usage_at on public.coach_usage (created_at);
create index if not exists coach_usage_user on public.coach_usage (user_id, created_at);
alter table public.coach_usage enable row level security;
drop policy if exists "log own coach usage" on public.coach_usage;
create policy "log own coach usage" on public.coach_usage for insert to authenticated with check (auth.uid() = user_id);

-- ---------- Overview: counts only ----------
create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = public, auth stable as $$
declare r jsonb;
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'users', (select count(*) from profiles),
    'new_7', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'new_30', (select count(*) from profiles where created_at > now() - interval '30 days'),
    'active_1', (select count(*) from profiles where last_seen > now() - interval '1 day'),
    'active_7', (select count(*) from profiles where last_seen > now() - interval '7 days'),
    'active_30', (select count(*) from profiles where last_seen > now() - interval '30 days'),
    'setup_done', (select count(*) from profiles where setup_done),
    'has_plan', (select count(*) from plans where jsonb_array_length(weeks) > 0),
    'has_activity', (select count(distinct user_id) from activities),
    'watch', (select count(distinct user_id) from integrations where status = 'connected'),
    'calendar', (select count(*) from calendar_links where google_token is not null),
    'coach_users_30', (select count(distinct user_id) from coach_messages where who = 'You' and created_at > now() - interval '30 days'),
    'google_signin', (select count(*) from auth.users where raw_app_meta_data ->> 'provider' = 'google'),
    'disabled', (select count(*) from auth.users where banned_until > now()),
    'trial', (select count(*) from access where public.access_status(kind, ends_at) = 'trial'),
    'pro', (select count(*) from access where public.access_status(kind, ends_at) = 'pro'),
    'free_pro', (select count(*) from access where public.access_status(kind, ends_at) = 'free_pro'),
    'deleted_30', (select count(*) from account_deletions where deleted_at > now() - interval '30 days'),
    'deleted_all', (select count(*) from account_deletions),
    'coach_cost_30', (select coalesce(sum(cost_usd), 0) from coach_usage where created_at > now() - interval '30 days'),
    -- sign-ups per week, last 12 weeks (Monday starts a week), oldest first
    'signups', (select jsonb_agg(jsonb_build_object('week', w::date, 'n', (select count(*) from profiles p where p.created_at >= w and p.created_at < w + interval '7 days')) order by w)
                from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w)
  ) into r;
  return r;
end;
$$;

-- ---------- Users: one row per account, account facts and counts only ----------
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (
  id uuid, email text, username text, name text, created_at timestamptz, last_seen timestamptz, setup_done boolean,
  race text, race_date date, activities int, plan_weeks int, signin text, watch text, calendar boolean,
  coach_30 int, access text, access_kind text, access_ends timestamptz, access_note text, disabled boolean, is_admin boolean
)
language sql security definer set search_path = public, auth stable as $$
  select p.id, p.email, p.username, p.name, p.created_at, p.last_seen, p.setup_done, r.name, r.date,
         (select count(*)::int from activities a where a.user_id = p.id),
         (select jsonb_array_length(pl.weeks) from plans pl where pl.user_id = p.id),
         coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
         (select i.status from integrations i where i.user_id = p.id and i.provider = 'garmin'),
         exists (select 1 from calendar_links c where c.user_id = p.id and c.google_token is not null),
         (select count(*)::int from coach_messages m where m.user_id = p.id and m.who = 'You' and m.created_at > now() - interval '30 days'),
         public.access_status(x.kind, x.ends_at), x.kind, x.ends_at, x.note,
         coalesce(u.banned_until > now(), false), p.is_admin
  from profiles p
  left join auth.users u on u.id = p.id
  left join races r on r.user_id = p.id
  left join access x on x.user_id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;

-- ---------- Give or change access ----------
-- p_kind: 'free' (remove), 'trial' or 'comp' (Free Pro). 'paid' is only set by Stripe.
create or replace function public.admin_set_access(p_user uuid, p_kind text, p_ends timestamptz, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.access; what text;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_kind not in ('free', 'trial', 'comp') then raise exception 'unknown access kind %', p_kind; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'no such account'; end if;
  select * into cur from access where user_id = p_user;
  if found and cur.kind = 'paid' then raise exception 'This athlete pays through Stripe. Change it in Stripe.'; end if;
  if p_ends is not null and p_ends <= now() then raise exception 'The end date is in the past.'; end if;
  if p_kind = 'free' then
    delete from access where user_id = p_user;
    what := 'Free';
  else
    insert into access (user_id, kind, ends_at, note, granted_by, updated_at)
    values (p_user, p_kind, p_ends, nullif(trim(p_note), ''), auth.uid(), now())
    on conflict (user_id) do update set kind = excluded.kind, ends_at = excluded.ends_at, note = excluded.note,
      granted_by = excluded.granted_by, updated_at = now();
    what := case p_kind when 'comp' then 'Free Pro' else 'Trial' end
      || case when p_ends is null then ', no end date' else ' until ' || to_char(p_ends, 'YYYY-MM-DD') end;
  end if;
  insert into admin_audit (admin_id, user_id, action, detail)
  values (auth.uid(), p_user, 'access', what || coalesce(' (' || nullif(trim(p_note), '') || ')', ''));
end;
$$;

-- ---------- Disable or re-enable an account ----------
-- A disabled athlete cannot sign in; their sessions end (a page already open works until its login expires, at most
-- an hour). Nothing is deleted.
create or replace function public.admin_set_disabled(p_user uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'You cannot disable your own account.'; end if;
  if exists (select 1 from profiles where id = p_user and is_admin) then raise exception 'Admin accounts cannot be disabled here.'; end if;
  update auth.users set banned_until = case when p_disabled then 'infinity'::timestamptz else null end where id = p_user;
  if p_disabled then
    delete from auth.refresh_tokens where user_id = p_user::text;
    delete from auth.sessions where user_id = p_user;
  end if;
  insert into admin_audit (admin_id, user_id, action, detail)
  values (auth.uid(), p_user, case when p_disabled then 'disabled' else 'enabled' end, null);
end;
$$;

-- ---------- Delete an account (the server route /api/admin/delete runs the outside clean-up first) ----------
-- What the clean-up needs: the encrypted Google key and calendar id, and the Garmin connection id.
create or replace function public.admin_external_links(p_user uuid)
returns table (google_token text, google_calendar_id text, garmin_external_id text)
language sql security definer set search_path = public stable as $$
  select (select c.google_token from calendar_links c where c.user_id = p_user),
         (select c.google_calendar_id from calendar_links c where c.user_id = p_user),
         (select i.external_user_id from integrations i where i.user_id = p_user and i.provider = 'garmin')
  where public.is_admin();
$$;
create or replace function public.admin_delete_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'Use Delete my account in Profile for your own account.'; end if;
  if exists (select 1 from profiles where id = p_user and is_admin) then raise exception 'Admin accounts cannot be deleted here.'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'no such account'; end if;
  -- the log keeps the action and the reason; the link to the person empties with the account (nothing personal is kept)
  insert into admin_audit (admin_id, user_id, action, detail)
  values (auth.uid(), p_user, 'deleted', coalesce(nullif(trim(p_reason), ''), 'no reason given'));
  delete from feedback where user_id = p_user;
  insert into account_deletions (by_admin) values (true);
  delete from auth.users where id = p_user;
end;
$$;

-- ---------- Audit log ----------
create or replace function public.admin_audit_log(n int default 200)
returns table (id bigint, created_at timestamptz, admin text, user_id uuid, athlete text, action text, detail text)
language sql security definer set search_path = public stable as $$
  select a.id, a.created_at, coalesce(ad.username, ad.email), a.user_id, coalesce('@' || p.username, p.email), a.action, a.detail
  from admin_audit a
  left join profiles ad on ad.id = a.admin_id
  left join profiles p on p.id = a.user_id
  where public.is_admin()
  order by a.id desc limit n;
$$;

-- ---------- Coach usage and cost ----------
-- Questions per day come from coach_messages (counts only, no text) so the chart has history from before cost
-- logging started; cost, tokens and models come from coach_usage.
create or replace function public.admin_coach_usage(days int default 30)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare r jsonb; since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(days, 1) - 1);
begin
  if not public.is_admin() then return null; end if;
  select jsonb_build_object(
    'since', since,
    'daily', (select jsonb_agg(jsonb_build_object(
        'day', d::date,
        'questions', (select count(*) from coach_messages m where m.who = 'You' and m.created_at >= d and m.created_at < d + interval '1 day'),
        'athletes', (select count(distinct m.user_id) from coach_messages m where m.who = 'You' and m.created_at >= d and m.created_at < d + interval '1 day'),
        'cost', (select coalesce(sum(u.cost_usd), 0) from coach_usage u where u.created_at >= d and u.created_at < d + interval '1 day')
      ) order by d) from generate_series(since, date_trunc('day', now()), interval '1 day') d),
    'models', (select coalesce(jsonb_agg(x order by x.cost desc), '[]'::jsonb) from (
        select coalesce(model, '(none)') as model, tier, count(*) as requests, coalesce(sum(tokens_in), 0) as tokens_in,
               coalesce(sum(tokens_out), 0) as tokens_out, coalesce(sum(cost_usd), 0) as cost
        from coach_usage where created_at >= since and tier in ('fast', 'strong') group by 1, 2) x),
    'athletes', (select coalesce(jsonb_agg(y order by y.questions desc), '[]'::jsonb) from (
        select p.id, coalesce('@' || p.username, p.email) as who,
               (select count(*) from coach_messages m where m.user_id = p.id and m.who = 'You' and m.created_at >= since) as questions,
               (select coalesce(sum(u.cost_usd), 0) from coach_usage u where u.user_id = p.id and u.created_at >= since) as cost,
               (select count(distinct date_trunc('day', u.created_at)) from coach_usage u where u.user_id = p.id and u.tier = 'capped' and u.created_at >= since) as capped_days
        from profiles p
        where exists (select 1 from coach_messages m where m.user_id = p.id and m.who = 'You' and m.created_at >= since)
        order by questions desc limit 50) y),
    'failed', (select count(*) from coach_usage where tier = 'failed' and created_at >= since),
    'capped', (select count(*) from coach_usage where tier = 'capped' and created_at >= since),
    'logged_from', (select min(created_at) from coach_usage)
  ) into r;
  return r;
end;
$$;

-- only signed-in accounts may call these (each one checks for the admin itself)
do $$
declare f text;
begin
  foreach f in array array['is_admin()', 'admin_overview()', 'admin_users()', 'admin_set_access(uuid, text, timestamptz, text)',
    'admin_set_disabled(uuid, boolean)', 'admin_external_links(uuid)', 'admin_delete_user(uuid, text)', 'admin_audit_log(int)', 'admin_coach_usage(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
