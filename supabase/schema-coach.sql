-- Coach v2: a Coach message can carry a proposed plan change, the athlete's decision on it, the library
-- passages it cited and which model tier answered. Idempotent: paste into Supabase → SQL Editor → Run.
alter table public.coach_messages add column if not exists proposal jsonb;
alter table public.coach_messages add column if not exists status text; -- open | accepted | declined
alter table public.coach_messages add column if not exists sources jsonb;
alter table public.coach_messages add column if not exists tier text;   -- fast | strong | none
create index if not exists coach_messages_user_day on public.coach_messages (user_id, created_at);

-- ---------- the coach's reference library: passages the admin adds or edits here ----------
-- The app ships with its own passages (src/lib/coach/library-data.ts); a row with the same id replaces that one.
create table if not exists public.library (
  id text primary key,                       -- slug, e.g. "cramps"
  title text not null,
  topic text not null,                       -- training | metrics | nutrition | recovery | injury | race | environment | equipment
  grade text not null default 'C',           -- A | B | C (evidence)
  tags text[] not null default '{}',
  body text not null,                        -- the passage, plain text, 80–250 words
  source text not null,                      -- the citation as it should appear
  url text,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.library enable row level security;
drop policy if exists "library read" on public.library;
create policy "library read" on public.library for select using (auth.uid() is not null);
-- only the admin writes, through this function
create or replace function public.admin_library_upsert(p_id text, p_title text, p_topic text, p_grade text, p_tags text[], p_body text, p_source text, p_url text, p_published boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.library (id, title, topic, grade, tags, body, source, url, published, updated_at)
  select p_id, p_title, p_topic, p_grade, p_tags, p_body, p_source, p_url, p_published, now()
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  on conflict (id) do update set title = excluded.title, topic = excluded.topic, grade = excluded.grade, tags = excluded.tags, body = excluded.body, source = excluded.source, url = excluded.url, published = excluded.published, updated_at = now();
$$;
create or replace function public.admin_library_delete(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.library where id = p_id and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin);
$$;
