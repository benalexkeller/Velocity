# Velocity "deslop" — handoff for any Claude session or model

Written 7 Oct 2026, 23:30 CEST. Read this first; it is enough to continue the work from a fresh session.

## What happened so far

1. Eleven independent reviews of the live app (3 athletes, 3 designers, 3 coaches, a code audit, a nutrition scientist) produced 453 findings. Merged, de-duplicated and ranked: **169 rows — 36 P0, 94 P1, 32 P2, 7 P3**. Score **38.5 / 100, FAIL; all nine hard gates fail.**
2. The three causes behind most of it: (1) the owner's personal constants baked in for every user (155 bpm, his zones/paces, Ironman legs, Texas copy, seed coach thread); (2) no design-token discipline (34 font sizes, 29 backgrounds, 17 radii); (3) components that cannot shrink on a phone (36 of 54 phone states scroll sideways).
3. **No code has been changed yet.** Branch `deslop` was created from `main` (commit `9278711`) and carries only the `qa/` folder (this review material).

## Where everything is

| Thing | Location |
|---|---|
| Merged report (verdict, gates, 169 findings, nutrition model, First 15, 11 work packages, disagreements, keep, challenges) | `qa/REPORT.md` in the repo on branch `deslop`; also project doc `claude/deslop-report.md` |
| The eleven source reviews with file:line evidence | `qa/findings/{A1,A2,A3,C1,C2,C3,CODE,D1,D2,D3,NUT}.md` |
| Nutrition model specification (full) | `qa/findings/NUT.md` appendix |
| Reviewer brief (product context, final decisions, rubric, severity definitions) | `qa/BRIEF.md` |
| Screenshot + measurement script (55 states × 1440/390 px, computed-style inventory) | `qa/shots.js` → writes `shots/*.png`, `shots/_log.txt` (phone overflow list), `measurements.md` |
| Control inventory script | `qa/explore.js` |
| Plan-generator audit harness (12 intakes, ramp/steps/hard-day checks) | `qa/harness/C3/gen.ts`, `edge.ts`, `steps.ts` (run with `npx tsx` from a folder with `tsx` installed, outside the app) |
| Maths reproduction scripts | `qa/harness/C2/run1.js` … `run5b.js` (bundle the app's lib with `entry.ts` first) |

Screenshots themselves are not committed (regenerate in ~3 min with `shots.js`).

## How to resume in a fresh session (any model)

```bash
git clone https://github.com/benalexkeller/Velocity velocity && cd velocity && git checkout deslop
npm install && npx tsc --noEmit -p . && npx next build
npx next start -p 3111 &            # local mode: no env vars → owner's seed data, no login
mkdir -p ../qa && cd ../qa && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright
cp ../velocity/qa/shots.js . && node shots.js   # launch uses executablePath /opt/pw-browsers/chromium in the cloud workspace
```

Pushing: the cloud workspace cannot push to this repo (git proxy refuses). Push from the owner's Mac: `git bundle create velocity.bundle --all` → send the file → `device_commit_files` into `/Users/benjaminkeller/garmin-mcp/` → in `device_bash`: `git clone velocity.bundle`/`git fetch`, then `git push https://<TOKEN>@github.com/benalexkeller/Velocity deslop` with a classic PAT (scope `repo`) from the owner. Vercel then builds a preview URL for the branch automatically.

## The work, in order (details in REPORT.md §5 and §6)

Do the **First 15** (REPORT §5) first — they close 30 of the 36 P0s in roughly three developer-weeks of effort — then the remaining work packages. Order: WP1 personal constants → WP2 matching/editing bugs → WP3 tokens → WP4 phone → WP5 charts → WP6 analysis → WP7 generator → WP8 nutrition → WP9 copy → WP10 states/hydration → WP11 accessibility.

Rules that still apply (from `CLAUDE.md` and the owner):
- White background, Inter, blue `#2459FE`; no dark mode; no motivational copy anywhere; no daily readiness score; coach proposes, athlete decides; sessions not days.
- `npx tsc --noEmit -p .` and `npx next build` must pass before any push. Verify with a screenshot or scripted click-through before claiming something works.
- Work on branch `deslop`; never push to `main` (it deploys to production). The owner reviews the Vercel preview before merging.
- Keep the owner's own numbers stable: his seed plan and activities must produce the same figures after WP1 with `lthr = 155` (write a regression script before touching load/zones).
- Re-grade with the second-round prompt at the end of `claude/critique-prompt.md` (project doc): fixed / partly / not fixed / made worse per V-ID, re-check the nine gates, re-score.

## Status log (append below)

- 2026-10-07 23:30 — reviews merged; branch `deslop` created with `qa/`; no fixes yet.
- 2026-10-08 — Slice 1 (First 15 items 1–3) done and verified by `qa/verify1.js` (17 checks): V-001 V-002 V-003 V-004 V-005 V-006 V-007 V-036 V-056 V-057 V-133. Semantic colour tokens (`--ok/--warn/--danger`, `--z1…--z5`) added to `globals.css` for later slices. Next: item 4 (zones from intake, V-015) → item 5 (LTHR load, V-019/020/089) → item 6 (session status, V-016/088).
- 2026-10-08 — Slice 2 (First 15 items 4–6) done and verified by `qa/verify2.js` (8 checks): V-015 zones derived from the builder's answers (`src/lib/plan/zones.ts`, saved to `profile.zones` with `meta.lthr/ftp` at build time; panel says "from your answers"); V-019/020 load = min × (HR ÷ LTHR)² with `athlete.lthr` (seed athlete keeps 155), RPE and sport defaults, one `hrZone()` in `lib/athlete.ts` used by Analysis and Activities; V-089 planned load uses one formula (`plannedLoad`) on Analysis too; V-016 session status by paired same-sport activity (`statusOf` in `lib/data/index.ts`: done ≥ 70 %, partial, substituted, missed) — compliance counts partial/substituted as 0.5, today's open session not counted (V-088 naming "Completed sessions" on dashboard + Analysis tile).

## What is left (in order) — for the next session, any model

Done so far: First 15 items **1–6** (11 P0s closed: V-001…007, 015, 016, 019, 020, 036 + P1/P2 036, 056, 057, 088, 089, 133). Branch `deslop` passes `tsc` and `next build`; both verify scripts pass against the local build.

Next, exactly as REPORT.md §5 describes them (row numbers = §3 of REPORT.md):
7. Delete the race capability score, health score and "On track" verdict; gate the projection; race legs from `athlete.raceDist` (V-022, 023, 024, 025, 143). Files: `lib/analysis.ts` (raceScore, healthScore, raceReadiness), `components/analysis/Analytics.tsx:374–430`, `Panels.tsx:50`.
8. Analysis crash + cold start (V-029, 021, 027): `lib/analysis.ts:80–94` start 42 days before min(planStart, first activity), seed the EWMA, `LOAD_SERIES.at(-1) ?? …`; add `src/app/error.tsx`; minimum-duration filter in `weightedAvgPace`.
9. Seed out of other accounts (V-035 calculators `SEED_ANALYSIS` → `useAnalysis()`, V-054 coach thread only on the seed, V-047 delete weather, V-050 "Garmin · imported <date>", V-051 real numbers on the watch).
10. Nutrition `targetsFor` (V-030 fat cap 1.2 g/kg, V-031 carb-load days + race-day detection) in `lib/nutrition/targets.ts`.
11. Nutrition reads what was done (V-032), real meal slots (V-033), estimate days "—" (V-034), During row (V-091), no targets without a weight (V-104).
12. Plan hours tell the truth (V-008, 009, 011, 013) in `lib/plan/generate.ts`; re-run `qa/harness/C3/gen.ts` after.
13. Phone CSS pass (V-106, 107, 152, 153) — acceptance: `scrollWidth === 390` on every state in `qa/shots.js` output `_log.txt`.
14. Type ramp + colour tokens (V-110–113, 116) — `--ok/--warn/--danger/--z1…5` already exist in `globals.css :root`; the ramp and the 125 hex literals are still to do.
15. Charts: `lib/ticks.ts niceTicks`, container-measured width, zero floor, shared `ZONE_FILL` (V-124, 125, 126, 028).
Then the remaining work packages WP6–WP11 (REPORT.md §6).

Known follow-ups from slices 1–2: the seed athlete's load numbers moved slightly (RPE path and sport defaults changed; HR path unchanged at LTHR 155); `eslint` still reports the pre-existing `set-state-in-effect` pattern (41 → ~44 errors, none new in kind); metric athletes still see imperial pace strings in zones (zones are stored imperial; metric display is roadmap item 4).

How to verify after each slice: `cd velocity && npx tsc --noEmit -p . && npx next build && (npx next start -p 3111 &)` then `node qa/verify1.js` and `node qa/verify2.js` from a folder that has `playwright` installed (see "How to resume").
