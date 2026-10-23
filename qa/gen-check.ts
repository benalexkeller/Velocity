// Generator checks: V-010 swims with few days, V-012 race day, V-014 steps, V-072 hard days, hour cap.
import { generatePlan } from "../src/lib/plan/generate";
import { EMPTY_INTAKE } from "../src/lib/plan/intake";
import { buildWeeks } from "../src/lib/data";
import { workoutFor, hardestStep } from "../src/lib/workout";
const T = new Date(2026, 9, 7);
const mk = (o: any) => ({ ...EMPTY_INTAKE, ...o, goal: { ...EMPTY_INTAKE.goal, ...o.goal }, time: { ...EMPTY_INTAKE.time, ...o.time }, history: { ...EMPTY_INTAKE.history, ...o.history } });
const out: string[] = []; const ok = (n: string, c: boolean, d = "") => out.push(`${c ? "PASS" : "FAIL"} ${n}${d ? " · " + d : ""}`);
const H = (sw: number, bk: number, rn: number) => ({ swim: sw, bike: bk, run: rn, strength: 0 });
// V-010
for (const [label, days, type, date] of [["140.6 Tue/Thu/Sat", [2, 4, 6], "140.6", "2027-05-01"], ["sprint 4 days", [1, 3, 5, 6], "sprint", "2027-01-09"]] as const) {
  const { weeks } = generatePlan(mk({ goal: { type, date, kind: "finish" }, time: { days, max_hours: 10, long_weekend: true }, history: { hours: H(1, 3, 2), sessions_per_week: 3 } }), T, true);
  const W = buildWeeks(weeks);
  const swimsPerWeek = W.slice(1).filter((w) => !w.race).map((w) => w.sessions.filter((s) => /swim/i.test(s.text)).length);
  ok(`V-010 ${label}: ≥ 2 swims every full week`, swimsPerWeek.every((n) => n >= 2), swimsPerWeek.join(","));
  const dbl = W.flatMap((w) => w.sessions).find((s) => /^AM: Swim/.test(s.text) || /PM:/.test(s.text));
  if (dbl) { const wk = workoutFor(dbl); ok(`V-010 ${label}: double day parses into both parts`, wk.segments.some((x) => x.part === "AM") && wk.segments.some((x) => x.part === "PM"), dbl.text.slice(0, 90)); }
}
// V-012 race day
for (const [type, date] of [["140.6", "2027-05-01"], ["marathon", "2027-01-10"]] as const) {
  const { weeks } = generatePlan(mk({ goal: { type, date, kind: "finish", event: "Test race" }, time: { days: [1, 2, 3, 4, 6, 0], max_hours: 10, long_weekend: true }, history: { hours: H(1, 3, 3), sessions_per_week: 5 } }), T, true);
  const W = buildWeeks(weeks);
  const rd = W.flatMap((w) => w.sessions).find((s) => /^Race day/.test(s.text))!;
  const wk = workoutFor(rd);
  ok(`V-012 ${type}: race day has a sport and race-effort legs`, rd.sport !== "other" && wk.segments.every((x) => x.zone === 3 || x.kind === "recovery") && !wk.steps.some((x) => /^Easy/.test(x)), `${rd.sport} · ${rd.text.slice(0, 80)} · ${wk.steps.join(" | ").slice(0, 120)}`);
}
// V-014 steps
const fake = (text: string, sport: any, min: number) => ({ id: "x", date: "2027-01-01", dayIndex: 0, min, sport, title: "", detail: "", text, intensity: "", why: "", status: "planned" } as any);
const cases: [string, any, number, (w: ReturnType<typeof workoutFor>) => boolean][] = [
  ["Bike 1:00 tempo — 3x10min at threshold", "bike", 60, (w) => w.segments.some((x) => x.kind === "interval" && x.zone === 4)],
  ["Run 0:50 intervals — 5x3min hard, 3min easy", "run", 50, (w) => w.segments.some((x) => x.kind === "interval" && x.zone === 4) && w.segments.some((x) => x.kind === "recovery" && x.min === 3)],
  ["Long run 2:00 EZ with the last 20 min at race pace", "run", 120, (w) => w.segments.some((x) => x.zone === 3 && x.min === 20)],
  ["Long run 2:30 — middle 1:00 at race pace", "run", 150, (w) => w.segments.some((x) => x.zone === 3 && x.min === 60)],
  ["Race sim: Long ride 4:30 at race effort + Run 0:45 off the bike", "brick", 315, (w) => w.segments.some((x) => x.label === "Run off the bike" && x.min === 45 && x.zone === 3) && w.segments.some((x) => x.label === "Race effort")],
  ["Brick: Long ride 3:00 EZ + Run 0:20 off the bike", "brick", 200, (w) => w.segments.some((x) => x.label === "Run off the bike" && x.min === 20)],
  ["Swim 1:00 — 8x100 at threshold pace, 20s rest", "swim", 60, (w) => w.segments.some((x) => x.kind === "interval" && x.zone === 4)],
  ["Run 1:20 — 20min continuous @ IM run effort", "run", 80, (w) => w.segments.some((x) => x.zone === 3 && x.min === 20)],
  ["Run 0:45 EZ + 6x20s strides", "run", 45, (w) => w.segments.some((x) => x.kind === "interval" && x.zone === 4)],
];
for (const [text, sport, min, test] of cases) { const w = workoutFor(fake(text, sport, min)); ok(`V-014 ${text}`, test(w), w.steps.join(" | ").slice(0, 160)); }
// V-072 hard days: at most 2 hard weekday sessions, never on consecutive days; race sim never the day before a race-pace long run
{
  const { weeks } = generatePlan(mk({ goal: { type: "140.6", date: "2027-05-01", kind: "finish" }, time: { days: [1, 2, 3, 4, 5, 6, 0], max_hours: 14, long_weekend: true }, history: { hours: H(2, 5, 3), sessions_per_week: 7 } }), T, true);
  const W = buildWeeks(weeks);
  const hard = (t: string) => /threshold|hard|tempo|race (pace|effort)|race sim/i.test(t) && !/^Race day/.test(t);
  let worstWeekday = 0, consecutive = 0, simBeforeRP = 0;
  for (const w of W) {
    const hd = w.sessions.map((s) => hard(s.text));
    worstWeekday = Math.max(worstWeekday, hd.slice(0, 5).filter(Boolean).length);
    for (let d = 0; d < 6; d++) if (hd[d] && hd[d + 1]) consecutive++;
    if (/race sim/i.test(w.sessions[5].text) && /race pace/.test(w.sessions[6].text)) simBeforeRP++;
  }
  ok("V-072 at most 2 hard weekday sessions", worstWeekday <= 2, String(worstWeekday));
  ok("V-072 race sim never followed by a race-pace long run", simBeforeRP === 0, String(simBeforeRP));
  out.push(`INFO consecutive hard days (incl. weekend) across the plan: ${consecutive}`);
}
// cap: never above the maximum; a 2 h/week marathoner is not pushed far above the ramp
for (const [label, o, maxH] of [["gran fondo 5 d max 10", { goal: { type: "gran_fondo", date: "2027-02-20", kind: "finish" }, time: { days: [1, 2, 3, 5, 6], max_hours: 10, long_weekend: true }, history: { hours: H(0, 5, 0), sessions_per_week: 4 } }, 10], ["marathon 2 h → 9 h", { goal: { type: "marathon", date: "2027-01-10", kind: "finish" }, time: { days: [1, 3, 5, 6], max_hours: 9, long_weekend: true }, history: { hours: H(0, 0, 2), sessions_per_week: 2 } }, 9]] as const) {
  const { weeks, summary } = generatePlan(mk(o), T, true);
  ok(`cap ${label}: no week above the maximum`, summary.hours.every((h) => h <= maxH + 0.01), summary.hours.map((h) => h.toFixed(1)).join(" "));
  ok(`cap ${label}: week 2 ≤ start + 1 h`, summary.hours[1] <= summary.startHours + 1.01, `start ${summary.startHours} · wk2 ${summary.hours[1]}`);
  void weeks;
}
console.log(out.join("\n"));

{
  const o: string[] = [];
  const k1 = hardestStep(fake("Run 0:45 EZ + 6x20s strides", "run", 45))!;
  const k2 = hardestStep(fake("Bike 1:30 — 3x10min at threshold, 3min easy", "bike", 90))!;
  const k3 = hardestStep(fake("Long run 2:00 EZ with the last 20 min at race pace", "run", 120))!;
  o.push(`${k1.zone === 2 ? "PASS" : "FAIL"} key zone: easy run with strides stays Z2 · Z${k1.zone}`);
  o.push(`${k2.zone === 4 ? "PASS" : "FAIL"} key zone: threshold set is Z4 · Z${k2.zone}`);
  o.push(`${k3.zone === 3 ? "PASS" : "FAIL"} key zone: race-pace finish is Z3 · Z${k3.zone}`);
  console.log(o.join("\n"));
}
