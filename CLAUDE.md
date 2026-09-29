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
- Seed files (`src/lib/data/seed/*.json`) are PR's real plan/activities/body data; never invent data.

## Product rules already decided
- No daily readiness/recovery score; load/fatigue/form from work done. Coach proposes changes only in the Sunday review; the athlete decides.
- Dashboard: today's hero card + next two days, "+ Add manually" bubble, This week, Last activity, phase strip, pace + volume charts.
- Plan tab = command center: week grid 05:00–21:00 (scrollable 04:00–23:00), Move/Edit/Delete/Log/Add all work, road-to-race ramp chart.
- Activities: list with frozen header, white detail panel on the right, Exclude from analysis + Delete.
- New accounts start with an empty plan (no plan builder yet); profile setup collects basics + race.

## Git
- Commit as `Claude <noreply@anthropic.com>` is fine; end messages with the Co-Authored-By / Claude-Session trailers when the session provides them.
- `main` deploys to production on every push. Build must pass (`npx next build`) before pushing.

## Roadmap (in order)
1. Verify accounts on the live site; PR imports his seed data; Google sign-in (Supabase provider + Google Cloud OAuth client).
2. Coach service (Claude API): onboarding interview → plan JSON; Sunday review reading the week's data.
3. Garmin: scheduled import for PR now; official Garmin Connect Developer Program (needs the LLC) for everyone; Whoop; Google Calendar.
4. Metric units in the UI, password reset, avatar upload, Stripe, legal/GDPR docs, monitoring.
