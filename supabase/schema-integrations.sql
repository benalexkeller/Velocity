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

-- admin: every athlete's connection, and the last webhook calls
create or replace function public.admin_integrations()
returns table (user_id uuid, email text, username text, provider text, via text, status text, connected_at timestamptz, last_event_at timestamptz, error text)
language sql security definer set search_path = public stable as $$
  select i.user_id, p.email, p.username, i.provider, i.via, i.status, i.connected_at, i.last_event_at, i.error
  from public.integrations i join public.profiles p on p.id = i.user_id
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  order by i.updated_at desc;
$$;
create or replace function public.admin_webhook_log(n int default 100)
returns setof public.webhook_log language sql security definer set search_path = public stable as $$
  select * from public.webhook_log
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  order by id desc limit n;
$$;
