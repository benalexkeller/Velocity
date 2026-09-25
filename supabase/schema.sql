-- Precision Velocity — initial schema (Supabase / Postgres)
-- Mirrors the shapes in src/lib/data/index.ts so the seeded UI swaps to live data without redesign.

create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  units text not null default 'imperial' check (units in ('imperial','metric')),
  city text,
  timezone text default 'UTC',
  availability jsonb,            -- {"weekday_am":"06:30","weekday_pm":"18:00","weekend":"08:00"} etc.
  zones jsonb,                   -- provisional/recalibrated training zones
  created_at timestamptz default now()
);

create table races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  date date not null,
  distance_label text,           -- "140.6", "70.3", "26.2"
  goal text,                     -- "Sub-13"
  splits jsonb,                  -- {"swim":1.5,"bike":6.4,"run":4.75,"transitions":0.35}
  priority text default 'A'
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  race_id uuid references races(id),
  start_date date not null,
  weeks int not null,
  philosophy text,
  created_at timestamptz default now()
);

create table plan_weeks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  week int not null,
  start_date date not null,
  phase text not null,
  focus text,
  recovery boolean default false,
  race boolean default false,
  unique (plan_id, week)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  plan_week_id uuid not null references plan_weeks(id) on delete cascade,
  date date not null,
  start_time time,               -- set from availability, movable by coach/drag
  minutes int not null default 0,
  sport text not null,           -- swim|bike|run|strength|rest|hike|other|brick
  title text,
  detail text,
  text text,                     -- full prescription
  intensity text,
  why text,
  status text default 'planned', -- planned|done|missed|modified
  calendar_event_id text         -- Google/Outlook event id when synced
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  start_time time,
  sport text not null,
  name text,
  minutes int not null,
  miles numeric, pace_s int, mph numeric, yards int, p100_s int,
  avg_hr int, elev_ft int,
  route jsonb,                   -- [[lat,lon],...] simplified
  source text not null default 'manual',  -- garmin|whoop|strava|manual
  external_id text,              -- provider activity id (dedupe)
  note text, exertion int, feel text,
  coach_note text,
  created_at timestamptz default now(),
  unique (user_id, source, external_id)
);

create table body_metrics (
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  vo2 numeric, rhr int, hrv int, sleep_score int, sleep_h numeric, weight numeric,
  source text default 'garmin',
  primary key (user_id, date)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  week int not null,
  date date not null,
  summary text,
  flags jsonb, changes jsonb,
  performance numeric, body numeric, components jsonb
);

create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','coach','action')),
  text text not null,
  context jsonb,                 -- e.g. {"screen":"plan","week":3}
  created_at timestamptz default now()
);

create table plan_changes (       -- the change log / Undo
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid references plans(id) on delete cascade,
  reason text,
  diff jsonb not null,           -- before/after of affected sessions
  proposed_by text default 'coach',
  status text default 'applied', -- proposed|applied|declined|undone
  created_at timestamptz default now()
);

create table integrations (
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,        -- garmin|whoop|strava|google_calendar|outlook
  access_token text, refresh_token text, expires_at timestamptz,
  external_user_id text,
  status text default 'connected',
  primary key (user_id, provider)
);

-- Row-level security: every table is private to its owner.
alter table profiles enable row level security;
alter table races enable row level security;
alter table plans enable row level security;
alter table plan_weeks enable row level security;
alter table sessions enable row level security;
alter table activities enable row level security;
alter table body_metrics enable row level security;
alter table reviews enable row level security;
alter table coach_messages enable row level security;
alter table plan_changes enable row level security;
alter table integrations enable row level security;

create policy "own profile" on profiles for all using (auth.uid() = id);
create policy "own races" on races for all using (auth.uid() = user_id);
create policy "own plans" on plans for all using (auth.uid() = user_id);
create policy "own plan weeks" on plan_weeks for all using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own sessions" on sessions for all using (exists (select 1 from plan_weeks w join plans p on p.id = w.plan_id where w.id = plan_week_id and p.user_id = auth.uid()));
create policy "own activities" on activities for all using (auth.uid() = user_id);
create policy "own body" on body_metrics for all using (auth.uid() = user_id);
create policy "own reviews" on reviews for all using (auth.uid() = user_id);
create policy "own coach messages" on coach_messages for all using (auth.uid() = user_id);
create policy "own plan changes" on plan_changes for all using (auth.uid() = user_id);
create policy "own integrations" on integrations for all using (auth.uid() = user_id);
