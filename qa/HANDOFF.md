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

Pushing: the cloud workspace cannot push to this repo (git proxy refuses; checked again 8 Oct). The owner's token is saved on his Mac at `$HOME/.vptoken` (device_bash home, outside his folders); push with `git push "https://$(cat $HOME/.vptoken)@github.com/benalexkeller/Velocity" HEAD:deslop` from `$HOME/vpush` after fetching the new bundle, and mask `ghp_` in output. Push from the owner's Mac: `git bundle create velocity.bundle --all` → send the file → `device_commit_files` into `/Users/benjaminkeller/garmin-mcp/` → in `device_bash`: `git clone velocity.bundle`/`git fetch`, then `git push https://<TOKEN>@github.com/benalexkeller/Velocity deslop` with a classic PAT (scope `repo`) from the owner. Vercel then builds a preview URL for the branch automatically.

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

- `2f83676` items 14–15 (above).

**Done after that (Opus 5.5, 8 Oct 2026; pushed to `deslop`, Vercel preview built from `ef39b02`):**
- `168089d` flush period steppers (`PeriodStepper`), "Connect wearable" button + sheet everywhere incl. setup and builder (`ConnectWearable.tsx`, devices are recorded, nothing connects yet), session fuel line on the dashboard hero and Plan panel (V-049), status words on Analysis (V-026).
- `17ba10b` owner's requests: ~60 filler/descriptor sentences cut or shortened app-wide; This week card on one line; Nutrition method paragraph behind "How targets are calculated"; interval chart rebuilt (repeats grouped, labels only where they fit, fuel lane before/feeds/after, ticks by width); activity Exclude/Delete moved into a ⋮ menu. `qa/wrapcheck.js` flags wrapped labels and lists muted sentences.
- `8d4ce21` coach panel: only today's messages (messages carry `day`), close button on Plan (remembered in `velocity.coach.v1`), the coach bar on every page opens the same panel on the right (`CoachDock.tsx`), example thread gone. `qa/verify6.js` 17 checks.
- `bfabef7` "Your plan explained" replaced by phase buttons + the selected phase's facts under the Weekly hours chart (`PhaseDetail` in `PlanExplained.tsx`); chart phase brackets select the phase. `qa/verify7.js` 12 checks.
- `b0ba969` V-108 phones get the week as a list; ramp chart scrolls at 760 px; V-064 keyboard + focus rings; lock icon clear of text. `qa/verify8.js` 11 checks.
- `c0b87ea` V-037 0 hydration errors (the store renders nothing until the browser has the data; `useNow()`), V-044 one date style (`dateFull`, `rangeLabel`), V-087 Analysis order, V-090 "Analysis needs data". `qa/hydra.js`.
- `a250ca3` V-080/081 KPI row: This week · Week load · Fitness (pts, "no baseline yet") · Form (state word) · Completed 28 d · Run efficiency.
- `4c02203` WP7: V-010 swim doubles for 3–4-day tri plans (+ builder refuses tri < 3 days), V-012 race day with legs/sport/targets, V-014 step parser (threshold/hard Z4, tempo/race pace Z3, written recoveries, race-pace finishes, run off the bike), header/target/hero from the key work (`hardestStep`), "Threshold" intensity, V-072 hard-day spacing, hour cap. `qa/gen-check.ts` 24 checks (`npx tsx`).
- `4b6f963` V-039 developer vocabulary out · `33d36ba` V-040 last feel-good lines out · `bf3d541` lint.

Checks (run against `npx next start -p 3111` from a folder with playwright): verify1 17/17 · verify2 8/8 · verify3 15/15 · verify4 8/8 · verify5 14/14 · verify6 17/17 · verify7 13/13 · verify8 11/11 · `phone.js` 0 overflow · `hydra.js` 0 hydration errors (try `node hydra.js America/Los_Angeles`) · `gen-check.ts` 24/24.

Server tip: never `pkill -f "next start"` in the same shell command that starts the server (the pattern matches the command itself and kills the shell). Stop and start in separate calls; start with `(setsid nohup npx next start -p 3111 > server.log 2>&1 < /dev/null &)`.

**Still open, in order:**
1. **V-086** Analysis flag strip (days since last session, form below −30, ACWR ramp, body data age, threshold not set).
2. **V-065** missed-session proposals (Monday card: repeat the missed long session, shift the +10 % steps; Accept / Keep plan).
3. **WP8 nutrition remainder** — gut-training status and sweat tests in set-up (NUT §I, §K), race-day page (§H). Ask PR before adding a separate in-session meal (his 2026-09-30 decision folded it into "Other").
4. **WP4 remainder** — V-118/119/159 control heights, card padding and gap scale, line-height tokens.
5. **WP9** — V-042 session/activity glossary, V-046 one icon set.
6. **Lint** — 34 errors, mostly the pre-existing `react-hooks/set-state-in-effect` pattern and unescaped quotes.
7. Re-grade with the second-round prompt at the end of `claude/critique-prompt.md`.

Known follow-ups: the seed athlete's load numbers moved slightly in slices 1–2 (RPE path and sport defaults; HR path unchanged at LTHR 155); metric athletes still see imperial pace strings in zones (zones are stored imperial; metric display is roadmap item 4); the coach panel drawer sits over the page on non-Plan pages (pushing the page would need container queries; the Plan page docks it as a column).
