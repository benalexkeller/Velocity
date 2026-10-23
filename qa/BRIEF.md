# Velocity review brief (read fully before starting)

You are one reviewer in a panel grading a web app called **Velocity** before it is shown to paying users. The owner wants it to stop looking and feeling like something an AI generated in a weekend. Your job: find every real defect inside your lens and hand back findings with exact fixes. A separate developer will implement your list without talking to you, so a finding is only useful if it says **where**, **what is wrong**, and **what the fixed version is in concrete terms** (a pixel value, a hex code, a formula, a renamed label, a file and line). "Improve the hierarchy" is not a finding. "The six KPI cards on Analysis use three label sizes (11, 12, 13 px); set all to 12 px / 500 / #6B7280" is.

Be strict. 40 real problems beat a balanced review. No praise for politeness. No softening.

## What you have

- **Code (read-only — do not edit anything under it):** `/home/claude/velocity` — Next.js 16 App Router, TypeScript, plain CSS with tokens in `src/app/globals.css`. Pages in `src/app/*/page.tsx`, components in `src/components/`, maths in `src/lib/` (`analysis.ts`, `data/index.ts`, `plan/generate.ts`, `plan/rules.ts`, `nutrition/targets.ts`, `workout.ts`, `athlete.ts`, `store.tsx`).
- **Screenshots:** `qa/shots/<state>-1440.png` (desktop, full page) and `<state>-390.png` (phone, full page). List them with `ls qa/shots`. View one with the Read tool. `_log.txt` has page heights and which phone pages overflow horizontally. States include: dashboard, dashboard-log-open, dashboard-coach-reply, plan-week, plan-session-open, plan-session-move/edit/log, plan-add-workout, plan-month, plan-week-overview, activities, activities-detail, activities-filters, activities-map-full, activities-search-none, analysis, analysis-4wk, analysis-activity, analysis-tooltip, nutrition-setup, nutrition-day, nutrition-week, nutrition-log-search/typed/wholeday/datepicker, nutrition-guide, nutrition-guide-edit, nutrition-supplements, calculator, calculator-carbs, calculator-zones, store, profile, admin, login, setup, feedback, avatar-menu, builder-1-goal … builder-5-devices, builder-upload, builder-building, plan-after-build, dashboard-after-build, analysis-after-build, nutrition-after-build, plan-cleared.
- **Measurements:** `qa/measurements.md` — every computed font size, weight, line height, colour, background, radius, border colour, shadow, padding, margin, gap and letter spacing actually rendered on desktop, with element counts. This is ground truth for "is it outside the token set".
- **Live app (local mode, seeded with the owner's real plan and Garmin activities; no login needed):** http://localhost:3111 — pages /dashboard /plan /activities /analysis /nutrition /calculator /store /profile /admin /setup /plan/new. You may drive it with Playwright from Node: `cd /home/claude/qa && node yourscript.js`, launching with `require('playwright').chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`. Use a fresh browser context per scenario (state lives in localStorage). Put any scripts and screenshots you make under `qa/work/<your-id>/`. Do not modify `qa/shots` or `/home/claude/velocity`.

Today is Wednesday 7 October 2026. The seed athlete is in week 5 of a 33-week plan for IRONMAN Texas on 24 April 2027, goal sub-13 h. His last logged activity is 28 September, so "this week" has 0 sessions done.

## The product

Velocity is an AI coach for people training for one endurance event (triathlon, running, cycling). Not a general activity tracker. It builds a plan for the race, shows today's session, takes completed activities (Garmin or typed in), analyses progress, and ties daily nutrition to the training plan. The training-plus-nutrition link is meant to be the one thing competitors do not do well.

Pages: Dashboard · Plan (week/month calendar, session panel, plan builder, "road to race" chart, "plan explained") · Activities (list, detail, route maps) · Analysis · Nutrition (Track / Guide / Supplements) · Store · Calculator · sign-up / profile set-up · Admin.

Intended design tokens: background #FFFFFF, text #101114, muted #6B7280, lines #E6E8EC, accent #2459FE (soft #E9F1FE), completed session #2C2D31, outstanding #E5F0FE, rest #EDEFF5. Font: Inter, self-hosted. Units imperial by default.

How numbers are calculated today (check the code; check against sports science):

- **Race capability score** = 100 × (0.40 run + 0.35 bike + 0.15 swim + 0.10 durability); each part = current efficiency vs the plan's expected curve. **Health score** = 100 × (0.50 VO2max + 0.25 resting HR + 0.25 HRV). Both home-made.
- **Fitness / Fatigue / Form** = 6-week load, 1-week load, difference. Flag weekly load rising > 10%.
- **Daily calories** = Mifflin–St Jeor × 1.4 + session energy (MET × kg × h) ± goal.
- **Daily carbs** by day type: rest 3.5 g/kg, light 5, moderate 6, long 8, race 10. Protein 1.7 g/kg. Fat remainder ≥ 0.8 g/kg.
- **Session fuel:** before 0.5–1 g/kg; during 0 / 45–60 / 75 / 90 g per hour chosen by duration only; after 1.1 g/kg carbs + 0.3 g/kg protein. Fluid 35 ml/kg + 500 ml per training hour. Sodium 2,300 mg + 500 mg per training hour.
- **Plan builder:** Base → Build → Peak → Taper, recovery every 4th week at 70 %, weekly hours ≤ +10 %, long sessions ≤ +10 % per step with caps per event, taper 65 % then 50 %.

## Decisions that are final — do not report these as defects

1. Pure white background everywhere. No dark mode.
2. No motivational, inspirational or feel-good copy anywhere. Cold facts and to-dos only. (Any such copy you find IS a defect.)
3. No daily readiness or recovery score.
4. The coach proposes plan changes; the athlete decides. Nothing changes the plan silently.
5. Dashboard: today's session is the large card, next two days smaller, phase/week position instead of race countdown.
6. The app tracks sessions, not days.
7. Inter is the font. The drawn Garmin-style watch on the dashboard hero was requested by the owner.
8. The red "Give feedback" button was requested by the owner (you may still critique its execution).

If you think one of these is a serious mistake, put it in a final "Challenges" section (max 3, each with evidence).

## Already known — do not spend findings on these

The AI coach service is not connected (coach replies are canned data answers; the coach thread shown in the seed is example content). Per-second heart-rate/power streams are not imported, so time-in-zone, decoupling and splits are not built. Google sign-in, Google Calendar writing, Whoop, automatic Garmin sync: not built. You may say which of these matters most and why, in one line.

## Reference standard

Training content: TrainingPeaks, Strava, WHOOP, Garmin Connect, Today's Plan. Interface craft: Linear, Stripe Dashboard. Judge against those.

## AI-tells checklist (anyone may report; designer D3 must)

A single font doing every job with a flat size scale; small grey labels sitting above every heading; rows of identical cards; cards inside cards; big-number "hero metric" tiles with a tiny label; coloured status dots with no meaning; coloured side stripes on cards; pill badges everywhere; thin borders combined with wide soft shadows; corner radii that vary without reason; gradients or glows as decoration; emoji as icons; icons from mixed sets or mixed stroke weights; text under 12 px; low-contrast grey text; even spacing everywhere so nothing groups; charts with default-library styling; placeholder illustrations; em-dashes and filler phrases in copy; labels that sound written by a model rather than by someone in the sport.

## Severity

- **P0** broken, data lost, or a wrong number shown.
- **P1** makes the product look amateur, or misleads the athlete.
- **P2** noticeable polish problem.
- **P3** nitpick.

## Output — write it to `qa/findings/<YOUR-ID>.md`, exactly this structure

```
# <YOUR-ID> · <lens name>

## Method
Two to five lines: what you looked at, what you ran.

## Findings
| ID | Sev | Page / component | Evidence | What is wrong | Exact fix | Effort | Confidence |
|---|---|---|---|---|---|---|---|
| <YOUR-ID>-01 | P1 | Analysis · KPI row | analysis-1440.png top row; src/components/analysis/Analytics.tsx:112 | … | … | S/M/L | high/med/low |

(Sort by severity. Evidence = screenshot file + where on it, or file:line, or a script you ran + what it printed. Report every instance, not one example per type — if twelve cards have the problem, list the twelve or give the exact selector that catches all twelve. A suspicion with no evidence goes in "Not verified", not here.)

## Score for my lens
<category you are scoring> : N/10 — two lines of evidence for the number. (3 = broken or obviously machine-made; 5 = typical AI dashboard, works, forgettable; 7 = competent small product; 9 = holds up next to the reference products. Most first drafts deserve 4–6. No 8+ without named evidence.)

## Not verified
Suspicions and what would confirm them.

## Keep
Up to 5 things that work and must not be broken.

## Challenges
Up to 3 objections to the final decisions, with evidence. Or "none".
```

Rules: do not invent screens, numbers or features; if a screenshot is unclear say so. Do not propose a new brand, dark theme or different product. Do not recommend a library or page rewrite unless you explain why a smaller change cannot work. Plain language — the owner is not a developer — but keep the exact fix precise.
