-- Coach v2: a Coach message can carry a proposed plan change, and the athlete's decision on it.
-- Idempotent: paste into Supabase → SQL Editor → Run. Safe to run again.
alter table public.coach_messages add column if not exists proposal jsonb;
alter table public.coach_messages add column if not exists status text; -- open | accepted | declined
create index if not exists coach_messages_user_day on public.coach_messages (user_id, created_at);
