# NUT · Sports-nutrition science: session fuelling, daily targets, hydration, race day, guardrails

## Method
Read the whole fuelling model (`src/lib/nutrition/targets.ts`, 113 lines), the fuelling parts of `Track.tsx` and `Guide.tsx`, the thirteen Guide cubes (`src/lib/content/nutrition.tsx`), the Sweat-rate and Carbs-per-hour calculators (`src/lib/content/calculators.tsx:148–203`), the set-up form (`Setup.tsx`), the nutrition store (`store.tsx:64–76`) and the data types the model can read (`Session`, `Activity`, `intake.fitness`). Ran `work/NUT/race.ts` (tsx) against the seed plan to print what the model outputs for race week (22–24 Apr 2027) and for three ordinary sessions (8–10 Oct 2026); the printed numbers are the evidence below. Checked every number against the IOC / ACSM / ISSN consensus papers named in the appendix (four web look-ups to confirm Podlogar & Wallis 2022, the 2023 IOC REDs statement, Keytel 2005 and the 2016 joint position stand). Findings already made by A1, A2, A3, C1 and D3 are cited, not repeated; the appendix is the specification the owner asked for.

## Findings
| ID | Sev | Page / component | Evidence | What is wrong | Exact fix | Effort | Confidence |
|---|---|---|---|---|---|---|---|
| NUT-01 | P0 | Nutrition · Track day/week, race week | `work/NUT/race.ts` output: Thu 22 Apr 2027 (race −2, 45-min swim) → "light · 5 g/kg · 374 g carbs · goalAdj −128"; Fri 23 Apr (race −1, 15-min brick) → "light · 345 g carbs · fat 60 g · goalAdj −128"; Sat 24 Apr race day → "11,012 kcal · carbs 748 g · fat 835 g · fluid 9.1 L · sodium 8,800 mg · before 75 g · after 82 g + 22 g within 60 min". `targets.ts:43–52, 73–82, 88–93` | Race week is inverted. The two loading days get the lowest carbohydrate band of the whole plan and a weight-loss deficit, because the taper has few training minutes and `dayTypeOf` only counts minutes. Consensus is 10–12 g/kg/day for the 36–48 h before an event over 90 min (Burke 2011; Thomas 2016), with no deficit. Race day itself is handed 835 g of fat and 8.8 g of sodium as "targets" because fat is the remainder of an 11,000 kcal day. (A1-02 and A2-06 saw the race-day fat and the 300-min gate; the loading-day inversion and the deficit on race −1 are new.) | Add two day types keyed to the race date, not to minutes: `load` (race −2 and −1 → 10 g/kg, fibre ≤ 15 g, fat 0.8 g/kg, `goalAdj = 0`) and `race` (any session with `intensity === "Race"` on the race date, or `min ≥ 150` with "race sim" → carbs = the race-day plan sum from Appendix §H, not g/kg; fat = 1.0 g/kg fixed; sodium and fluid from the race-day plan, not from the daily formula). Set `goalAdj = 0` for the 7 days before the race. | M | high |
| NUT-02 | P0 | Nutrition · every day target | `src/lib/nutrition/store.tsx:65` `sessionsOn` = planned sessions on the date; `targets.ts:70` `sessionKcal(s, w)` reads `s.min` and `s.intensity` only; `Session.actual` (`data/index.ts:25`) and `status` are never read. Seed: last activity 28 Sep, so every day since shows the full planned training energy and carb band although nothing was done | Targets follow the plan, never what happened. A skipped 4-h ride still adds ≈2,100 kcal and puts the day in the 8 g/kg band; a ride that ran 5 h instead of 3 h gets 3-h fuel; a missed session is fed as if completed. Every past day in the week table is therefore a wrong number. | In `targetsFor`, for each session: if `s.actual` exists use `actual.min`, `actual.hr`, power/kJ when present (Appendix §A); if `s.status === "missed"` and the date is past, count 0 training kcal and 0 training hours for carbs (protein unchanged); if the day is in the future or today-before-start use the plan. Show the basis in the Calories tooltip: "planned" / "from your 2:48 ride". | M | high |
| NUT-03 | P0 | Nutrition · Track day · "Carbohydrate timing" rows | `Track.tsx:15` `MEAL_SLOT = { breakfast: "08:00", lunch: "13:00", dinner: "19:30" }`; `:48` `before = meals.filter((m) => MEAL_SLOT[m] < start).pop()` → for any start before 08:00 (`"08:00" < "06:30"` is false) `before` is `undefined`, `carbs(undefined)` = 0; `:49` `after` = breakfast. Seed Wed 06:30 swim, Thu 06:30 run: "Before session · 37 g target · 0 g" can never change | For every dawn session (most of the plan) the pre-session row is permanently 0 g and whatever the athlete eats before the session, logged as breakfast, is counted as "After session". Wrong number, every morning. | Derive the slots from the session: `before` = entries whose logged time (add `at?: string` to `LogEntry`, default = meal slot) is in `[start − 4 h, start)`; `after` = `[end, end + 2 h)`; `during` = entries flagged `fuel: true` or with `at` inside `[start, end]`. Until entries carry a time, fall back to: start < 08:00 → before = breakfast, after = lunch; 08:00–13:00 → breakfast / lunch; 13:00–19:30 → lunch / dinner; else dinner / other. | S | high |
| NUT-04 | P1 | Nutrition · Track, Guide "This week's fuel", Calculator | `targets.ts:102` `perHour = min<60 ? 0 : min<=150 ? (hard?60:45) : min<=240 ? 75 : 90` has no `sport` term. race.ts: Fri 9 Oct 65-min easy **swim** → "45 g/h · 49 g · log it under Other"; a 3-h long run → 75 g/h; Guide race cube (`nutrition.tsx:113–114`) says bike 80–100 / run 60–70 | During-session carbohydrate is sport-blind. Running tolerates less than cycling (GI symptoms 2–3× more frequent in running; Pfeiffer 2012; Jeukendrup 2014 gives the 90 g/h figure for cycling), and a swimmer cannot take 45 g/h. The number shown for runs is too high and for swims impossible. | Rule in Appendix §C: `perHour = min(need(duration, intensity), sportCap, gutCap)` with `sportCap` bike 90 (120 trained) · run 60 (75 trained; 90 only race, trained) · brick = weighted by leg · swim 30 and only when `min ≥ 75` ("bottle on deck") · strength/hike 0/30. | S | high |
| NUT-05 | P1 | Nutrition · session energy | `targets.ts:27–41` MET table; `intake.fitness.bike_ftp`, `lthr`, `vo2max` (`plan/intake.ts:52–58`) and `Activity.hr`, `pace_s`, `mph` are never read. `/Tempo|Intervals|Race/` is the only intensity split, so "Zone 2", "Aerobic", "Endurance" and "Technique" all get one MET (A3-16 showed 2,100 vs ≈3,750 kcal for a 380 W rider) | Energy is estimated from a flat table while power, threshold HR, VO2max, pace and logged HR are already in the data. For the seed (FTP unknown) the bike number happens to be near a 230 W rider; for anyone with a different FTP the daily calorie target, the fat remainder and the energy-availability number are wrong in proportion. | Appendix §A: bike kcal = FTP × IF(intensity) × min × 0.06 (1 kJ ≈ 1 kcal at 24 % gross efficiency); logged activity with HR → Keytel 2005 equation (VO2max form when known); run → 1.0 kcal/kg/km from planned or logged distance; swim → MET 6 / 7.5 / 9 by intensity; strength 4.5; MET table only as last fallback. Show the method used in the tooltip. | M | high |
| NUT-06 | P1 | Nutrition · sodium (computed, never shown) | `targets.ts:92` `sodium = 2300 + round(trainMin/60) × 500`; race.ts: 2,300 mg on the 15-min brick day, 8,800 mg on race day; shown nowhere on the day view (A1-12, A3-19, C1-36). `calculators.tsx:169` uses 900 mg/L × 0.7 | Even once shown, the basis is wrong: 2,300 mg is the US dietary *upper* limit for the general population, used here as an athlete's floor; the 500 mg/h add-on ignores sweat rate and sweat sodium (200–2,000 mg/L, Sawka 2007) and so under-replaces a salty sweater in heat (1.2 L/h × 1,200 mg/L ≈ 1,400 mg/h) and over-replaces a cool 1-h run. Daily dietary sodium and in-session sodium are mixed into one number. | Drop the daily sodium "target". Compute in-session sodium only: `na_mg_h = sweatRate × sweatNa × 0.7`, gated to sessions > 90 min, or > 60 min in heat (`race/climate` or `hot: true` on the session); defaults sweatRate by sport (bike 0.8, run 1.0, swim 0.3 L/h), sweatNa 900 mg/L (600 / 1,200 when the athlete picks "low / salty" at set-up). Show it in the session's Fuel block and as a week-table column "Sodium during". Keep logged dietary sodium as information only. | S | high |
| NUT-07 | P1 | Nutrition · fluid target and the hydration card | `targets.ts:93` `fluid = 35 ml/kg + 500 ml per training hour` (no source; shown as the formula in `Track.tsx:112`); race.ts: 9.1 L / 13 bottles on race day, 3.6 L on a 2-h ride day; the hydration card (`Track.tsx:103–113`) accepts unlimited bottles with no ceiling and no warning; the Sweat-rate calculator result is not stored (A1-29) | A flat 0.5 L/h is below a hot-day bike sweat rate (1–1.5 L/h) and above a cool swim; the day total is presented as a target to reach, which for long days is an instruction to over-drink. Exercise-associated hyponatraemia is caused by drinking more than is sweated (Hew-Butler 2015); the app has no cap and no warning. Sawka 2007 / Thomas 2016 frame drinking as "limit body-mass loss to ≤ 2 %, never gain". | Appendix §G: in-session fluid = 0.6–0.8 × sweat rate, capped at 0.8 L/h unless a measured sweat rate > 1.1 L/h is on file, never above 1.2 L/h; baseline 30–35 ml/kg/day *including* food water (drinks target = 0.8 × that). Store the calculator result (`sweat_rate_l_h`, `sweat_conditions`). Add the warning to the hydration card when logged drinks for a session exceed 1.0 L/h or exceed the sweat estimate by 20 %: "More than you sweat. Over-drinking lowers blood sodium (hyponatraemia). Stop at {cap} L/h." | M | high |
| NUT-08 | P1 | Nutrition · daily carbohydrate band | `targets.ts:43–52`: `light < 75 min`, `moderate ≤ 150`, `long > 150`, strength and brick minutes count the same as a ride; `CARBS_G_PER_KG = { rest 3.5, light 5, moderate 6, long 8, race 10 }`. race.ts: 2-h Z2 ride → 6 g/kg; a 2.5-h ride and a 5-h race sim both → 8 g/kg | The bands are a step function of minutes with no intensity and no scaling inside the band. Burke 2011 / Thomas 2016 give 3–5 g/kg (low), 5–7 (≈1 h/day), 6–10 (1–3 h/day), 8–12 (4–5 h/day): a 5-h day belongs at 10–12 g/kg, a 2.5-h easy day near 7. A 75-min strength session is a "moderate" carb day. | Appendix §F: `g/kg = clamp(3.5 + 1.6 × H_eff, 3, 12)` where `H_eff = Σ hours × weight` (easy 0.8, moderate 1.0, hard 1.2, technique swim 0.6, strength 0.4); +1 g/kg when tomorrow is a key day (≥ 3 h or race sim); day-type labels only for display: rest / light / moderate / long / very long. Replace `dayTypeOf` minute thresholds with `H_eff` thresholds so `sessionFuel` and the day type agree (A1-31). | S | high |
| NUT-09 | P1 | Nutrition · Track day · two sessions in one day | `Track.tsx:45` `const first = active[0], fuel = nut.fuelFor(first)`; the timing card and the "During … After …" sentence describe one session. Seed and generated plans contain AM swim + PM ride days; Guide cube "Two-a-days" (`nutrition.tsx:99–100`) promises a different rule | The second session of the day has no before/during/after target and the between-session recovery rule (1.0–1.2 g/kg/h when the gap is < 8 h; Burke 2011) is not applied. | Loop over `active`; for session k > 0 compute `gapH = start_k − end_(k−1)`; when `gapH < 8` the after-target of session k−1 becomes `1.0 g/kg × min(gapH, 4)` carbs + 0.3 g/kg protein and session k's "before" is folded into it; render one timing block per session. | S | high |
| NUT-10 | P1 | Nutrition · Track day · "During" carbs have no row | `Track.tsx:53` rows = Before / After / Other, `Other target = t.carbs − before − after`; `:99` tells the athlete "During the session: 45 g/h, log it under Other"; `types.ts:9–10` folded the old "session" meal into "other" | The daily carb target includes in-session carbohydrate (Burke's g/kg/day is total intake), but the timing panel has no During row, so a 4-h ride's 300 g has nowhere to be checked against its target and inflates "Other meals". | Add a fourth row "During session · {during} g target" fed by entries with `fuel: true` (AddPanel: a "Fuel during session" toggle, default on for sports products and when the log time is inside a session); `Other target = t.carbs − before − during − after`. | S | high |
| NUT-11 | P1 | Nutrition · weight goal with no energy-availability guard | `targets.ts:73–82`: `lose` −400 and `race_weight` down to −500 kcal applied on every day including long days and race −1 (race.ts: `goalAdj −128` on 23 Apr); `:82` floor `max(1200, …)`; body fat / FFM is not collected; the Guide cube "Energy availability" (`nutrition.tsx:223–234`) states the 30 kcal/kg FFM rule the app never computes (A1-20 saw the Guide/goal contradiction) | Because training kcal is added and then the deficit subtracted, energy availability collapses to `(base + goalAdj)/FFM` every day: a 55-kg woman (165 cm, 30 y; BMR 1,270 → base 1,778) on `race_weight` −500 sits at 1,278 / 43 kg FFM = 29.7 kcal/kg FFM — below the 30 kcal/kg FFM threshold for impaired bone and endocrine function (Loucks 2011; Mountjoy 2018/2023) — with no warning, on every day of the plan. | Appendix §J: collect body-fat % (optional; default M 15 % / F 23 %); compute `EA = (kcal_target − EEE_net)/FFM`; floor 30, target 45 on key days; deficit caps by day: rest/light ≤ 500, moderate ≤ 300, long/key/race-sim/race-week 0; Build/Peak ≤ 250 and light days only; show "Energy availability {EA} kcal/kg FFM" under Calories; when 7-day mean logged EA < 30 or weight falls > 1 kg/week, set `goalAdj = 0` and show the REDs warning text in §J. Remove the fixed 1,200 floor. | M | high |
| NUT-12 | P1 | Nutrition · protein | `targets.ts:86` `protein = 1.7 × w` regardless of goal; `:104` after-session protein 0.3 g/kg "at the next meal" for every non-rest session (22 g after a 15-min brick, race.ts 23 Apr); no pre-sleep dose; Guide cube (`nutrition.tsx:162`) itself says "up to 2.2 g/kg in a calorie deficit" | In an energy deficit lean-mass loss is limited only at 2.0–2.4 g/kg (Mettler 2010; Hector & Phillips 2018; Thomas 2016 "higher end … during energy restriction"); the app keeps 1.7 while prescribing −500 kcal. The 0.3 g/kg "after" dose after a 15-min session is noise that dilutes the real message on key days. | `protein_g_kg = goalAdj < 0 ? 2.2 : phase in Build/Peak ? 1.9 : 1.7`; after-session protein only for sessions ≥ 45 min or strength; pre-sleep 0.5 g/kg casein-type protein on days with `H_eff ≥ 2.5` or strength (Res 2012; Snijders 2015) as a fourth timing row. | S | high |
| NUT-13 | P1 | Nutrition · before-session carbs | `targets.ts:101` `before = (long || hard ? 1 : 0.5) × w`; Guide table (`Guide.tsx:100`) prints "{before} g carbs, 1–2 h before" for every session; race.ts: 37 g before a 15-min brick and a 45-min swim, 75 g "1–2 h before" a 06:30 tempo ride (A1-14, A1-35 saw the dawn mismatch) | The consensus pre-exercise range is 1–4 g/kg in the 1–4 h before (Thomas 2016; Kerksick 2017), scaled by how far out the meal is and whether the session needs it. The app has one number, one window, no clock, and prescribes it for sessions that need nothing. | Appendix §D: class the session (key ≥ 90 min or hard; easy; micro < 45 min easy / strength / technique) and compute by start time: ≥ 3 h available → 2–3 g/kg (key) / 1–1.5 (easy) / normal meal (micro); 1–2 h → 1 g/kg / 0.5 / 0; < 1 h → 20–40 g sugar / optional / 0; start ≤ 07:30 → key: 1 g/kg within 60–90 min or 30 g gel 15 min before plus fuel from minute 0, and "+1 g/kg carbs at dinner" the evening before; micro: fasted. | S | high |
| NUT-14 | P1 | Nutrition · after-session window | `targets.ts:104–105` carbs 1.1 g/kg + protein "within 60 min" for every session ≥ 60 min or hard (race.ts: every example); Guide cube `nutrition.tsx:97–98` says the window matters only when the next session is within 8 h (A1-15) | The rapid-refuelling rule (1.0–1.2 g/kg/h for 4 h) is for recovery gaps < 8 h (Burke 2011; Thomas 2016); when the next session is tomorrow, daily totals are what matter. (The brief's "< 24 h" is looser than the consensus; the published cut-off is 8 h, and beyond that the evidence for urgency is thin.) | Appendix §E: `gapH` to the next session → `< 8 h`: 1.0–1.2 g/kg/h × min(gap, 4) + 0.3 g/kg protein, "start within 30 min"; `8–24 h`: 1.0 g/kg in the first 2 h + 0.3 g/kg protein, "with the next meal"; `> 24 h` or micro: protein 0.3 g/kg only; plus rehydration 1.25–1.5 L per kg lost when a sweat rate is on file. | S | high |
| NUT-15 | P1 | Nutrition · caffeine in Supplements and Track | `supplements.ts:18–31` default "Caffeine 200 mg pre-session" ticked daily (A1-18: ticked at 08:00 on a 55-min easy swim); no body-mass scaling; Guide cube `nutrition.tsx:147–149` gives 3–6 mg/kg and "cut caffeine after 2 pm" but Track applies neither | Caffeine is dosed per kg (3–6 mg/kg, 45–60 min before; ISSN 2021 Guest et al.; Maughan 2018) and is pointless before a 55-min easy swim and harmful to sleep before an evening session. The checklist invites a 200 mg habit on every session day. | Make caffeine a session-level item in the Fuel block, not a daily checkbox: show it only for key sessions (≥ 90 min hard, race sims, races) with dose `3 mg/kg` rounded to 25 mg, time `start − 45 min`, and hide it when `start ≥ 15:00`; at set-up ask daily habit (none / < 100 / 100–300 / > 300 mg) to set the race-day plan (§H). | S | high |
| NUT-16 | P1 | Plan + Nutrition · gut training | `targets.ts:102` has no gut-training term; no field in `NutritionProfile` (`types.ts:36–39`); Guide cube `nutrition.tsx:175–188` describes an 8-week protocol and claims "Build 2 runs this schedule on every Saturday ride"; the generator (`plan/generate.ts`) writes no fuel target into any session (A1-16) | The one adaptation that decides whether 90 g/h is usable on race day is absent from the plan and from the fuel rule; the app jumps from 75 to 90 g/h at minute 241 for everyone. | Appendix §I: `gut_status: { level: "untrained" | "training" | "trained", current_g_h, max_tolerated_g_h, last_step_date }`; the generator stamps `fuel_g_h` on every long session from 10 weeks out (+10 g/h every 2 weeks from 60 to the race target); `sessionFuel` uses `min(need, sportCap, gut.current_g_h)`; the session panel shows "Gut-training step 3 of 6 · 80 g/h" and a one-tap "GI symptoms" log that holds the step. | M | high |
| NUT-17 | P1 | Nutrition Guide, Calculator, Supplements · written for one race | `nutrition.tsx:34, 105–125, 180, 191–201` ("Texas in April", "Swim (1.5 h) · Bike (6+ h) · Run (4.5+ h)", "Start in Base 3", "2 L/h+ happens in Texas heat"); `calculators.tsx:55, 266` (A1-19, D3-15) | A 70.3, marathon or fondo athlete reads an Ironman-Texas plan. | Appendix §H gives the four race-day tables as data keyed by `athlete.race.kind` and `climate`; the race cube renders from that data; "Texas" text becomes "{race.city} in {month}: {climate.tempRange}". | M | high |
| NUT-18 | P1 | Calculator › Carbs per hour vs Track | `calculators.tsx:181` `D<60?0 : D<150 ? (easy?30:45) : race?90 : moderate?70 : 60` vs `targets.ts:102` (A1-28, A3-17, A3-21: 180 min → 70 vs 75; 149 → 45, 150 → 90) | Two rules for one question; neither knows the sport or the gut status. | Delete the calculator's own rule; call `sessionFuel({sport, min, intensity}, profile)` from Appendix §C and add `sport` and `gut status` inputs (pre-filled from the profile) and "Use today's session". | S | high |
| NUT-19 | P2 | Nutrition · one "during" number for a 13-h race | race.ts: 24 Apr brick/Race/780 min → "90 g/h · 1,170 g during"; `Track.tsx:99` "During the session: 90 g/h, log it under Other" | A race (or race-sim brick) is three segments with different gut tolerance and logistics; one g/h and one 1,170 g total is not a plan anyone can execute. | Appendix §H per-segment plan for `intensity === "Race"` sessions and for bricks (bike leg g/h, run leg g/h); the Track card links to the race-day page instead of printing a single number. | M | high |
| NUT-20 | P2 | Nutrition Guide · "Energy needs" table and day-type thresholds | `Guide.tsx:49` uses `mk("bike", 240, "Endurance")` for "Long (4 h)" while real long days in the seed reach 5–6 h; `dayTypeOf` `long` = > 150 min vs `sessionFuel` `long` = ≥ 90 min (A1-31) | The example table stops at 4 h and the two "long" definitions disagree, so the table does not describe the athlete's actual biggest day. | Build the table from the plan's own largest week: rest / the median light day / the median moderate day / the biggest planned day (`max plannedMin`), labelled with its real sessions; one threshold table shared with `sessionFuel` (NUT-08). | S | high |
| NUT-21 | P2 | Calculator › Sweat rate | `calculators.tsx:149–175`: no urine field, no temperature or sport recorded, result not saved (A1-29, A3-20 units, A3-39 sodium label) | A sweat test without urine correction and without the conditions it was measured in cannot be reused on a different day; the Guide tells the athlete to measure and then discards the number. | Add inputs "Urine passed (ml)" (subtracted from loss), "Sport" and "Conditions (cool / mild / hot)"; "Save to my profile" writes `{ sweat_rate_l_h, sport, conditions, date }` to `NutritionProfile.sweat_tests[]`; the fuel rule uses the most recent test matching sport and conditions, else the default (§G). | S | high |
| NUT-22 | P2 | Nutrition · Setup | `Setup.tsx` collects weight, height, birth year, sex, goal, bottle, supplements; nothing about sweat, gut tolerance, caffeine habit, diet pattern, allergies, products | The fuel model cannot be personal without these inputs; Guide copy says "measure, don't guess" while set-up has nowhere to put the measurement. | Appendix §K lists the fields to add (sweat rate / sodium class, gut status, caffeine habit, dietary pattern, allergies and intolerances, products in use, body-fat %) and what each one drives. | M | high |
| NUT-23 | P2 | Nutrition · before-session carbs for strength and technique sessions | `targets.ts:101` `before = s.sport === "rest" ? 0 : …` → 37 g for a 20-min core session or a 45-min technique swim (race.ts 22 Apr: 37 g before a 45-min swim) | Carbohydrate before a short easy or technique session has no performance rationale and adds 150 kcal of instruction nobody needs. | Covered by NUT-13's "micro" class: `before = 0` and the text "no pre-fuel needed; normal meals". | S | high |
| NUT-24 | P3 | Nutrition · resting energy for athletes | `targets.ts:19–25` Mifflin–St Jeor only; `sex === "other"/null → core − 78` | Mifflin–St Jeor under-predicts RMR in lean trained people by ≈ 5–10 %; when body-fat % is known the Cunningham equation (500 + 22 × FFM) is the better fit for athletes (ten Haaf & Weijs 2014). Small, but it feeds every day's target. | `bmr = bodyFatPct != null ? 500 + 22 × FFM : mifflin`; show "RMR estimate (Cunningham)" in the tooltip. | S | med |
| NUT-25 | P3 | Nutrition Guide / Supplements / Calculator · three sweat-sodium ranges | `nutrition.tsx:36` "300–1,800 mg/L (average about 900)"; `supplements.ts:41` "200–2,000 mg/L … about 900"; `calculators.tsx:169` fixed 900 | Three statements of the same fact on three pages. | One constant set in §G (`SWEAT_NA = { low: 600, typical: 900, salty: 1200 }`, range text "200–2,000 mg/L") rendered everywhere. | S | high |
| NUT-26 | P3 | Nutrition · fibre | `targets.ts:91` `fibre = 30` fixed, never shown; Guide carb-load cube says "reduce fibre from 2 days out" | A fibre target exists in the data and is neither displayed nor lowered on load days and race day. | Show "Fibre {logged} / {target} g" only on load and race days with target 15 g; otherwise omit. | S | high |
| NUT-27 | P3 | Nutrition Guide · weight projection | `targets.ts:109–113` `kgPerWeek = avg × 7 / 7700` | The 7,700 kcal/kg rule is linear and over-predicts loss beyond a few weeks (Hall 2011); fine for a two-week projection, misleading extrapolated to race day in Guide.tsx:44. | Keep the rule, but limit the dashed projection to 6 weeks ahead and label it "straight-line estimate". | S | med |

## Score for my lens
Nutrition tied to training (science) : 4/10 — The scaffolding is right (Mifflin, g/kg carb bands by day, protein 1.7 g/kg, fat floor, duration-tiered g/h, a sweat-rate calculator, a sensible Guide) and the Guide cubes quote the consensus papers accurately. But the model that produces the numbers reads only planned minutes and a regex on the intensity word: no sport, no power/HR, no actual activity, no clock, no sweat rate, no gut status, no energy-availability check, and race week comes out inverted (5 g/kg and a deficit on loading days, 835 g fat on race day). The Guide and the numbers contradict each other on the same screen.

## Not verified
- Whether `Session.actual` is populated for the seed's September sessions (it would let NUT-02's fix work immediately); confirm by logging `weeks[4].sessions.map(s => s.actual?.min)` in the console.
- Keytel 2005 HR→kcal (Appendix §A) assumes a steady-state HR 90–150 bpm; for interval sessions the average HR under-counts by 10–20 %. Would need the per-second stream (known gap).
- The effect of the 1 kJ ≈ 1 kcal rule for riders with gross efficiency outside 22–25 % (untrained or very elite); ±8 %.

## Keep
- `targetsFor` as one pure function fed by profile + sessions: the right shape; the appendix only changes what goes in and the rules inside.
- The fat floor 0.8 g/kg and the "carbs give way" order (protein fixed, fat floored, carbs flexible) — correct priority, just needs the cap in NUT-01.
- Carb-periodisation by day (not a weekly average): the Guide's "Periodize, don't average" is the right message.
- The Guide cubes' numbers (during-exercise table, carb-loading, caffeine, supplements with evidence) are accurate to Jeukendrup 2014, Burke 2011, Maughan 2018; keep them and make the model agree with them.
- The sweat-rate calculator's arithmetic (fluid drunk counted as loss, 70 % replacement) is correct.

## Challenges
none

---

# Appendix · Session-fuelling model specification

Scope: replaces `sessionFuel`, `sessionKcal`, the carb/fluid/sodium parts of `targetsFor`, and the Carbs-per-hour calculator with one model. Everything below is a rule the developer can type in; where a number is a judgement call rather than a measured consensus it is marked **thin**. Units internal: kg, g, ml, kcal, minutes; display follows the athlete's unit setting.

## 0. Inputs

**Existing (already in the data, mostly unused):** `profile.weight_kg, height_cm, birth_year, sex, goal, goal_weight_kg, weight_stages, base_kcal, bottle_ml`; `Session.sport, min, intensity, start, date, status, actual`; `Activity.min, hr, mi, pace_s, mph, yd, exertion`; `intake.fitness.bike_ftp, lthr, vo2max, run_pace, swim_pace_100`; `athlete.race.{kind, date, city}`; `plan.phase`.

**New (set-up, §K):** `body_fat_pct`, `sweat_tests[]`, `sweat_na` (class or mg/L), `gut` (status + current g/h + max tolerated + symptom log), `caffeine_habit`, `caffeine_race`, `diet`, `restrictions[]`, `products[]`. **New per session:** `fuel_g_h` (stamped by the plan generator on gut-training sessions), `hot` (from race climate or weather later), `segments[]` for races and bricks. **New per log entry:** `at` (HH:MM) and `fuel: true` (eaten during a session).

**Derived once per athlete:** `FFM = weight × (1 − body_fat_pct/100)` (default body fat M 15 %, F 23 % when unknown — **thin**, population guess; show "estimated"); `RMR` = Mifflin–St Jeor (current) or Cunningham `500 + 22 × FFM` when body fat is entered (ten Haaf 2014).

**Session class** (used everywhere below): `micro` = `min < 45` and easy, or `sport ∈ {strength}` or `intensity === "Technique"`; `key` = `min ≥ 90` or `intensity ∈ {Tempo, Intervals, Race}`; `easy` = the rest. Intensity groups: easy = Zone 2 / Aerobic / Technique; moderate = Endurance; hard = Tempo / Intervals; race = Race.

## A. Session energy (kcal)

Priority order; the first available method wins and the method name is shown in the tooltip ("from power", "from heart rate", "from distance", "estimate").

| Method | When | Formula | Caps / notes | Source |
|---|---|---|---|---|
| A1 Power | bike or brick-bike leg; `actual` has kJ or avg power, or `bike_ftp` is known | `kcal = kJ × 1.0`, where `kJ = avgW × seconds / 1000`. Planned: `avgW = FTP × IF`, IF by intensity: Technique 0.55 · Zone 2 0.65 · Aerobic 0.68 · Endurance 0.70 · Tempo 0.82 · Intervals 0.85 · Race 140.6 0.70 / 70.3 0.80 / fondo 0.75 / Olympic 0.88. So `kcal ≈ FTP × IF × min × 0.06` | 1 kJ of work ≈ 1 kcal of energy because gross efficiency is 22–25 % (kcal = kJ × 0.239 / GE; at GE 0.24 the factor is 0.996). ±8 % for riders outside that efficiency band | Coyle 1992; Hopker 2009; Jeukendrup & Martin 2001 |
| A2 Heart rate | `actual.hr` present (any sport), or planned with `lthr` and a zone → HR | Keytel 2005, kJ/min → ÷ 4.184 for kcal/min. Male: `(−55.0969 + 0.6309·HR + 0.1988·kg + 0.2017·age) / 4.184`. Female: `(−20.4022 + 0.4472·HR − 0.1263·kg + 0.074·age) / 4.184`. With VO2max known, male: `(−95.7735 + 0.634·HR + 0.404·VO2max + 0.394·kg + 0.271·age) / 4.184`; female: `(−59.3954 + 0.45·HR + 0.380·VO2max + 0.103·kg + 0.274·age) / 4.184`. Planned HR: Zone 2 0.80·LTHR, Aerobic 0.84, Endurance 0.86, Tempo 0.93, Intervals 0.95, Race 0.88 (140.6) / 0.93 (70.3) | Valid 90–150 bpm steady-state; SEE ≈ ±17 %; clamp 4–25 kcal/min; for interval sessions average HR under-counts 10–20 % (known stream gap). If a device-reported calorie value is imported (Garmin/Firstbeat) accept it as A2 | Keytel 2005 J Sports Sci 23:289 |
| A3 Pace/distance | run, hike; `mi`/`pace_s` logged or `run_pace` known | `kcal = kg × km × 1.0` (gross cost of level running ≈ 1 kcal/kg/km; net 0.9). Planned km = min ÷ pace, pace by intensity: easy = `run_pace`, Tempo = 0.83 × easy pace time, Intervals 0.85 (average incl. recoveries), Race = goal pace. Grade: +3 % per 1 % average grade when `elev_ft` is known | Margaria 1963; ACSM metabolic equation (VO2 = 0.2·v + 3.5). ±5 % | — |
| A4 Swim | swim | MET × kg × h with MET: Technique/easy 6.0 · Aerobic/Endurance 7.5 · Tempo/Intervals 9.0 · Race 9.8 | Ainsworth 2011 codes 18310/18240/18230 | Ainsworth 2011 |
| A5 Fallback MET | anything else | strength 4.5 (circuit 6.0) · hike 6 · other 6 · bike (no FTP): Zone 2 6.8, Aerobic 7.5, Endurance 8.0, Tempo 9.5, Intervals 10, Race 8.5 · run (no pace): easy 9.0, Endurance 9.8, Tempo 11.5, Intervals 12, Race 11 | Keep as last resort only; tooltip says "estimate" | Ainsworth 2011 |
| Brick | split the text ("Bike 1:30 + Run 0:20") into legs and sum A1/A3 | strength appended to a ride (A3-41) is its own A5 leg | | |

**Net exercise energy for energy availability:** `EEE_net = kcal − RMR × min / 1440` (the resting share would have been spent anyway). The daily calorie target uses gross `kcal`; §J uses `EEE_net`.

**Actual vs planned (NUT-02):** for a session with `actual`, use `actual.min` and the best available method; for `status === "missed"` on a past day use 0; otherwise the plan.

## B. Carbohydrate oxidation and the exogenous fraction (why the during-number is not energy-based)

- Total carbohydrate burn: at Zone 2 (60–65 % VO2max) carbohydrate supplies 50–60 % of energy → `≈ kcal × 0.55 / 4.1` ≈ 1.0–1.5 g/min (60–90 g/h) for a 75-kg trained athlete; at tempo (80–85 % VO2max) 75–85 % of energy → 2–3 g/min (120–180 g/h) (Romijn 1993; van Loon 2001).
- Stores: muscle glycogen 300–500 g, liver 80–100 g after a carbohydrate-rich day; liver roughly halves overnight. A 4-h Z2 ride burns ≈ 300 g of carbohydrate; without intake the athlete finishes glycogen-depleted, with 75 g/h intake about half comes from the bottle.
- Exogenous oxidation ceilings: glucose/maltodextrin alone plateaus at ≈ 1.0–1.1 g/min (60–65 g/h) because intestinal SGLT1 transport saturates; adding fructose (GLUT5) raises it to 1.26 g/min at 1.8 g/min intake (Jentjens 2004) and ≈ 1.75 g/min at 2.4 g/min intake (Jeukendrup 2010). Efficiency of absorption is therefore 65–75 % at high rates: of 90 g/h eaten, 60–70 g/h is burned in hour 2+.
- Fraction: in a Z2 ride at 75 g/h intake, exogenous carbohydrate covers ≈ 70 % of carbohydrate burned after the first hour; at tempo it covers ≤ 40–50 %. The gap is glycogen, which is what the day's g/kg (§F) refills.
- Body mass: exogenous oxidation does not scale with body mass in the data (Jeukendrup 2014 states this explicitly, which is why the guidance is in g/h, not g/kg/h). The gut is the limit, not the muscle mass. Hence §C is in g/h with sport and gut caps, and never "replace X % of calories burned" — that rule produces 150–250 g/h on tempo days, which no gut absorbs.
- Above 90 g/h: Podlogar & Wallis 2022 review evidence that up to 120 g/h with glucose:fructose ≈ 1:0.8 can be tolerated and may reduce muscle-damage markers and improve late-race performance in trained athletes (Viribay 2020, Urdampilleta 2020). **Thin**: a handful of studies, small n, mostly in runners at 120 g/h; treat as an option for gut-trained athletes on long bike legs, not a default.

## C. Carbohydrate per hour DURING (the exact rule)

```
need(min, group):                       // g/h, Jeukendrup 2014 / Thomas 2016 tiers
   min < 45            → 0 (water)
   45–74               → 0   (hard: "mouth rinse or 20 g optional")
   75–119              → easy 0–20 (optional) | moderate 30 | hard 30
   120–149             → easy 30 | moderate 45 | hard 45
   150–179             → easy 45 | moderate 60 | hard 60
   180–239             → easy 60 | moderate 75 | hard 75
   ≥ 240               → easy 75 | moderate 90 | hard/race 90

sportCap(sport, gut):                   // g/h
   bike   → gut.level === "trained" && gut.max_g_h ≥ 110 ? 120 : 90
   run    → gut.level === "trained" ? (intensity === "Race" ? 90 : 75) : 60
   brick  → per leg (bike leg uses bike cap, run leg uses run cap)
   swim   → min ≥ 75 ? 30 : 0            // bottle on deck
   hike   → 45;  strength → 0;  other → 60

gutCap(gut):                            // g/h
   untrained → 60
   training  → gut.current_g_h          // stamped by the plan, §I
   trained   → gut.max_g_h

perHour = min(need, sportCap, gutCap)
form    = perHour ≤ 60 ? "any single carbohydrate (maltodextrin, glucose, sucrose)"
        : perHour ≤ 90 ? "glucose:fructose 2:1 (or sucrose/maltodextrin mix)"
        : "glucose:fructose 1:0.8"
total_g = perHour × min / 60
timing  = "first dose at minute 15–20, then every 15–20 min in equal doses"
```

Restrictions: `fructose` intolerance → cap 60 and form "glucose/maltodextrin only"; `fodmap` → same plus "no sugar alcohols".

Products: translate `total_g` into the athlete's own `products[]` (e.g. "70 g/h = 500 ml mix (40 g) + 1 gel (30 g) per hour"); fall back to the generic gel 25 g / drink 6 % wording now in the Guide.

Caps and rationale: 60 g/h single-source and 90 g/h multiple-transportable are the absorption ceilings in §B (Jeukendrup 2014; Thomas 2016 "up to 90 g/h for > 2.5 h"; Kerksick 2017 "30–60 g/h, higher with multiple transportable"). 120 g/h only when §I has recorded ≥ 2 sessions at ≥ 100 g/h without symptoms ≥ moderate (Podlogar & Wallis 2022). Run caps: GI symptoms are 2–3× more frequent running than cycling (Pfeiffer 2012); 60 g/h is what finishers of Ironman runs actually average without symptoms. Swim 30 g/h: **thin**, practice-based.

Where shown: dashboard hero (one line: "During · 45 g/h = 1 gel every 30 min · 0.5 L/h"); plan session panel (Fuel block, three rows + products); nutrition day view (new "During session" timing row, NUT-10); week view (column "Fuel during, g"); race-day page (per segment, §H); the Calculator calls this function (NUT-18).

## D. Carbohydrate BEFORE (1–4 g/kg in the 1–4 h window, scaled by session and clock)

```
hoursAvailable = (start − 05:30 earliest meal) in hours     // athlete-editable "earliest I will eat"
window = hoursAvailable ≥ 3   ? "3 h"
       : hoursAvailable ≥ 1.5 ? "1.5 h"
       : hoursAvailable ≥ 0.75? "45 min"
       :                         "dawn"
g/kg by window × class:
                 key          easy         micro
   "3 h"         2.0 (–3.0)   1.0 (–1.5)   normal meal, no target
   "1.5 h"       1.0 (–1.5)   0.5          0
   "45 min"      0.4 (20–40 g quick sugar)  optional 0.3   0
   "dawn"        0.5–1.0 at start − 45–60 min (toast + jam, oats) OR 30 g gel/drink at start − 15 min and fuel from minute 0; plus "+1 g/kg carbs at dinner the night before"   |   easy: fasted or 20–30 g optional   |   micro: 0
before_g = round(g/kg × kg); at = start − window
```
Also: low fibre (< 5 g) and low fat (< 10 g) inside 1.5 h; protein 20–30 g fine at 3 h; fluid 5–7 ml/kg in the 4 h before, 3–5 ml/kg 2 h before (Sawka 2007). Evening sessions (start ≥ 16:00): the "3 h" window is lunch (2 g/kg at 12:30) + a 0.5 g/kg snack at start − 1.5 h.

Sources: Thomas 2016 (1–4 g/kg, 1–4 h); Kerksick 2017; Burke 2011. **Thin**: the dawn trade-off (sleep vs breakfast) has no trial; the "+1 g/kg at dinner" is practice.

Where shown: dashboard hero ("Before · 110 g by 06:30"), session panel, nutrition day view (row keyed to the real meal slot, NUT-03), race-day page (breakfast line).

## E. AFTER

```
gapH = hours to the next planned session (next day counts); micro sessions → protein only
   gapH < 8            → carbs 1.0–1.2 g/kg/h for min(gapH, 4) h, start within 30 min;  protein 0.3 g/kg (20–40 g) in the first feed
   8 ≤ gapH ≤ 24       → carbs 1.0 g/kg once, within 2 h (i.e. the next meal);  protein 0.3 g/kg
   gapH > 24 or none   → carbs: none beyond the day's total;  protein 0.3 g/kg at the next meal
skip carbs when: class micro, or easy and min < 60
pre-sleep: 0.5 g/kg slow protein (casein, dairy) when H_eff ≥ 2.5 or a strength session that day (Res 2012; Snijders 2015)
rehydrate: 1.25–1.5 L per kg of mass lost (sweat loss − drinks), with sodium, over 2–4 h — shown when a sweat rate is on file (§G)
protein per feed: 0.3–0.4 g/kg, 3–4 h apart (Jäger 2017), leucine ≈ 2.5–3 g
```
Sources: Burke 2011; Thomas 2016 ("< 8 h recovery: 1.0–1.2 g/kg/h for the first 4 h"); Kerksick 2017 (protein 0.25–0.4 g/kg within 2 h; "the window is wider than once thought"); Jäger 2017. Note the brief's "< 24 h" is looser than the literature's < 8 h cut-off; the 8–24 h row above is a practical middle (**thin**).

Where shown: hero (short), session panel, day view timing row "After session" with the real slot, week view (no).

## F. Daily carbohydrate by actual planned load (Burke 2011 / Thomas 2016 bands)

```
H_eff = Σ over the day's sessions: (min/60) × w,  w = easy 0.8 · moderate 1.0 · hard 1.2 · Technique swim 0.6 · strength 0.4 · hike 0.6
carbs_g_kg = clamp(3.5 + 1.6 × H_eff, 3.0, 12.0)
           + 1.0 if tomorrow is a key day with min ≥ 180 or a race sim    (pre-load; Burke 2011 "fuel up")
override:  load day (race −2, −1)  → 10 (140.6, fondo > 5 h, marathon) / 8–10 (70.3)   (Burke 2011: 10–12 g/kg/d for 36–48 h)
           race day               → carbs = Σ race-day plan (§H), not g/kg
labels (display only): rest H_eff < 0.25 · light < 1.25 · moderate < 2.5 · long < 4 · very long ≥ 4 · load · race
energy cap: carbs ≤ (kcal_target − protein×4 − 0.8·kg×9)/4; when the cap binds on a key day, shrink goalAdj first (§J), not carbs
```
Check against the bands: 1 h easy → 4.8 g/kg (band 5–7 ✓ low end); 2 h Z2 → 6.1 (6–10 ✓); 90-min tempo → 6.4; 4 h Z2 → 8.6 (8–12 ✓); 5-h race sim → 12 (cap). Protein: `1.7 g/kg`, `1.9` in Build/Peak, `2.2` whenever `goalAdj < 0` (Mettler 2010; Hector & Phillips 2018). Fat: remainder, floor 0.8 g/kg, ceiling 35 % of kcal on ordinary days and 1.0 g/kg on load/race days.

Sources: Burke 2011 Table 1 (3–5 / 5–7 / 6–10 / 8–12 g/kg); Thomas 2016 (same bands). **Thin**: the straight line through the bands and the weights `w` are my interpolation; the bands themselves are expert consensus, not trial end-points.

Where shown: day view carb KPI ("647 g · 8.6 g/kg · long day"), Guide "Energy needs" table built from the plan's real days (NUT-20), week view.

## G. Fluid and sodium

```
baseline_ml  = 35 × kg                      // total water incl. food (EFSA 2010: 2.0–2.5 L/d adults ≈ 30–35 ml/kg)
drinks_base  = 0.8 × baseline_ml            // shown as the rest-of-day drinks target (food water ≈ 20 %)
sweatRate(sport, conditions) L/h =
   measured: latest sweat_tests entry with the same sport and conditions (≤ 180 days old), else same sport any conditions × factor (cool 0.75, hot 1.5)
   default : bike cool 0.6 · mild 0.8 · hot 1.2 ; run cool 0.8 · mild 1.0 · hot 1.5 ; swim 0.3 ; strength 0.5 ; hike 0.7
drink_l_h    = clamp(0.7 × sweatRate, 0.3, measured ? min(1.2, 0.8 × sweatRate) : 0.8)
drink_total  = drink_l_h × min/60   (min ≥ 45 only; swims: optional 0.3 L on deck)
pre          = 5–7 ml/kg 4 h before; 3–5 ml/kg 2 h before  (key sessions and races)
post         = 1.25–1.5 L per kg lost, where lost = sweatRate × h − drink_total (kg ≈ L)
sodium:
   sweatNa mg/L = measured ?? { low 600, typical 900, salty 1200 }[sweat_na ?? "typical"]
   gate         = min > 90 || (min > 60 && hot)
   na_mg_h      = gate ? round(sweatRate × sweatNa × 0.7 / 50) × 50 : 0
   drink conc.  = 500–700 mg/L in the bottle (ACSM 20–30 mmol/L); capsules for the rest
   daily        = no target; show logged dietary sodium as information only (NUT-06)
warning (hyponatraemia): show on the hydration card and the session panel when
   logged drinks during a session > 1.0 L/h, or > sweatRate × 1.2, or body mass after > before:
   "You drank more than you sweat. Over-drinking lowers blood sodium (exercise-associated hyponatraemia), the most dangerous fluid problem in long events. Cap {drink_l_h} L/h; drink to thirst on the run."
```
Sources: Sawka 2007 (limit mass loss to < 2 %, never gain; sodium 0.5–0.7 g/L for > 1–2 h; typical sweat 0.5–2.0 L/h); Thomas 2016; Hew-Butler 2015 (over-drinking is the cause of EAH; thirst-guided drinking; sodium does not protect against over-drinking); Baker 2017 (sweat sodium 200–2,000 mg/L, median ≈ 900; rate varies 3×); Shirreffs & Maughan 1998 (150 % replacement). **Thin**: the default sweat rates are population medians and can be off 2× for an individual — the whole point of saving the sweat test (NUT-21). Accepting 2–3 % loss late in long events without performance cost is supported for cycling (Goulet 2011) but the app should keep the 2 % message.

Where shown: day view hydration card (drinks target split "rest of day 2.1 L · during ride 2.4 L · after 1.0 L"), session panel ("0.6 L/h · 500 mg sodium/h"), week table ("Fluid during, L", "Sodium during, mg" replacing the daily sodium column), race-day page, calculator (Sweat rate → "Save to profile").

## H. Race-day plan (by event; tables are data keyed by `race.kind`, rendered on a Nutrition › Race day page and in the Guide cube)

Common rules: loading 36–48 h at the §F load value (10–12 g/kg/d; 8–10 for 70.3; Burke 2011; Bussau 2002 shows a trained athlete fills glycogen in one day at 10 g/kg); fibre ≤ 15 g/d, fat 0.8–1.0 g/kg, protein 1.5 g/kg, +1–2 kg mass is water (3 g per g glycogen); `goalAdj = 0` from race −7; nothing untested; breakfast = §D "3 h" row; pre-start fluid §G; caffeine total ≤ 6 mg/kg (Guest 2021), first dose 3 mg/kg at start − 45–60 min *or* at the start of the bike for triathlon (sleep and swim comfort; **thin**), 1 mg/kg boosters; habitual users need no withdrawal (Gonçalves 2017). Heat: pre-cool 500 ml cold drink 30 min before, ice at aid stations (Bongers 2015, modest effect, **thin**).

| Event (typical split for this athlete) | −2 / −1 days | Breakfast | Start −15 min | Segment plan: carbs · fluid · sodium | Caffeine | Carry |
|---|---|---|---|---|---|---|
| **140.6** (swim 1:25 · bike 6:20 · run 4:50) | 10 g/kg/d, low fibre; sodium +1 g on −1 in heat (Sims 2007, **thin**) | 3 h out: 2 g/kg (150 g) + 500 ml; ≤ 10 g fat, 20 g protein | 25 g gel + 200 ml | Swim 0 · T1: 25 g gel + 200–300 ml · **Bike** 80–90 g/h (90–120 if §I trained) in 2:1 mix + gels; fluid `drink_l_h` for bike/hot (0.8 L/h) ; Na 700–800 mg/h hot (`na_mg_h`); water + 1 gel only in the first 20 min after the swim · T2: 200 ml · **Run** 60 g/h (gels every 20–25 min, cola/chews from mile 13), fluid to thirst 0.4–0.6 L/h, Na 300–500 mg/h | 3 mg/kg total split: 1.3 mg/kg at bike km 5, 0.7 mg/kg at bike h 4, 1 mg/kg at run km 12–15; cap 6 mg/kg | Bike: 2 × 750 ml at 90 g mix (180 g) + 6 gels (150 g) + aid drink; special-needs: 2 bottles mix + 2 gels. Run: 4 gels + 4 salt caps (200 mg) + aid cola |
| **70.3** (swim 0:38 · bike 2:50 · run 2:00) | −1: 10 g/kg; −2: 8 g/kg | 2.5–3 h: 1.5–2 g/kg (110–150 g) | 25 g gel + 200 ml | Swim 0 · T1 gel · **Bike** 75–90 g/h (IF 0.8 lowers tolerance; 75 untrained-ish, 90 trained), fluid 0.6–0.8 L/h, Na 500–800 mg/h hot · **Run** 60 g/h (gel at 20, 45, 70, 95 min + cola), fluid to thirst 0.4–0.6 L/h, Na 300–500 mg/h hot | 3 mg/kg at start − 45 min or bike start; 1 mg/kg at T2 | Bike: 2 bottles mix (120 g) + 3 gels. Run: 3 gels + 2 salt caps |
| **Marathon** (2:45–5:00) | 10–12 g/kg/d for 36–48 h (Burke 2011) | 3 h: 2 g/kg (150 g; 110 g if the start is early), low fibre | 25 g gel + 200 ml | 60 g/h: 30 g gel every 25 min from km 5; 90 g/h only if §I trained (Stellingwerff 2012; Viribay 2020); fluid 0.4–0.8 L/h to thirst from cups; Na 300–500 mg/h only if > 3 h or hot | 3 mg/kg at start − 60 min; 1 mg/kg (caffeinated gel) at km 28–32 | 6–9 gels (or 4 + aid-station drink), 2 salt caps in heat |
| **Gran fondo** (4–7 h) | −1: 10 g/kg; −2: 8 g/kg | 3 h: 2 g/kg | gel + 200 ml | 75–90 g/h (solids/bars allowed in the first half; gels and mix on climbs; 90–120 trained), fluid `drink_l_h` 0.6–1.0 L/h, Na 500–900 mg/h; refill at feed zones | 2–3 mg/kg at the start; 1 mg/kg at hour 3–4 | 2 bottles mix + 6 gels + 2 bars; rice cakes if practised |

Segment arithmetic for the app: `segments[] = [{ leg, min, g_h, fluid_l_h, na_mg_h }]`; totals summed into the day view ("Race day · 1,030 g carbs · 8.7 L · 6.7 g sodium") and the Track card links to the page (NUT-19). Post-race: §E `< 8 h` row once (1.0 g/kg + 0.3 g/kg protein), rehydrate 1.25–1.5 L/kg lost; no energy target that day.

## I. Gut-training protocol (plan-level, §C `gutCap` reads it)

```
start     = race − 10 weeks (minimum 8; Jeukendrup 2017), on the week's longest bike/run
target    = race bike g/h (90; 120 optional) and run g/h (60–75)
schedule  = week 1–2: 60 g/h · +10 g/h every 2 weeks → 70, 80, 90 (bike); run: 40 → 50 → 60 (→ 75)
each step is stamped on the session: fuel_g_h, gut_step "3 of 6", and the race products/fluid volume
every 3rd long session: full race fluid volume as well (drink_l_h of the race climate), race breakfast before the 3 longest sessions
diet       : ≥ 6 g/kg/d carbohydrate on gut-training days (Cox 2010: daily high-carb availability raised exogenous oxidation ≈ 16 %)
symptoms   : one-tap log on the session (none / mild / moderate / severe); two sessions ≥ moderate → hold the step for 2 weeks (−20 g/h), then resume
status     : gut.level "training" with current_g_h = this week's step; after the race-sim at target without symptoms ≥ moderate → "trained", max_g_h = highest symptom-free rate
also       : no "train-low" long sessions inside the block; practise the T1 "water only for 20 min" pattern on bricks
```
Evidence: Jeukendrup 2017 review (strategies: train with high carbohydrate, high fluid volume, high-carb diet, practise race nutrition); Costa 2017 (2 weeks of 90 g/h during runs reduced GI symptoms and carbohydrate malabsorption); Cox 2010; Miall 2018. **Thin**: n ≤ 20 per study, no performance RCT; the effect on race-day symptoms is plausible and the downside is nil.

Where shown: plan session panel (gut-step line), week overview (badge on the long session), nutrition day view (During row target = the step), Guide cube (dates computed from the race date, not "Base 3").

## J. Weight-management guardrails

```
deficit cap by day label:  rest/light ≤ 500 · moderate ≤ 300 · long/very long/key/race-sim 0 · load/race/race-week 0
phase cap:                 Base: as above · Build/Peak: ≤ 250 and light days only · Taper: 0
rate cap:                  ≤ 0.5 kg/week (≈ 0.7 % BM/wk; Garthe 2011 — slower loss kept lean mass and performance)
goalAdj                   = max(−cap, min(+300, needed))       // replaces the fixed −400 / −500
energy availability        EA = (kcal_target − EEE_net) / FFM   // kcal/kg FFM/day
   floor 30 on any day (raise kcal_target until EA ≥ 30; this overrides goalAdj) ; target ≥ 45 on key days
   show "Energy availability 42 kcal/kg FFM" under Calories; logged-EA uses logged kcal instead of target
protein in deficit         2.2 g/kg (§F)
REDs warning (plain, not a diagnosis), replaces goalAdj with 0 until the athlete re-enables it:
   trigger: 7-day mean logged EA < 30 (≥ 5 days logged), or weight −1 kg/week over 2 weeks, or logged kcal < 80 % of target on ≥ 5 of 7 days
   text: "Seven days of low energy availability. Risk of illness, bone injury, poor sleep and hormone disruption rises (REDs). The deficit is paused; eat to the target for a week. See a sports physician if periods stop, or if resting HR keeps rising."
remove:                    the fixed 1,200 kcal floor (EA floor replaces it) ; the 7,700 kcal/kg projection stays but limited to 6 weeks (NUT-27)
```
Sources: Loucks 2011 (30 kcal/kg FFM threshold, 45 for full function — from 4–5-day lab studies in women; men appear to tolerate slightly lower); Mountjoy 2018 (RED-S consequences); Mountjoy 2023 (REDs: the 30/45 cut-offs are screening heuristics with large individual variation and should not be used as diagnostic thresholds — hence a warning, never a label); Hector & Phillips 2018; Mettler 2010; Garthe 2011; Hall 2011. **Thin**: EA from an app's estimated intake and estimated expenditure carries ±20 % error on both terms; the 7-day mean and the double trigger (EA and weight) are there to avoid false alarms.

## Worked examples · 75 kg male, 178 cm, 32 y, FFM 64 kg, FTP 230 W, LTHR 165, easy pace 9:30/mi, tempo 7:45/mi, no sweat test (defaults, mild), gut "training" at 70 g/h, caffeine habit 100–300 mg/day, goal maintain. RMR 1,708 kcal (Mifflin), base 2,391.

| Output | 4-h Z2 ride · Sat 08:00 | 90-min tempo run · Thu 06:30 (15 easy + 3×15 tempo/5 easy + 15 easy) | 55-min easy swim · Wed 06:30 | 140.6 race day · Sat 06:50 (1:25 / 6:20 / 4:50) |
|---|---|---|---|---|
| Class | key (≥ 90 min) | key (hard) | easy (not micro: 55 ≥ 45 and Aerobic) | race |
| Energy (method) | 150 W × 14,400 s = 2,160 kJ ≈ **2,160 kcal** (power; current app 2,100) | 16.2 km × 75 = **1,250 kcal** (pace); HR check at 152 bpm → 1,340; app 1,294 | 6 MET × 75 × 0.92 = **413 kcal** (app 516) | 797 (swim) + 3,560 (bike, 156 W) + 3,165 (run) = **7,520 kcal** (app 8,752) |
| EEE_net | 2,160 − 285 = 1,875 | 1,250 − 107 = 1,143 | 413 − 65 = 348 | n/a |
| CHO burned (§B) | ≈ 290 g (72 g/h); intake covers ≈ 70 % after h 1 | ≈ 230 g (150 g/h); intake covers ≈ 20 % | ≈ 50 g | ≈ 1,000 g |
| Before (§D) | 1.5-h window (06:30): **1.0–1.5 g/kg = 75–110 g**, low fibre | dawn: **40–75 g at 05:30** or **30 g gel at 06:15** + fuel from min 0; +75 g at Wed dinner | **0** — fasted is fine; 20–30 g optional | 03:50: **150 g** (2 g/kg) + 500 ml; 06:35: 25 g gel + 200 ml |
| During (§C) | need 75 · bike cap 90 · gut 70 → **70 g/h · 280 g**, 2:1 mix (≈ 500 ml mix 40 g + 1 gel 30 g per hour); first at min 15 | need 30 · run cap 60 · gut 70 → **30 g/h · 45 g** = gel at min 30 and 60 | **0** (water bottle on deck) | Swim 0 · T1 25 g · Bike 85 g/h × 6.3 h = **540 g** · T2 0 · Run 60 g/h × 4.8 h = **290 g** → 1,030 g in total; current app "90 g/h · 1,170 g" |
| Fluid (§G) | 0.8 L/h default → **0.6 L/h · 2.4 L** (3 bottles); after: lost 0.8 kg → **1.0–1.2 L** over 2–4 h | 1.0 L/h → **0.6 L/h · 0.9 L** (practical: 0.5 L handheld); after 1.1–1.35 L | 0.3 L optional | Bike hot 1.2 L/h → **0.8 L/h · 5.1 L**; run to thirst **0.5 L/h · 2.4 L**; total ≈ 8.7 L (app 9.1 L by coincidence) |
| Sodium (§G) | gate on (> 90 min): 0.8 × 900 × 0.7 = **500 mg/h · 2,000 mg** (mix at 600–700 mg/L) | gate off (90 min, mild): **0**; hot: 630 mg/h | 0 | Bike **750 mg/h · 4,750 mg**; run **400 mg/h · 1,900 mg** (2 caps/h); app "8,800 mg" daily |
| After (§E) | next session Sun 08:00 → gap 20 h: **75 g carbs + 22 g protein within 2 h** | gap 22.5 h: **75 g + 22 g** = breakfast after the run | protein **22 g** at breakfast; no carb window | once: 75–90 g + 22 g protein; rehydrate 1.25–1.5 L/kg lost |
| Caffeine | none (Z2) | optional **225 mg at 05:45** (3 mg/kg) | none | 100 mg bike km 5 · 50 mg bike h 4 · 75 mg run km 12–15 = 225 mg (cap 450) |
| Day carbs (§F) | H_eff 3.2 → **8.6 g/kg · 647 g** (app 8 g/kg 600 g) | H_eff 1.8 → **6.4 g/kg · 479 g** (app "moderate" 6 g/kg 450 g; before-rule "long") | H_eff 0.73 → **4.7 g/kg · 350 g** (app 5 g/kg 374 g) | Σ plan = **1,130 g** incl. recovery (app 10 g/kg = 748 g); −2/−1: 750 g/d (app 374 / 345 g) |
| Day kcal · protein · fat | 4,551 · 128 g · 161 g (32 %) | 3,641 · 128 g · 135 g | 2,804 · 128 g · 99 g | no kcal target shown; fat 1.0 g/kg (app 835 g) |
| EA (§J) | (4,551 − 1,875)/64 = **42** ✓ | (3,641 − 1,143)/64 = **39** ✓ | **38** ✓ | n/a |
| Deficit allowed (§J) | 0 (long day) | ≤ 300 (moderate) — EA would drop to 34, still ≥ 30 | ≤ 500 → EA 30.6, just above the floor (a 60-kg athlete would hit the floor first) | 0 |
| Hero line | "Fuel · 110 g carbs by 06:30 · 70 g/h + 0.6 L/h + 500 mg Na/h · after: 75 g + 22 g protein" | "Fuel · 30 g gel at 06:15 · 1 gel at 30 and 60 min · 0.5 L · after: breakfast 75 g + 22 g" | "Fuel · water · 22 g protein at breakfast" | link: "Race-day plan →" |

## K. Nutrition set-up: add / remove

Add (in this order, after body data): **(1) Body-fat % (optional)** → FFM, Cunningham RMR, EA. **(2) Sweat** — "Have you measured your sweat rate?" → sweat test (sport, conditions, L/h; or the calculator's Save) and sweat-sodium class: low / typical / salty (visible salt on kit) / measured mg/L → §G. **(3) Gut status** — "Most carbohydrate per hour you have taken without stomach trouble": < 40 / 40–60 / 60–90 / 90+ g/h → `gut.level`, `max_g_h`; §I schedules from it. **(4) Caffeine** — daily habit none / < 100 / 100–300 / > 300 mg; "use caffeine on race day" yes/no → §H dose and timing. **(5) Diet pattern** omnivore / pescatarian / vegetarian / vegan → protein-source examples and leucine note; **restrictions**: gluten · lactose · fructose · low-FODMAP · nuts · soy · egg → §C form cap and product filter. **(6) Products I use** — pick from the Store catalogue or type: drink mix (g carbs and mg sodium per serving), gel (g, caffeine mg), chews, bar → §C/§H translate grams into "1 bottle + 1 gel". **(7) Earliest meal time** (default 05:30) → §D windows. Keep: weight/height/birth year/sex, goal and stages, own rest-day calories, bottle size. Move: the supplement checklist after products, with caffeine/sodium/carbohydrate removed from it (they become session-level, NUT-15). Remove: nothing else; "Skip, use defaults" must not invent 75 kg (CODE-19).

## Where each output appears

| Output | Dashboard hero | Plan session panel | Nutrition day view | Nutrition week view | Race-day page |
|---|---|---|---|---|---|
| Session energy + method | kcal in the card footer | yes, with method | Calories tooltip, per session | "Training kcal" column | per segment |
| Before | one line | row | timing row (real slot) | — | breakfast line |
| During g/h, form, products | one line | row + products | "During session" row | "Fuel during, g" | per segment |
| Fluid during / sodium during | with During | row | hydration card split | two columns | per segment |
| After (+ rehydrate, pre-sleep) | one line | row | timing rows | — | post-race |
| Caffeine (key sessions) | — | row | timeline marker | — | schedule |
| Day carbs g/kg + label | — | — | carb KPI | column | load days |
| EA + deficit cap + warnings | — | — | under Calories; hydration warning | EA column | — |
| Gut-training step | — | row + symptom log | During target | badge | — |

## Sources
Jeukendrup A. Sports Med 2014;44(S1):S25 · Burke LM et al. J Sports Sci 2011;29(S1):S17 · Thomas DT, Erdman KA, Burke LM. J Acad Nutr Diet 2016;116:501 / MSSE 2016;48:543 · Kerksick CM et al. ISSN nutrient timing, JISSN 2017;14:33 · Jäger R et al. ISSN protein, JISSN 2017;14:20 · Kerksick CM et al. ISSN review update, JISSN 2018;15:38 · Sawka MN et al. ACSM fluid replacement, MSSE 2007;39:377 · Hew-Butler T et al. Clin J Sport Med 2015;25:303 · Mountjoy M et al. BJSM 2018;52:687 · Mountjoy M et al. BJSM 2023;57:1073 · Jeukendrup AE. Sports Med 2017;47(S1):101 · Podlogar T, Wallis GA. Sports Med 2022;52(S1):5 · Keytel LR et al. J Sports Sci 2005;23:289 · Ainsworth BE et al. MSSE 2011;43:1575 · Loucks AB et al. J Sports Sci 2011;29(S1):S7 · Guest NS et al. ISSN caffeine, JISSN 2021;18:1 · Maughan RJ et al. BJSM 2018;52:439 · Jentjens RLPG et al. J Appl Physiol 2004;96:1277 · Jeukendrup AE. Curr Opin Clin Nutr Metab Care 2010;13:452 · Costa RJS et al. Appl Physiol Nutr Metab 2017;42:547 · Cox GR et al. J Appl Physiol 2010;109:126 · Pfeiffer B et al. MSSE 2012;44:344 · Viribay A et al. Nutrients 2020;12:1367 · Bussau VA et al. Eur J Appl Physiol 2002;87:290 · Shirreffs SM, Maughan RJ. MSSE 1998;30:1598 · Baker LB. Sports Med 2017;47(S1):111 · Goulet EDB. BJSM 2011;45:1149 · Garthe I et al. IJSNEM 2011;21:97 · Hector AJ, Phillips SM. IJSNEM 2018;28:170 · Mettler S et al. MSSE 2010;42:326 · ten Haaf T, Weijs PJM. PLoS One 2014;9:e108460 · Hall KD et al. Lancet 2011;378:826 · Res PT et al. MSSE 2012;44:1560 · Romijn JA et al. Am J Physiol 1993;265:E380 · Stellingwerff T. IJSNEM 2012;22:392 · Gonçalves LS et al. J Appl Physiol 2017;123:213 · Coyle EF et al. MSSE 1992;24:782.
