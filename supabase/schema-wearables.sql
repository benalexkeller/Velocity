-- Wearable connections, all makers in one place (3 Nov 2026). Idempotent: paste into Supabase → SQL Editor → Run.
-- Needs schema.sql and schema-integrations.sql first (the `integrations` table is reused, one row per athlete and
-- maker). What each maker needs:
--   garmin  via 'direct'   Garmin's own developer program (keys in Vercel), or via 'junction' (the middleman)
--   whoop   via 'direct'   WHOOP's developer platform (keys in Vercel)
--   apple   via 'app'      the Velocity iPhone app sends Apple Health workouts to /api/wearables/apple/import
-- `secret` holds the maker's sign-in tokens, encrypted by the server (AES-256-GCM) before they are stored.

alter table public.integrations add column if not exists secret text;             -- sealed tokens (direct connections)
alter table public.integrations add column if not exists scopes text;             -- what the maker allowed
alter table public.integrations add column if not exists expires_at timestamptz;  -- when the access token runs out
alter table public.integrations add column if not exists refreshing_at timestamptz; -- a token refresh is under way (lock)
alter table public.integrations add column if not exists synced_at timestamptz;   -- last successful history pull
alter table public.integrations add column if not exists device text;             -- e.g. "Forerunner 965", "Apple Watch Series 11"

-- activities: which maker an activity came from, and duplicates between makers (the same run recorded by two devices).
-- `dup_of`: the id of the activity that counts instead (this one is excluded), or 'keep' when the athlete chose to keep
-- both. source: garmin | whoop | apple | coros | polar | suunto | wahoo | manual
alter table public.activities add column if not exists dup_of text;
alter table public.activities add column if not exists external_id text;          -- the maker's own id
alter table public.activities add column if not exists kcal int;
alter table public.activities add column if not exists strain numeric;            -- WHOOP strain (0–21)

-- body_metrics: per-day values can come from more than one maker; `src` remembers which maker set each column
-- ({"hrv":"whoop","rhr":"garmin"}), so a maker that measures a value better is not overwritten by another.
alter table public.body_metrics add column if not exists src jsonb not null default '{}';
alter table public.body_metrics add column if not exists recovery int;            -- WHOOP recovery %, Garmin Body Battery at wake
alter table public.body_metrics add column if not exists strain numeric;          -- WHOOP day strain
alter table public.body_metrics add column if not exists weight_kg numeric;       -- from a connected scale (Garmin bodyComps)

-- One token refresh at a time per connection (WHOOP and Garmin hand out a new refresh token on every use and
-- cancel the old one). Returns true when the caller got the lock. Row-level security applies: an athlete can only
-- lock their own row; the server's service role can lock any.
create or replace function public.wearable_refresh_lock(p_user uuid, p_provider text)
returns boolean language sql volatile as $$
  update public.integrations set refreshing_at = now()
  where user_id = p_user and provider = p_provider and (refreshing_at is null or refreshing_at < now() - interval '20 seconds')
  returning true;
$$;
grant execute on function public.wearable_refresh_lock(uuid, text) to authenticated, service_role;

-- Delete my account / Admin delete: everything the clean-up needs to end the connections at the makers.
drop function if exists public.admin_wearables(uuid);
create or replace function public.admin_wearables(p_user uuid)
returns table (provider text, via text, external_user_id text, secret text)
language sql security definer set search_path = public stable as $$
  select i.provider, i.via, i.external_user_id, i.secret from public.integrations i
  where i.user_id = p_user and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin);
$$;
revoke all on function public.admin_wearables(uuid) from public, anon;
grant execute on function public.admin_wearables(uuid) to authenticated;

-- Admin → Users: every connected maker per athlete ("garmin, whoop").
create or replace function public.admin_wearable_providers()
returns table (user_id uuid, providers text[])
language sql security definer set search_path = public stable as $$
  select i.user_id, array_agg(i.provider order by i.provider) from public.integrations i
  where i.status = 'connected' and exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  group by i.user_id;
$$;
revoke all on function public.admin_wearable_providers() from public, anon;
grant execute on function public.admin_wearable_providers() to authenticated;
