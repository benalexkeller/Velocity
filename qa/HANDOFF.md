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
