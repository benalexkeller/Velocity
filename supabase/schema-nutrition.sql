-- Velocity — nutrition tracker tables (branch `nutrition`). Paste into Supabase → SQL Editor → Run.
-- Adds new tables only; nothing in schema.sql changes. Every table: own rows only (row-level security).

-- ---------- nutrition profile: collected by the set-up pop-up, editable later ----------
create table if not exists public.nutrition_profile (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  weight_kg numeric,
  height_cm numeric,
  birth_year int,
  sex text check (sex is null or sex in ('male','female','other')),
  goal text not null default 'maintain' check (goal in ('maintain','lose','gain','race_weight')),
  goal_weight_kg numeric,
  base_kcal int,                 -- athlete's own rest-day calories; null = formula
  bottle_ml int not null default 750,
  supplements jsonb not null default '[]'::jsonb,   -- [{id, dose, time}]
  setup_done boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.nutrition_profile add column if not exists base_kcal int;

-- ---------- what was eaten ----------
create table if not exists public.food_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  date date not null,
  meal text not null,            -- breakfast | lunch | dinner | snack | session
  name text not null,
  brand text,
  amount numeric,                -- e.g. 170
  unit text,                     -- g | ml | serving | ...
  kcal numeric not null default 0,
  carbs_g numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  fibre_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  source text not null default 'manual',   -- usda | builtin | custom | manual | quick
  food_id text,                  -- reference into foods (usda-<fdcId> / custom-<id>)
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists food_log_user_date on public.food_log (user_id, date);

-- ---------- foods the athlete has used (recents, favourites, custom foods) ----------
create table if not exists public.foods (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,              -- usda-<fdcId> | builtin-<key> | custom-<uuid>
  name text not null,
  brand text,
  per100 jsonb not null,         -- {kcal, carbs, protein, fat, fibre, sodium} per 100 g (or per 100 ml)
  servings jsonb not null default '[]'::jsonb,   -- [{label, g}]
  source text not null,
  favourite boolean not null default false,
  uses int not null default 0,
  last_used timestamptz,
  primary key (user_id, id)
);

-- ---------- drinks ----------
create table if not exists public.hydration_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null,
  date date not null,
  ml int not null,
  at text,
  primary key (user_id, id)
);
create index if not exists hydration_user_date on public.hydration_log (user_id, date);

-- ---------- body weight ----------
create table if not exists public.weight_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  primary key (user_id, date)
);

-- ---------- supplements taken ----------
create table if not exists public.supplement_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  supplement_id text not null,
  taken_at text,
  primary key (user_id, date, supplement_id)
);

alter table public.nutrition_profile enable row level security;
alter table public.food_log enable row level security;
alter table public.foods enable row level security;
alter table public.hydration_log enable row level security;
alter table public.weight_log enable row level security;
alter table public.supplement_log enable row level security;

drop policy if exists "own nutrition profile" on public.nutrition_profile;
create policy "own nutrition profile" on public.nutrition_profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own food log" on public.food_log;
create policy "own food log" on public.food_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own foods" on public.foods;
create policy "own foods" on public.foods for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own hydration" on public.hydration_log;
create policy "own hydration" on public.hydration_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own weight" on public.weight_log;
create policy "own weight" on public.weight_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own supplement log" on public.supplement_log;
create policy "own supplement log" on public.supplement_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
