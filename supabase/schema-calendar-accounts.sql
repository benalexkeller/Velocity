-- Outlook and Apple calendars (2 Nov 2026). Idempotent: paste into Supabase → SQL Editor → Run. Needs schema.sql and
-- schema-calendar.sql first. Google Calendar stays in calendar_links; this table holds the other calendar accounts.
-- One row per athlete and provider:
--   outlook: Microsoft account (Outlook.com, Hotmail, Microsoft 365), connected with Microsoft's sign-in; `secret` is
--            the refresh token, encrypted by the server (AES-256-GCM) before it is stored.
--   apple:   iCloud, connected with the athlete's Apple ID and an app-specific password made at account.apple.com;
--            `secret` is that password, encrypted the same way. The athlete can withdraw it there at any time.
-- `write_training`: Velocity keeps a "Velocity training" calendar in that account. `show_events`: the athlete's other
-- events from that account are shown read-only on the Plan page; they are read live and never stored.
create table if not exists public.calendar_accounts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('outlook', 'apple')),
  email text,
  secret text,
  calendar_id text,                         -- the Velocity training calendar: Graph calendar id, or CalDAV address
  home text,                                -- Apple: the address of the account's calendar list
  status text not null default 'connected' check (status in ('connected', 'error')),
  error text,
  write_training boolean not null default true,
  show_events boolean not null default true,
  read_calendars jsonb,                     -- which calendars to show; null = all except Velocity's own
  event_map jsonb not null default '{}',    -- session id -> { h: fingerprint, d: date, e: event id in that calendar }
  sig text,                                 -- fingerprint of the last list fully written
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.calendar_accounts enable row level security;
drop policy if exists "own calendar accounts" on public.calendar_accounts;
create policy "own calendar accounts" on public.calendar_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin → Users → Delete account: what the clean-up needs to remove Velocity's calendars from Outlook and iCloud.
-- Only the admin gets rows; the secrets stay encrypted (the key is on the server only).
drop function if exists public.admin_calendar_accounts(uuid);
create or replace function public.admin_calendar_accounts(p_user uuid)
returns table (provider text, secret text, calendar_id text, home text)
language sql security definer set search_path = public stable as $$
  select a.provider, a.secret, a.calendar_id, a.home from public.calendar_accounts a
  where a.user_id = p_user and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin);
$$;
revoke all on function public.admin_calendar_accounts(uuid) from public, anon;
grant execute on function public.admin_calendar_accounts(uuid) to authenticated;

-- Apple Calendar with one tap: Apple Calendar subscribes to the athlete's calendar link (no password). `apple_feed`
-- says the link was set up from the Apple row; `feed_seen_at` is when a calendar app last fetched the link (nothing
-- else about the request is kept). Written by calendar_feed_seen, which the public link calls with its secret.
alter table public.calendar_links add column if not exists apple_feed boolean not null default false;
alter table public.calendar_links add column if not exists feed_seen_at timestamptz;
create or replace function public.calendar_feed_seen(t text)
returns void
language sql security definer set search_path = public volatile as $$
  update public.calendar_links set feed_seen_at = now()
  where length(t) >= 32 and feed_token = t and (feed_seen_at is null or feed_seen_at < now() - interval '5 minutes');
$$;
revoke all on function public.calendar_feed_seen(text) from public;
grant execute on function public.calendar_feed_seen(text) to anon, authenticated;

-- Admin → Overview and Users: which athletes have Outlook or Apple connected (names of the providers only).
create or replace function public.admin_calendar_providers()
returns table (user_id uuid, providers text[])
language sql security definer set search_path = public stable as $$
  select x.user_id, array_agg(x.provider order by x.provider) from (
    select a.user_id, a.provider from public.calendar_accounts a
    union
    select c.user_id, 'apple' from public.calendar_links c where c.apple_feed and c.feed_token is not null
  ) x
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  group by x.user_id;
$$;
revoke all on function public.admin_calendar_providers() from public, anon;
grant execute on function public.admin_calendar_providers() to authenticated;
