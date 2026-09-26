// Analysis math. Everything here is computed from the same data the rest of the app uses
// (plan + activities + body metrics). Formulas are documented inline so the page can show them.
import bodySeed from "./data/seed/body.json";
import { ACTIVITIES, WEEKS, PHASES, activityLoad, activitiesOn, actualByDiscipline, plannedByDiscipline, currentWeek, rollingCompliance, type Activity, type Session, type Sport } from "./data";
import { ATHLETE } from "./config";
import { addDays, fromYmd, today, ymd } from "./format";

// ---------- body metrics (Garmin) ----------
export interface BodyDay { date: string; rhr?: number; hrv?: number; sleep_h?: number; sleep_score?: number; stress?: number; vo2?: number }
export const BODY: BodyDay[] = (bodySeed as BodyDay[]).slice().sort((a, b) => a.date.localeCompare(b.date));

function avg(xs: (number | undefined)[]) { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
export function bodyWindow(days: number, endOffset = 0) {
  const end = addDays(today(), -endOffset), start = addDays(end, -days);
  return BODY.filter((b) => { const d = fromYmd(b.date); return d > start && d <= end; });
}
export function bodySummary(days = 7, endOffset = 0) {
  const w = bodyWindow(days, endOffset);
  const vo2 = [...BODY].reverse().find((b) => b.vo2 != null && fromYmd(b.date) <= addDays(today(), -endOffset))?.vo2 ?? null;
  return { rhr: avg(w.map((b) => b.rhr)), hrv: avg(w.map((b) => b.hrv)), sleep: avg(w.map((b) => b.sleep_h)), sleepScore: avg(w.map((b) => b.sleep_score)), stress: avg(w.map((b) => b.stress)), vo2, n: w.length };
}

// ---------- load model (earned from work done) ----------
// Fitness = 42-day exponentially weighted daily load; Fatigue = 7-day; Form = Fitness − Fatigue.
export interface LoadPoint { date: string; load: number; fitness: number; fatigue: number; form: number }
export const LOAD_SERIES: LoadPoint[] = (() => {
  const out: LoadPoint[] = [];
  let fit = 0, fat = 0;
  const start = fromYmd(ATHLETE.planStart), t = today();
  for (let d = start; d <= t; d = addDays(d, 1)) {
    const date = ymd(d);
    const load = activitiesOn(date).reduce((s, a) => s + activityLoad(a), 0);
    fit += (load - fit) / 42;
    fat += (load - fat) / 7;
    out.push({ date, load, fitness: fit, fatigue: fat, form: fit - fat });
  }
  return out;
})();
export function loadNow() {
  const last = LOAD_SERIES[LOAD_SERIES.length - 1];
  const wk = currentWeek();
  const weekLoad = (w: number) => { const s = fromYmd(WEEKS[w - 1].start); let t = 0; for (let i = 0; i < 7; i++) t += activitiesOn(ymd(addDays(s, i))).reduce((x, a) => x + activityLoad(a), 0); return t; };
  const thisW = weekLoad(wk.week), lastW = wk.week > 1 ? weekLoad(wk.week - 1) : 0;
  const ramp = lastW ? (thisW - lastW) / lastW : 0;
  return { ...last, thisWeek: thisW, lastWeek: lastW, ramp, rampFlag: ramp > 0.10 && fromYmd(wk.start) <= addDays(today(), -6) };
}
export function loadWeekly() {
  // one point per plan week (last day of week or today)
  return WEEKS.filter((w) => fromYmd(w.start) <= today()).map((w) => {
    const end = addDays(fromYmd(w.start), 6);
    const pt = [...LOAD_SERIES].reverse().find((p) => fromYmd(p.date) <= end) ?? LOAD_SERIES[0];
    return { week: w.week, ...pt };
  });
}

// ---------- compliance ----------
export function complianceFor(sessions: Session[]) {
  const t = today();
  const s = sessions.filter((x) => x.sport !== "rest" && fromYmd(x.date) <= t);
  const done = s.filter((x) => x.status === "done").length;
  return { done, total: s.length, pct: s.length ? Math.round((done / s.length) * 100) : null };
}
export function complianceByPhase() {
  return PHASES.filter((p) => fromYmd(p.weeks[0].start) <= today()).map((p) => ({ phase: p.short, ...complianceFor(p.weeks.flatMap((w) => w.sessions)) }));
}

// ---------- pace corridors (plan start → race day) ----------
// Coach-set. Lower = faster for run/swim (seconds); bike is mph (higher = faster).
const CORRIDOR: Record<"run" | "swim" | "bike", { start: [number, number]; race: [number, number] }> = {
  run: { start: [615, 675], race: [570, 630] }, // 10:15–11:15 → 9:30–10:30 /mi
  swim: { start: [100, 110], race: [88, 98] }, // 1:40–1:50 → 1:28–1:38 /100 yd
  bike: { start: [16.5, 18], race: [18.5, 20] }, // mph
};
export function corridorAt(sp: "run" | "swim" | "bike", date: Date) {
  const s = fromYmd(ATHLETE.planStart), r = fromYmd(ATHLETE.race.date);
  const f = Math.min(1, Math.max(0, (date.getTime() - s.getTime()) / (r.getTime() - s.getTime())));
  const c = CORRIDOR[sp];
  return { lo: c.start[0] + (c.race[0] - c.start[0]) * f, hi: c.start[1] + (c.race[1] - c.start[1]) * f };
}
export function paceOf(a: Activity, sp: "run" | "swim" | "bike"): number | null {
  if (sp === "run") return a.pace_s ?? null;
  if (sp === "swim") return a.p100_s ?? null;
  return a.mph ?? null;
}
export function paceSeries(sp: "run" | "swim" | "bike", days = 84) {
  const since = addDays(today(), -days);
  return ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) >= since && paceOf(a, sp) != null).map((a) => ({ id: a.id, date: a.date, v: paceOf(a, sp) as number, min: a.min, hr: a.hr }));
}
export function weightedAvgPace(sp: "run" | "swim" | "bike", days = 28, endOffset = 0) {
  const end = addDays(today(), -endOffset), since = addDays(end, -days);
  const pts = ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) > since && fromYmd(a.date) <= end && paceOf(a, sp) != null);
  const w = pts.reduce((s, a) => s + a.min, 0);
  return w ? pts.reduce((s, a) => s + (paceOf(a, sp) as number) * a.min, 0) / w : null;
}

// ---------- scores ----------
// Each component: 70 at the plan-start baseline, 100 at the target; no floor or ceiling beyond 40–120.
function component(current: number | null, baseline: number, target: number) {
  if (current == null) return null;
  const v = 70 + 30 * ((current - baseline) / (target - baseline));
  return Math.max(40, Math.min(120, v));
}
export function healthScore(endOffset = 0) {
  const b = bodySummary(7, endOffset);
  const parts = { vo2: component(b.vo2, 52, 60), rhr: component(b.rhr, 46, 38), hrv: component(b.hrv, 77, 96) };
  const w = { vo2: 0.5, rhr: 0.25, hrv: 0.25 };
  let tot = 0, ws = 0;
  (Object.keys(parts) as (keyof typeof parts)[]).forEach((k) => { if (parts[k] != null) { tot += (parts[k] as number) * w[k]; ws += w[k]; } });
  return { score: ws ? Math.round(tot / ws) : null, parts, inputs: b };
}
export function raceScore(endOffset = 0) {
  const mid = (c: { start: [number, number]; race: [number, number] }, k: 0 | 1) => (c[k === 0 ? "start" : "race"][0] + c[k === 0 ? "start" : "race"][1]) / 2;
  const run = weightedAvgPace("run", 28, endOffset), bike = weightedAvgPace("bike", 28, endOffset), swim = weightedAvgPace("swim", 28, endOffset);
  const comp = rollingCompliance(28);
  const parts = {
    run: component(run, mid(CORRIDOR.run, 0), mid(CORRIDOR.run, 1)),
    bike: component(bike, mid(CORRIDOR.bike, 0), mid(CORRIDOR.bike, 1)),
    swim: component(swim, mid(CORRIDOR.swim, 0), mid(CORRIDOR.swim, 1)),
    durability: component(comp.planned ? comp.done / comp.planned : null, 0.6, 1.0),
  };
  const w = { run: 0.4, bike: 0.35, swim: 0.15, durability: 0.1 };
  let tot = 0, ws = 0;
  (Object.keys(parts) as (keyof typeof parts)[]).forEach((k) => { if (parts[k] != null) { tot += (parts[k] as number) * w[k]; ws += w[k]; } });
  return { score: ws ? Math.round(tot / ws) : null, parts, inputs: { run, bike, swim, compliance: comp } };
}

// ---------- volume ----------
export function volumeWeekly(n = 12) {
  const cur = currentWeek();
  const from = Math.max(1, cur.week - n + 1);
  return WEEKS.slice(from - 1, cur.week).map((w) => ({ week: w.week, start: w.start, actual: actualByDiscipline(w), planned: plannedByDiscipline(w), plannedH: w.plannedMin / 60 }));
}

// ---------- totals & bests ----------
export function totals() {
  const since = fromYmd(ATHLETE.planStart);
  const acts = ACTIVITIES.filter((a) => fromYmd(a.date) >= since);
  const t = { sessions: acts.length, hours: acts.reduce((s, a) => s + a.min, 0) / 60, swimYd: 0, bikeMi: 0, runMi: 0, elevFt: 0, swim: 0, bike: 0, run: 0, other: 0 };
  for (const a of acts) {
    if (a.sport === "swim") { t.swimYd += a.yd ?? 0; t.swim++; }
    else if (a.sport === "bike") { t.bikeMi += a.mi ?? 0; t.bike++; }
    else if (a.sport === "run") { t.runMi += a.mi ?? 0; t.run++; }
    else t.other++;
    t.elevFt += a.elev_ft ?? 0;
  }
  const best = (xs: Activity[], f: (a: Activity) => number | undefined, hi = true) => xs.reduce<Activity | null>((m, a) => { const v = f(a); if (v == null) return m; const mv = m ? f(m) : null; return mv == null || (hi ? v > mv : v < mv) ? a : m; }, null);
  const bests = {
    longestRide: best(acts.filter((a) => a.sport === "bike"), (a) => a.mi),
    longestRun: best(acts.filter((a) => a.sport === "run"), (a) => a.mi),
    longestSwim: best(acts.filter((a) => a.sport === "swim"), (a) => a.yd),
    fastestRun: best(acts.filter((a) => a.sport === "run" && (a.mi ?? 0) >= 3), (a) => a.pace_s, false),
    longestSession: best(acts, (a) => a.min),
  };
  return { ...t, bests };
}

// ---------- race projection (v1: current 4-week average pace, no fatigue adjustment) ----------
export function raceProjection() {
  const run = weightedAvgPace("run"), bike = weightedAvgPace("bike"), swim = weightedAvgPace("swim");
  const swimH = swim != null ? (4224 / 100) * swim / 3600 : null; // 2.4 mi = 4224 yd
  const bikeH = bike != null ? 112 / bike : null;
  const runH = run != null ? (26.2 * run) / 3600 : null;
  const tr = ATHLETE.raceSplits.transitions;
  const total = swimH != null && bikeH != null && runH != null ? swimH + bikeH + runH + tr : null;
  return { swimH, bikeH, runH, transitions: tr, total, goal: ATHLETE.raceSplits };
}

// ---------- single-activity analysis ----------
export function parseRange(s: string | undefined): [number, number] | null {
  if (!s) return null;
  const parts = s.replace(/mph/g, "").split(/[–-]/).map((x) => x.trim());
  if (parts.length !== 2) return null;
  const toN = (x: string) => (x.includes(":") ? x.split(":").reduce((a, b) => a * 60 + Number(b), 0) : Number(x));
  const a = toN(parts[0]), b = toN(parts[1]);
  return isNaN(a) || isNaN(b) ? null : [a, b];
}
export function analyzeActivity(a: Activity) {
  const week = WEEKS.find((w) => w.sessions.some((s) => s.date === a.date));
  const planned = week?.sessions.find((s) => s.date === a.date && (s.sport === a.sport || (s.sport === "brick" && (a.sport === "bike" || a.sport === "run")))) ?? week?.sessions.find((s) => s.date === a.date) ?? null;
  const sp = a.sport === "swim" || a.sport === "bike" || a.sport === "run" ? a.sport : null;
  const zone = planned && sp ? ATHLETE.zones[sp]?.[planned.intensity] : undefined;
  const range = parseRange(zone);
  const pace = sp ? paceOf(a, sp) : null;
  let verdict: "in range" | "faster than target" | "slower than target" | null = null;
  if (range && pace != null) {
    const [lo, hi] = range;
    if (sp === "bike") verdict = pace < lo ? "slower than target" : pace > hi ? "faster than target" : "in range";
    else verdict = pace > hi ? "slower than target" : pace < lo ? "faster than target" : "in range";
  }
  const load = activityLoad(a);
  const durDelta = planned ? a.min - planned.min : null;
  const ef = pace != null && a.hr ? (sp === "bike" ? pace / a.hr : (1 / pace) * 3600 / a.hr) : null; // speed per bpm
  const sameType = sp ? ACTIVITIES.filter((x) => x.sport === sp && x.id !== a.id && x.hr && paceOf(x, sp) != null && fromYmd(x.date) >= addDays(fromYmd(a.date), -28) && fromYmd(x.date) <= fromYmd(a.date)) : [];
  const efAvg = sameType.length ? sameType.reduce((s, x) => { const p = paceOf(x, sp as "run") as number; return s + (sp === "bike" ? p / (x.hr as number) : ((1 / p) * 3600) / (x.hr as number)); }, 0) / sameType.length : null;
  return { planned, zone, range, pace, verdict, load, durDelta, fitnessEffect: load / 42, fatigueEffect: load / 7, ef, efAvg, efN: sameType.length, sport: sp as Sport | null };
}
