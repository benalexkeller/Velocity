// Plan-hours honesty check: shown hours = scheduled hours; weekly ramp of scheduled loading weeks ≤ +10 % (+ rounding).
import { generatePlan } from "../src/lib/plan/generate";
import { EMPTY_INTAKE } from "../src/lib/plan/intake";
const T = new Date(2026, 9, 7);
const mk = (o: any) => ({ ...EMPTY_INTAKE, ...o });
const S: [string, any][] = [
  ["140.6 30wk 9h→14h 7d", mk({ goal: { ...EMPTY_INTAKE.goal, type: "140.6", date: "2027-05-01", kind: "finish" }, history: { raced: true, races: [], sessions_per_week: 6, hours: { swim: 1.5, bike: 4.5, run: 3, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, bike_longest: 40, run_longest: 8, swim_longest: 2000 }, time: { ...EMPTY_INTAKE.time, max_hours: 14, days: [1,2,3,4,5,6,0], long_weekend: true } })],
  ["marathon 14wk 2h→9h", mk({ goal: { ...EMPTY_INTAKE.goal, type: "marathon", date: "2027-01-10", kind: "finish" }, history: { raced: false, races: [], sessions_per_week: 2, hours: { swim: 0, bike: 0, run: 2, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, run_longest: 5 }, time: { ...EMPTY_INTAKE.time, max_hours: 9, days: [1,2,3,4,6,0], long_weekend: true } })],
  ["gran fondo 20wk 5h→10h 5d", mk({ goal: { ...EMPTY_INTAKE.goal, type: "gran_fondo", date: "2027-02-20", kind: "finish" }, history: { raced: false, races: [], sessions_per_week: 4, hours: { swim: 0, bike: 5, run: 0, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, bike_longest: 50 }, time: { ...EMPTY_INTAKE.time, max_hours: 10, days: [2,4,6,0,3], long_weekend: true } })],
];
for (const [label, intake] of S) {
  const { weeks, summary } = generatePlan(intake, T, true);
  const sched = weeks.map((w) => w.days.reduce((a, d) => a + (/^Race day/.test(d.text) ? 0 : d.min), 0) / 60);
  const shown = summary.hours;
  const mismatch = sched.some((h, i) => Math.abs(h - shown[i]) > 0.02);
  const focusH = weeks.map((w) => +(w.focus.match(/ (\d+\.\d) h/)?.[1] ?? NaN));
  const focusMis = weeks.some((w, i) => !w.race && Math.abs(focusH[i] - sched[i]) > 0.06);
  let worst = 0, worstAt = 0, prevLoad = 0;
  weeks.forEach((w, i) => { if (i === 0 || w.recovery || w.race || /Taper/.test(w.phase)) { if (!w.recovery && !w.race) prevLoad = sched[i]; return; } if (prevLoad) { const r = sched[i] / prevLoad - 1; if (r > worst) { worst = r; worstAt = i + 1; } } prevLoad = sched[i]; });
  console.log(`${label.padEnd(28)} weeks ${summary.weeks} · start ${summary.startHours}h · peak shown ${summary.peakHours.toFixed(1)} (target ${summary.targetPeak.toFixed(1)}) · shown=scheduled ${!mismatch} · header=scheduled ${!focusMis} · worst loading step +${(worst*100).toFixed(0)}% at W${worstAt} · longest ride ${summary.longest.ride.toFixed(2)} h`);
  console.log("   ", sched.map((h) => h.toFixed(1)).join(" "));
}
