-- Calendar connections (Google Calendar and the calendar link). Idempotent: paste into Supabase → SQL Editor → Run.
create table if not exists public.calendar_links (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Google Calendar: the refresh token is encrypted by the server (AES-256-GCM) before it is stored here,
  -- so the row is useless without the server's key
  google_token text,
  google_email text,
  google_calendar_id text,
  google_status text,                         -- connected | error
  google_error text,
  event_map jsonb not null default '{}',      -- session id -> { h: fingerprint, d: date } of the event in Google
  -- calendar link (.ics): the secret part of the address; null = no link
  feed_token text unique,
  -- the sessions the app sent last, with the time zone: what the calendar link serves
  sessions jsonb not null default '[]',
  tz text,
  sig text,                                   -- fingerprint of `sessions`; the app skips a sync when it matches
  synced_at timestamptz,
  updated_at timestamptz not null default now()
);
-- "Show my other events" (added 30 Oct): what Google allowed, the switch, and which calendars to show.
-- The events themselves are read from Google when the Plan page opens and are never stored.
alter table public.calendar_links add column if not exists google_scopes text;
alter table public.calendar_links add column if not exists show_events boolean not null default false;
alter table public.calendar_links add column if not exists read_calendars jsonb;
alter table public.calendar_links enable row level security;
drop policy if exists "own calendar" on public.calendar_links;
create policy "own calendar" on public.calendar_links for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The calendar link is opened by Apple Calendar, Outlook or Google without a login: this returns the sessions for
-- one secret token and nothing else.
create or replace function public.calendar_feed(t text)
returns table (sessions jsonb, tz text)
language sql security definer set search_path = public stable as $$
  select c.sessions, c.tz from public.calendar_links c where length(t) >= 32 and c.feed_token = t;
$$;
revoke all on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;
