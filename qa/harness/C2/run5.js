require('./bundle.cjs'); const V = globalThis.V;
const an = V.createAnalysis(V.ACTIVITIES, V.WEEKS, { phases: V.PHASES, body: V.BODY_SEED, athlete: V.DEFAULT_ATHLETE });
const f = (x, d = 2) => (x == null ? '—' : Number(x).toFixed(d));

console.log('=== 1. EWMA cold start ===');
const LS = an.LOAD_SERIES; const n = LS.length; const meanLoad = LS.reduce((s, p) => s + p.load, 0) / n;
console.log('days', n, 'mean daily load', f(meanLoad), 'fitness shown', f(LS[n - 1].fitness));
console.log('fraction of steady state reached after n days: CTL', f(1 - Math.pow(1 - 1 / 42, n), 3), 'ATL', f(1 - Math.pow(1 - 1 / 7, n), 3));
// seeded variant: start fit/fat at the mean of the first 14 days
let fit = meanLoad, fat = meanLoad; for (const p of LS) { fit += (p.load - fit) / 42; fat += (p.load - fat) / 7; }
console.log('if seeded at mean load: fitness', f(fit), 'fatigue', f(fat), 'form', f(fit - fat));
console.log('TSS-equivalent (load*100/60): fitness', f(LS[n - 1].fitness * 100 / 60), 'TP-style CTL');
console.log('load cap: HR 170 ->', Math.round(60 * Math.min(1.2, (170 / 155) ** 2)), 'HR 185 ->', Math.round(60 * Math.min(1.2, (185 / 155) ** 2)), 'uncapped 185 ->', Math.round(60 * (185 / 155) ** 2));
console.log('swim 55 Aerobic plannedLoad', V.plannedLoad({ sport: 'swim', min: 55, intensity: 'Aerobic' }), 'bike 70 Tempo', V.plannedLoad({ sport: 'bike', min: 70, intensity: 'Tempo' }), 'swim 40min actual HR161 ->', V.activityLoad({ min: 40, hr: 161 }), 'ride 91min HR135 ->', V.activityLoad({ min: 91, hr: 135 }));

console.log('\n=== 2. zone distribution: by load vs by time ===');
const withHr = V.ACTIVITIES.filter((a) => a.hr);
const byT = [0, 0, 0, 0, 0, 0], byL = [0, 0, 0, 0, 0, 0]; let T = 0, L = 0;
for (const a of withHr) { const z = V.zoneOf(a); byT[z] += a.min; byL[z] += V.activityLoad(a); T += a.min; L += V.activityLoad(a); }
console.log('minutes by zone', byT.slice(1).map((m) => `${m} (${f(100 * m / T, 0)}%)`).join(' | '), 'total min', T);
console.log('load by zone   ', byL.slice(1).map((m) => `${m} (${f(100 * m / L, 0)}%)`).join(' | '), 'total load', L);
console.log('easy by time', f(100 * (byT[1] + byT[2]) / T, 0), '% · easy by load', f(100 * (byL[1] + byL[2]) / L, 0), '%');
console.log('Friel zones from LTHR 155: Z1 <', Math.round(155 * 0.85), 'Z2', Math.round(155 * 0.85), '-', Math.round(155 * 0.89), 'Z3', Math.round(155 * 0.90), '-', Math.round(155 * 0.94), 'Z4', Math.round(155 * 0.95), '-', Math.round(155 * 0.99), 'Z5 >=155');
console.log('code zoneOf thresholds: Z1<135 Z2 135-147 Z3 148-157 Z4 158-167 Z5>=168 -> implied LTHR ~', Math.round((158 + 168) / 2 / 1.0), '(Z4 midpoint) ; 148 bpm =', f(148 / 155 * 100, 0), '% of 155');
console.log('unknown-zone load excluded from % :', an.zoneDistribution(84).total, 'total vs known', L);

console.log('\n=== 3. race projection vs Riegel ===');
const p = an.raceProjection();
const hms = (h) => { const s = Math.round(h * 3600); return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
console.log('projection', hms(p.swimH), hms(p.bikeH), hms(p.runH), '+', hms(p.transitions), '=', hms(p.total));
const lr = { mi: 6.35, min: 60 };
const riegel = (d1, t1, d2, k = 1.06) => t1 * Math.pow(d2 / d1, k);
console.log('Riegel from longest run 6.35 mi/60 min -> marathon', hms(riegel(6.35, 60, 26.2) / 60), '(open marathon); IM run +10-20% ->', hms(riegel(6.35, 60, 26.2) * 1.1 / 60), '-', hms(riegel(6.35, 60, 26.2) * 1.2 / 60));
console.log('run leg in code uses 4-wk avg pace 9:29/mi from runs of 27-61 min; longest ride 18.1 mi 67 min -> 112 mi at same speed', hms(p.bikeH));
console.log('bike at 15 mph', hms(112 / 15), 'at 16', hms(112 / 16));
console.log('goal splits sum', hms(1.5 + 6.4 + 4.75 + 0.35), 'gapMin', f(an.raceReadiness().gapMin, 1));
console.log('range lo/hi factors 0.97/1.04 -> total', hms(p.total * 0.97), '-', hms(p.total * 1.04));

console.log('\n=== 4. race score sensitivity ===');
const rs = an.raceScore();
console.log('parts', JSON.stringify(rs.parts), 'score', rs.score);
const w = { run: 0.4, bike: 0.35, swim: 0.15, durability: 0.1 };
const clamp100 = Object.entries(rs.parts).reduce((s, [k, v]) => s + Math.min(100, v) * w[k], 0);
console.log('score if components capped at 100:', Math.round(clamp100));
// corridor race mids vs goal paces
const goalRun = 4.75 * 3600 / 26.2, goalBike = 112 / 6.4, goalSwim = 1.5 * 3600 / 42.24;
console.log('goal paces for sub-13 splits: run', f(goalRun, 0), 's/mi =', `${Math.floor(goalRun / 60)}:${String(Math.round(goalRun % 60)).padStart(2, '0')}`, '| bike', f(goalBike, 2), 'mph | swim', f(goalSwim, 0), 's/100yd');
console.log('CORRIDOR race mids used as 100-point targets: run 600 (10:00) bike 19.25 swim 93 (1:33)');
console.log('finish time at corridor race mids:', hms(42.24 * 93 / 3600 + 112 / 19.25 + 26.2 * 600 / 3600 + 0.35));
const comp = (cur, b, t) => Math.max(40, Math.min(120, 70 + 30 * ((cur - b) / (t - b))));
console.log('run component with goal-based target (baseline 645 -> target 652?) n/a; with baseline 645, target', f(goalRun, 0), '->', f(comp(569.25, 645, goalRun), 1), '(target slower than baseline: formula inverts)');
console.log('run component if 100 = plan Z2 mid (645) and baseline = 700:', f(comp(569.25, 700, 645), 1));
// what happens if the athlete runs the prescribed easy pace (10:45 = 645 s)
console.log('run component if he runs exactly the prescribed Z2 pace 10:45:', f(comp(645, 645, 600), 1), '-> score', Math.round(70 * 0.4 + rs.parts.bike * 0.35 + rs.parts.swim * 0.15 + rs.parts.durability * 0.1));
console.log('run component if he runs 8:24 (504 s) every run:', f(comp(504, 645, 600), 1));

console.log('\n=== 5. health score missing-data behaviour ===');
const B = an.BODY; console.log('body rows', B.length, 'first', B[0].date, 'last', B[B.length - 1].date);
console.log('last 7 days window (30 Sep-7 Oct) rows:', B.filter((b) => b.date > '2026-09-30').length);
for (const o of [0, 3, 7, 14]) { const h = an.healthScore(o); console.log('offset', o, 'score', h.score, 'n', h.inputs.n, 'parts', JSON.stringify(Object.fromEntries(Object.entries(h.parts).map(([k, v]) => [k, v == null ? null : +v.toFixed(1)])))); }
console.log('vo2 component 52.8 ->', f(comp(52.8, 52, 60), 1), '; 100 needs vo2 60 (+8 in 33 wk). RHR 100 needs 38 (from 46). HRV 100 needs 96 (from 77).');
console.log('weights if only vo2: vo2 100% ; if vo2+rhr: vo2 67% rhr 33%');

console.log('\n=== 6. ramp flag behaviour ===');
const ln = an.loadNow(); console.log(JSON.stringify(ln));
console.log('next week if he trains 300 load vs 59 last:', f((300 - 59) / 59 * 100, 0), '% -> flag. Week 3->4 would have been', f((59 - 250) / 250 * 100, 0));
const wl = V.WEEKS.slice(0, 5).map((w) => V.weekLoad(w, V.ACTIVITIES)); console.log('weekLoad planned/actual W1-5', JSON.stringify(wl));

console.log('\n=== 7. dashboard vs analysis 4-week windows ===');
const since = new Date(2026, 9, 7); since.setDate(since.getDate() - 28);
const dash = (sp, key) => { const pts = V.ACTIVITIES.filter((a) => a.sport === sp && a.date >= '2026-09-09' && a[key] != null); return pts.reduce((s, a) => s + a[key] * a.min, 0) / pts.reduce((s, a) => s + a.min, 0); };
console.log('swim 4-wk avg: dashboard (>= 9 Sep)', f(dash('swim', 'p100_s'), 2), 'analysis (> 9 Sep)', f(an.weightedAvgPace('swim'), 2));
console.log('dashboard "Best · 4 weeks" run = min pace in window:', Math.min(...V.ACTIVITIES.filter((a) => a.sport === 'run' && a.date >= '2026-09-09').map((a) => a.pace_s)), 's/mi = 8:24 (3.69 mi, HR 170, the session the coach note flags)');

console.log('\n=== 8. compliance vs consistency ===');
console.log('kpi consistency (12-wk complianceFor):', an.kpis().consistency.v, '| rollingCompliance(28):', JSON.stringify(an.rollingCompliance(28)), '| byPhase', JSON.stringify(an.complianceByPhase()));
console.log('rollingCompliance pct when planned=0 ->', V.rollingCompliance(28, []).pct, '| complianceFor([]) pct ->', an.complianceFor([]).pct);
console.log('today (7 Oct) swim counted as planned-not-done in both:', an.rollingCompliance(28).planned, 'includes 2026-10-07?', V.WEEKS[4].sessions.find((s) => s.date === '2026-10-07').status);

console.log('\n=== 9. nutrition checks ===');
const pr = { weight_kg: 74.8, height_cm: 177.8, birth_year: 1994, sex: 'male', goal: 'race_weight', goal_weight_kg: 71.5, base_kcal: null, weight_stages: [{ date: '2026-12-09', weight_kg: 73.5, label: 'W14' }, { date: '2027-03-10', weight_kg: 72.3, label: 'W27' }], bottle_ml: 750, supplements: [], setup_done: true };
const mk = (sport, min, intensity) => ({ id: 'x', date: '2026-10-07', dayIndex: 2, min, sport, title: sport, detail: '', text: '', intensity, why: '', status: 'planned' });
for (const [l, ss] of [['race 6h', [mk('bike', 360, 'Race')]], ['long 4h', [mk('bike', 240, 'Endurance')]], ['IM race 13h', [mk('bike', 780, 'Race')]]]) { const t = V.targetsFor(pr, ss, '2027-04-24'); console.log(l.padEnd(12), 'kcal', t.kcal, 'carbs', t.carbs, `(${f(t.carbs / 74.8, 1)} g/kg)`, 'protein', t.protein, 'fat', t.fat, `(${f(t.fat / 74.8, 1)} g/kg, ${f(100 * t.fat * 9 / t.kcal, 0)}% kcal)`, 'sodium', t.sodium, 'fluid', t.fluid_ml); }
console.log('sodium rounding: 20 min ->', V.targetsFor(pr, [mk('run', 20, 'Zone 2')]).sodium, '| 31 min ->', V.targetsFor(pr, [mk('run', 31, 'Zone 2')]).sodium, '| 89 min ->', V.targetsFor(pr, [mk('run', 89, 'Zone 2')]).sodium, '| 91 min ->', V.targetsFor(pr, [mk('run', 91, 'Zone 2')]).sodium);
console.log('fluid: 20 min ->', V.targetsFor(pr, [mk('run', 20, 'Zone 2')]).fluid_ml, '| 89 ->', V.targetsFor(pr, [mk('run', 89, 'Zone 2')]).fluid_ml);
console.log('fuel step: 150 min easy ride during', V.sessionFuel(mk('bike', 150, 'Zone 2'), 74.8).during, 'g | 151 min', V.sessionFuel(mk('bike', 151, 'Zone 2'), 74.8).during, 'g | 240', V.sessionFuel(mk('bike', 240, 'Zone 2'), 74.8).during, '| 241', V.sessionFuel(mk('bike', 241, 'Zone 2'), 74.8).during);
console.log('fuel 59 vs 60 min easy: during', V.sessionFuel(mk('bike', 59, 'Zone 2'), 74.8).during, '/', V.sessionFuel(mk('bike', 60, 'Zone 2'), 74.8).during, 'after carbs', V.sessionFuel(mk('bike', 59, 'Zone 2'), 74.8).after.carbs, '/', V.sessionFuel(mk('bike', 60, 'Zone 2'), 74.8).after.carbs);
const fe = { weight_kg: 52, height_cm: 160, birth_year: 1996, sex: 'female', goal: 'lose', goal_weight_kg: null, base_kcal: null, weight_stages: [], bottle_ml: 500, supplements: [], setup_done: true };
const tf = V.targetsFor(fe, [mk('run', 60, 'Zone 2')]); const ffm = 52 * 0.75;
console.log('52 kg female lose, 60-min run: kcal', tf.kcal, 'training', tf.training, 'EA =', f((tf.kcal - tf.training) / ffm, 1), 'kcal/kg FFM (LEA <30, optimal 45) ; deficit', tf.goalAdj, '=', f(100 * 400 / tf.base, 0), '% of base', tf.base, '; macro kcal', tf.carbs * 4 + tf.protein * 4 + tf.fat * 9, 'vs kcal', tf.kcal);
const m = { ...fe, sex: 'male', weight_kg: 60 }; const tm = V.targetsFor(m, []); console.log('60 kg male lose rest day: kcal', tm.kcal, 'bmr', tm.bmr, 'kcal/bmr', f(tm.kcal / tm.bmr, 2));
console.log('base_kcal pinned -> goalAdj forced 0 (line 74): race_weight goal silently ignored');
console.log('MET bike easy 7 = Ainsworth 10-11.9 mph (6.8); PR Z2 15-17 mph = Ainsworth 10-12 MET; power-based 16 mph ~140 W ->', f(140 * 3.6 / 4.184 / 0.24 / 74.8, 1), 'MET');
console.log('age from birth_year only:', new Date().getFullYear() - 1994);
console.log('7700 kcal/kg: -300/day -> -0.27 kg/wk; 9-wk stage 1.3 kg -> ', f(1.3 * 7700 / 63, 0), 'kcal/day');

console.log('\n=== 10. zones vs goal consistency (config.ts) ===');
console.log('run Race zone 10:30-11:00 -> marathon', hms(26.2 * 630 / 3600), '-', hms(26.2 * 660 / 3600), 'vs goal run 4:45');
console.log('bike Race 17-18 mph -> 112 mi', hms(112 / 18), '-', hms(112 / 17), 'vs goal 6:24');
console.log('swim Race 2:05-2:15 -> 4224 yd', hms(42.24 * 125 / 3600), '-', hms(42.24 * 135 / 3600), 'vs goal 1:30');
console.log('CORRIDOR race (analysis.ts:19-21): run 9:30-10:30, swim 1:28-1:38, bike 18.5-20 -> finish', hms(42.24 * 88 / 3600 + 112 / 20 + 26.2 * 570 / 3600 + 0.35), '-', hms(42.24 * 98 / 3600 + 112 / 18.5 + 26.2 * 630 / 3600 + 0.35));
console.log('CORRIDOR start swim 1:40-1:50 vs config Aerobic zone 2:00-2:10 (20 s/100 yd apart)');
console.log('targetFor Z1 = Z2 pace x1.08; Z3 = Tempo zone; Z4 = Intervals zone; Z5 = "max effort"; no HR zones anywhere; bike zones in mph not power/HR');
console.log('Z2 run 10:15-11:15 at 9:29 avg actual, HR 157 avg -> actual easy runs are 7-10% faster than Z2 and at 101% of the 155 "threshold"');
