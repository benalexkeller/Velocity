-- Wearable connections (Garmin through Junction). Idempotent: paste into Supabase → SQL Editor → Run.
create table if not exists public.integrations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,                       -- garmin
  via text not null,                            -- junction
  external_user_id text,                        -- the athlete's id at the middleman
  status text not null default 'pending',       -- pending | connected | error | disconnected
  connected_at timestamptz,
  last_event_at timestamptz,
  error text,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
create index if not exists integrations_external on public.integrations (via, external_user_id);
alter table public.integrations enable row level security;
drop policy if exists "own integrations" on public.integrations;
create policy "own integrations" on public.integrations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Every webhook call, kept 30 days for debugging (service role writes; athletes cannot read it).
create table if not exists public.webhook_log (
  id bigserial primary key,
  via text not null,
  event_type text,
  external_user_id text,
  ok boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table public.webhook_log enable row level security;
