-- Velocity — accounts v1 (Supabase / Postgres)
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run once on a fresh project.
--
-- One row per user in each table; every table is locked with row-level security so a signed-in
-- user can only ever read or write their own rows. The shapes mirror src/lib/store.tsx so the app's
-- local (browser) mode and the account mode are the same data with a different home.

create extension if not exists "pgcrypto";

-- ---------- profiles: one per auth user, created automatically on sign-up ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text unique,
  name text,
  avatar_url text,
  units text not null default 'imperial' check (units in ('imperial','metric')),
  timezone text not null default 'America/Los_Angeles',
  city text,
  -- {"days":[1,2,3,4,5,6,0], "weekday_am":"06:30", "weekday_pm":"18:00", "weekend":"08:00"}
  availability jsonb not null default '{"days":[1,2,3,4,5,6,0],"weekday_am":"06:30","weekday_pm":"18:00","weekend":"08:00"}'::jsonb,
  zones jsonb,
  is_admin boolean not null default false,
  setup_done boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$')
);

-- ---------- race: the one the plan points at ----------
create table if not exists public.races (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null,
  date date not null,
  distance text not null default '140.6',   -- 140.6 | 70.3 | marathon | half | olympic | sprint | other
  distance_label text,
  goal text,                                -- "Sub-13"
  goal_hours numeric,                       -- 13
  splits jsonb,                             -- {"swim":1.5,"bike":6.4,"run":4.75,"transitions":0.35}
  location text,
  updated_at timestamptz not null default now()
);

-- ---------- plan: the week-by-week programme as JSON (same shape as the seed file) ----------
create table if not exists public.plans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weeks jsonb not null default '[]'::jsonb,  -- [{week,start,phase,focus,recovery,race,days:[{text,min}]}]
  intake jsonb,                              -- the plan builder's answers (goal, history, fitness, time, devices, strength)
  updated_at timestamptz not null default now()
);
alter table public.plans add column if not exists intake jsonb;

-- ---------- plan state: the athlete's own changes layered over the plan ----------
create table if not exists public.plan_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  patches jsonb not null default '{}'::jsonb, -- {sessionId: {date,start,min,intensity,text,sport,deleted}}
  added jsonb not null default '[]'::jsonb,   -- [{id,date,start,min,sport,intensity,text}]
  undone boolean not null default false,
  calendar boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- activities: Garmin imports and manual logs ----------
create table if not exists public.activities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  date date not null,
  start text,
  sport text not null,
  name text not null,
  min int not null,
  mi numeric, yd int, pace_s int, mph numeric, p100_s int,
  hr int, elev_ft int,
  route jsonb,
  source text not null default 'manual',      -- garmin | manual
  note text, exertion int, feel text, coach_note text,
  excluded boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists activities_user_date on public.activities (user_id, date);

-- ---------- body metrics (Garmin daily) ----------
create table if not exists public.body_metrics (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  rhr int, hrv int, sleep_h numeric, sleep_score int, stress int, vo2 numeric,
  primary key (user_id, date)
);

-- ---------- coach thread ----------
create table if not exists public.coach_messages (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  who text not null,       -- You | Coach | action
  at text,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_messages_user on public.coach_messages (user_id, id);

-- ---------- beta feedback: what athletes tell us, with the page they were on ----------
create table if not exists public.feedback (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  username text,
  tab text not null default 'general',     -- general | dashboard | plan | activities | analysis | nutrition | store | calculator | account
  kind text not null default 'other',      -- bug | confusing | idea | data | other
  message text not null,
  page text, ua text, viewport text,
  status text not null default 'open',     -- open | done
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "insert own feedback" on public.feedback;
create policy "insert own feedback" on public.feedback for insert with check (auth.uid() = user_id);
drop policy if exists "read own feedback" on public.feedback;
create policy "read own feedback" on public.feedback for select using (auth.uid() = user_id);
create or replace function public.admin_feedback()
returns setof public.feedback language sql security definer set search_path = public stable as $$
  select * from public.feedback
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  order by created_at desc;
$$;
create or replace function public.admin_feedback_status(fid bigint, s text)
returns void language sql security definer set search_path = public as $$
  update public.feedback set status = s where id = fid
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin);
$$;

-- ---------- who is admin: any sign-up with one of these emails gets the admin flag ----------
create table if not exists public.admin_emails (email text primary key);
insert into public.admin_emails (email) values ('benalexkeller@gmail.com') on conflict do nothing;
alter table public.admin_emails enable row level security; -- no policies: not readable through the API

-- ---------- a profile row for every new sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    lower(coalesce(new.email, '')) in (select lower(email) from public.admin_emails)
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- row-level security: your rows only ----------
alter table public.profiles enable row level security;
alter table public.races enable row level security;
alter table public.plans enable row level security;
alter table public.plan_state enable row level security;
alter table public.activities enable row level security;
alter table public.body_metrics enable row level security;
alter table public.coach_messages enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "own race" on public.races;
create policy "own race" on public.races for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own plan" on public.plans;
create policy "own plan" on public.plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own plan state" on public.plan_state;
create policy "own plan state" on public.plan_state for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own activities" on public.activities;
create policy "own activities" on public.activities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own body" on public.body_metrics;
create policy "own body" on public.body_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own thread" on public.coach_messages;
create policy "own thread" on public.coach_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- nobody can promote themselves: is_admin only changes through SQL here
create or replace function public.protect_admin_flag()
returns trigger language plpgsql as $$
begin
  if new.is_admin is distinct from old.is_admin and current_setting('request.jwt.claims', true) is not null then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_admin on public.profiles;
create trigger profiles_protect_admin before update on public.profiles
  for each row execute procedure public.protect_admin_flag();

-- ---------- username availability (anyone signed in may ask) ----------
create or replace function public.username_taken(u text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where username = lower(u) and id <> auth.uid());
$$;

-- ---------- admin: the user list ----------
create or replace function public.admin_users()
returns table (id uuid, email text, username text, name text, created_at timestamptz, last_seen timestamptz, setup_done boolean, race text, race_date date, activities int)
language sql security definer set search_path = public stable as $$
  select p.id, p.email, p.username, p.name, p.created_at, p.last_seen, p.setup_done, r.name, r.date,
         (select count(*)::int from public.activities a where a.user_id = p.id)
  from public.profiles p
  left join public.races r on r.user_id = p.id
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  order by p.created_at desc;
$$;

-- ---------- "seen" stamp, called when the app loads ----------
create or replace function public.touch_profile()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

-- ---------- make the admin flag right for accounts that already exist ----------
update public.profiles p set is_admin = true where lower(p.email) in (select lower(email) from public.admin_emails);
