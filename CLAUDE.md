@AGENTS.md

# Velocity — working rules for any Claude session in this repo

Velocity is an AI-coach training app for endurance athletes (Ironman first). Owner: PR (GitHub `benalexkeller`,
project email benalexkeller@gmail.com). Live site: https://velocity-smoky-three.vercel.app (Vercel Hobby, deploys `main`).
Database + logins: Supabase project `hngrtoufmjauqdkhncbp`. Product decisions and history live in PR's Claude Project
"Iron Man" (docs `claude/accounts-v1.md`, `claude/phase2-build-log.md`, `claude/phase2-product-spec.md`).

## How PR works
- Explain everything in simple, non-technical language. PR is not a backend developer; he decides product, you run the commands.
- Copy rule for the app AND for replies: cold facts and to-dos, no motivational, "impactful" or feel-good statements anywhere.
- Design must match the approved mocks 1:1: white background, Inter (self-hosted), blue accent `#2459FE`, cards with soft shadow, no dark mode.
- Verify with a screenshot or a scripted click-through before saying something works. `scripts/snapshot.js` renders the review mirror.

## Stack
Next.js 16 App Router (read `node_modules/next/dist/docs` before assuming APIs — `proxy.ts`, not middleware), TypeScript, plain CSS
with tokens in `src/app/globals.css`, no UI library. `npm run dev` → http://localhost:3000. `npx tsc --noEmit -p .` must be clean.

## Data model (read this before touching data)
- `src/lib/store.tsx` — `PlanProvider` / `usePlan()` is the only source of truth for pages. It loads once from a backend, keeps a working
  copy, writes every change straight back. Derives `weeks` (plan JSON → `buildWeeks`, or `virtualWeeks()` when the plan is empty),
  `phases`, `athlete` (`src/lib/athlete.ts`), `activities` (all) vs `counted` (excluded ones removed — analysis/volume/status use `counted`).
- `src/lib/backend.ts` — `LocalBackend` (no env vars: PR's seed data + browser storage) and `SupabaseBackend` (env vars set: the user's rows).
  Accounts are ON only when `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist (`.env.example`).
- `src/lib/data/index.ts` — types, seed loaders, classification (`sportOf`, `intensityOf`), `buildWeeks`, `phasesOf`, load/compliance math.
- `src/lib/analysis.ts` — `createAnalysis(activities, weeks, {phases, body, athlete})`; use through `useAnalysis()` in components.
- `supabase/schema.sql` — the whole database; idempotent, paste into Supabase SQL Editor. RLS: users only see their own rows.
  `admin_emails` decides who is admin (currently benalexkeller@gmail.com).
- Seed files (`src/lib/data/seed/*.json`) are PR's real plan/activities/body data; never invent data. `seed/maps.json` = OpenStreetMap vector base maps (via the Garmin MCP's `get_area_map`, thinned by the scratch script) that `RouteMap` draws under routes; routes outside them use CARTO label-free tiles.

## Product rules already decided
- No daily readiness/recovery score; load/fatigue/form from work done. Coach proposes changes only in the Sunday review; the athlete decides.
- Dashboard: today's hero card + next two days, "+ Add manually" bubble, This week, Last activity, phase strip, pace + volume charts.
- Plan tab = command center: week grid 05:00–21:00 (scrollable 04:00–23:00), Move/Edit/Delete/Log/Add all work, road-to-race ramp chart.
- Activities: list with frozen header, white detail panel on the right, Exclude from analysis + Delete.
- New accounts: profile setup (basics + availability) → `/plan/new` plan builder (5 screens: goal, history, fitness, time, devices/strength; branches by event type) → 30-second build screen → plan. Rule-based generator `src/lib/plan/generate.ts` reads `src/lib/plan/rules.ts` (sourced coaching rules, shown under "How this plan is built"). Spreadsheet import (`importPlan.ts`, template CSV). Answers stored in `plans.intake`; "Plan settings →" rebuilds. Minimum plan length 4 weeks. The race lives in the builder, not the profile.

## Git
- Commit as `Claude <noreply@anthropic.com>` is fine; end messages with the Co-Authored-By / Claude-Session trailers when the session provides them.
- `main` deploys to production on every push. Build must pass (`npx next build`) before pushing.

## Public site, coach, Garmin (branch `public-site`, 2026-10-27)
- `/` is the public front page (`src/app/page.tsx` + `landing.css`, screenshots in `public/landing/`). Signed-in athletes are sent to `/dashboard` by `proxy.ts`; the page renders without the app shell and without loading data.
- No beta signs anywhere: feedback lives in the account menu ("Send feedback"). Supplement names like "Beta-alanine" are fine.
- Coach: `POST /api/coach` → OpenRouter (`OPENROUTER_API_KEY`, `COACH_MODEL` default `deepseek/deepseek-v4.1-flash`, `COACH_DAILY_CAP` 40). Order inside the route: fixed red-flag check (`src/lib/coach/safety.ts`, no model) → library search (`src/lib/coach/library.ts` over `library-data.ts` + the admin's `library` table rows) → model with instructions (`prompt.ts`) and the athlete's context (`context.ts`). Answers cite passages as `[L1]`; the rail shows them as superscripts with a Sources list. Plan changes come back as proposals (`coach_messages.proposal`, `status`, `sources`, `tier`; SQL `supabase/schema-coach.sql`); Accept applies them through the store. A whole-plan review never runs by itself: the model pitches it (`request_restructure` → proposal of kind `review`), the athlete clicks "Run the full review" (or the rail's "Review my plan"), then mode `restructure` sends every remaining week (`plan_all`) and uses `COACH_MODEL_STRONG` (default = `COACH_MODEL`; one setting to put a stronger model on it). Admin page has a Library editor. Without a key the rule-based `coachReply` answers.
- Garmin through Junction (junction.com): `src/lib/integrations/junction.ts`; routes `/api/connect/garmin` (start), `/done` (return), `/disconnect`, `/sync` (pulls the last 90 days with the athlete's own session: the minimum setup needs only the Junction key), `/api/connect/status`, webhook `/api/webhooks/junction` (Svix signature, service-role writes; optional, for automatic updates). Routes come from `map.summary_polyline`. Admin page lists connections + webhook calls (`admin_integrations`, `admin_webhook_log`). Env in `.env.example`; SQL in `supabase/schema-integrations.sql`. Switched on by `WEARABLE_PROVIDER=junction` + `WEARABLE_API_KEY`.
- Phone app design: Claude Design canvas "Velocity Mobile" (6 screens, same tokens). Front-page review copy: artifact "Velocity Front Page".
- Strava's API policy (June 2026) bans putting Strava data into an AI model: never add Strava as a data source for the coach.

## Roadmap (in order)
1. Buy Junction (sandbox first), set the env values, run the two SQL files, test Connect Garmin on the live site; apply to Garmin's own developer program in parallel.
2. Coach: Sunday weekly review as a scheduled job; onboarding interview that writes the plan.
3. Google sign-in; Google Calendar writing; Whoop.
4. Metric units in the UI, password reset, avatar upload, Stripe, legal/GDPR docs, monitoring.
