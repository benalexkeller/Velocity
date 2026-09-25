# Precision Velocity (working name)

AI coach for anyone training for an endurance event. Next.js (App Router) · TypeScript · plain CSS tokens · Supabase (next) · Vercel (next).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000 → redirects to /dashboard
npm run build    # production build
```

## Where things are

- `src/app/globals.css` — the design tokens (colors sampled from the approved mocks), app shell, primitives.
- `src/components/AppShell.tsx` — top bar + left nav. Rename the product in `src/lib/config.ts` (`BRAND`).
- `src/app/dashboard` — today's session hero, + log, this week, last activity, next days, phase strip, Sunday review, two charts, coach bar.
- `src/app/plan` — week time-grid / month grid, coach rail, "The road to 140.6" ramp, "Your plan explained".
- `src/app/activities` — searchable, grouped activity table with the dark detail drawer.
- `src/lib/data` — the data layer. Today it is seeded from `seed/plan.json` and `seed/actuals.json` (PR's real plan and log). The selectors (`currentWeek`, `weekStatus`, `rollingCompliance`, load model, discipline splits) are what the pages consume; swapping the seed for Supabase queries does not touch the UI.
- `src/lib/units.ts` — unit preference (imperial default). Every displayed distance/pace goes through here.
- `supabase/schema.sql` — the database schema + row-level security, ready to run in a new Supabase project.

## Next

1. Accounts: GitHub (push this repo), Supabase (run `schema.sql`), Vercel (import the repo → live URL).
2. Auth + profile; move seed data behind Supabase queries.
3. Garmin webhooks (needs the developer-program approval), Whoop OAuth, Google Calendar (free/busy + write).
4. Coach service (Claude API): onboarding interview → plan generation; weekly review agent; chat with screen context.
5. Analysis, Nutrition, Store, Calculator pages in the same system.
