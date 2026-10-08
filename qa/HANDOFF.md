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

## What is left — for the next session, any model

**Done (as of 2026-10-08, Opus 5.5 session):** all of First 15 (REPORT.md §5) — 30 of 36 P0s closed, plus the P1s/P2s bundled with them. Commits on `deslop`:
- `29f54f5` items 1–3 · `3a89d37` items 4–6 (Fable session)
- `61263de` items 7–9: home-made scores deleted, gated race projection (Riegel), VO2max trend replaces the health ring, Fitness seeded 42 days back, `app/error.tsx`, minimum-duration pace filter, calculator uses own data, seed coach thread only on the owner's seed, weather removed, Garmin "Imported <date>", watch shows the last activity, zone donut removed (session-average HR ≠ time in zone)
- `aa3cfea` items 10–11: nutrition engine rewritten to NUT §C–§J (carb bands by effective training hours, 10 g/kg on race −2/−1, race-day plan, fat 0.8–1.2 g/kg, deficit caps by day/phase + energy-availability floor, in-session fluid ≤ 0.8 L/h and sodium, before/after rules by clock and gap); targets follow logged activities; Before/During/After/Rest timing rows; estimate days show "—"; no targets without a weight. `qa/nutri-unit.ts` prints the worked examples.
- `8deca64` item 12: every screen shows scheduled hours; +10 % over the last loading week; build screen states when the days cannot hold the maximum; longest ride excludes run-off; "Your plan explained" only on the seed. `qa/ramp-check.ts`.
- `5bc5b04` item 13: phone pass — 0 of 53 phone states overflow (`qa/phone.js`), bottom tab bar.
- next commit: items 14–15: 8-step type scale (34 → 8 rendered sizes), status colours as tokens, `--muted-2` readable, page eyebrows removed, sentence-case tabs; `lib/ticks.ts` (`niceTicks`, `useWidth`) — charts draw at their real width so axis text is 12 px everywhere, round ticks, zero floor, one zone/macro palette, Form grey dashed, swim colour readable.

Checks (run against `npx next start -p 3111` from a folder with playwright): `verify1.js` 17/17, `verify2.js` 8/8, `verify3.js` 15/15, `verify4.js` 8/8, `phone.js` 0 overflow.

**Next, in order** (REPORT.md §6 work packages; rows in §3):
1. **WP6 Analysis content and order** — V-026 Training-quality status words instead of %, V-080/081 KPI tiles (report's six), V-086 recovery baselines, V-087 section order (KPI → flags → Sunday facts → week in review → F/F/F → volume → long sessions → aerobic progress → body → thresholds → projection → activity analysis), V-090 "Analysis needs data" empty state. Note: the Training-quality table still shows "100 %" for a rest-day run and bike-for-swim (V-026) — most visible remaining wrong number.
2. **WP7 Plan generator** — V-010 swims for ≤ 4-day tri plans, V-014 step parser (threshold/race pace/run off the bike), V-012 race-day session, V-072 no back-to-back hard days, V-065 missed-session proposals, progression templates. Known from ramp-check: session minimums push a 2 h/week marathoner to 3.4 h in week 2; a gran fondo plan can schedule 10.6 h against a 10 h maximum — both need a cap pass.
3. **WP8 nutrition remainder** — V-049 fuel line on the dashboard hero and the Plan session panel (use `nut.fuelFor` / `sessionFuel`), gut-training status and sweat tests in set-up (NUT §I, §K), race-day page (§H). The "During" row has no logged value because PR folded in-session food into "Other" (his 2026-09-30 decision); ask him before adding a separate meal.
4. **WP4 remainder** — V-108 week grid as a list on phones, V-118/119/159 control heights, card padding and gap scale; line-height tokens.
5. **WP9 copy** — V-039 developer vocabulary, V-040 feel-good lines ("The road to 140.6", "Taper — Freshen up"), V-042 session/activity glossary, V-044 one date format, V-046 one icon set.
6. **WP10/WP11** — V-037 hydration (#418) via a `useNow()` hook, keyboard access to week grid / activities, focus rings, lint.

Known follow-ups from slices 1–2: the seed athlete's load numbers moved slightly (RPE path and sport defaults changed; HR path unchanged at LTHR 155); `eslint` still reports the pre-existing `set-state-in-effect` pattern (41 → ~44 errors, none new in kind); metric athletes still see imperial pace strings in zones (zones are stored imperial; metric display is roadmap item 4).

How to verify after each slice: `cd velocity && npx tsc --noEmit -p . && npx next build && (npx next start -p 3111 &)` then `node qa/verify1.js` and `node qa/verify2.js` from a folder that has `playwright` installed (see "How to resume").
