// Analysis math. Everything here is computed from the same data the rest of the app uses
// (plan + activities + body metrics). Formulas are documented inline so the page can show them.
import bodySeed from "./data/seed/body.json";
import { ACTIVITIES, WEEKS, PHASES, activityLoad, activitiesOn, actualByDiscipline, plannedByDiscipline, currentWeek, rollingCompliance, weekStatus, type Activity, type Session, type Sport } from "./data";
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

// =====================================================================
// Analytics page (mock v2) — every panel below is computed from the same data.
// =====================================================================
const dayLoad = (d: Date) => activitiesOn(ymd(d)).reduce((s, a) => s + activityLoad(a), 0);
const pctDelta = (cur: number | null, prev: number | null) => (cur == null || prev == null || !prev ? null : ((cur - prev) / Math.abs(prev)) * 100);
const between = (a: Activity, from: Date, to: Date) => { const d = fromYmd(a.date); return d > from && d <= to; };

/** Top KPI tiles. Deltas compare with the previous period of the same length. */
export function kpis() {
  const t = today();
  const avgLoad = (endOffset: number) => { let s = 0; for (let i = 0; i < 7; i++) s += dayLoad(addDays(t, -endOffset - i)); return s / 7; };
  const load7 = avgLoad(0), load7prev = avgLoad(7);
  const last = LOAD_SERIES[LOAD_SERIES.length - 1], wkAgo = LOAD_SERIES[Math.max(0, LOAD_SERIES.length - 8)];
  const cur = currentWeek(), prev = cur.week > 1 ? WEEKS[cur.week - 2] : null;
  const volNow = weekStatus(cur).actualH, volPrev = prev ? weekStatus(prev).actualH : null;
  const comp12 = complianceFor(WEEKS.slice(Math.max(0, cur.week - 12), cur.week).flatMap((w) => w.sessions));
  const compPrev = cur.week > 12 ? complianceFor(WEEKS.slice(Math.max(0, cur.week - 24), cur.week - 12).flatMap((w) => w.sessions)) : { pct: null };
  const spark = (k: "fitness" | "fatigue" | "form") => LOAD_SERIES.slice(-28).map((p) => p[k]);
  const loadBars = Array.from({ length: 14 }, (_, i) => dayLoad(addDays(t, -13 + i)));
  const volBars = WEEKS.slice(Math.max(0, cur.week - 12), cur.week).map((w) => weekStatus(w).actualH);
  const compBars = WEEKS.slice(Math.max(0, cur.week - 12), cur.week).map((w) => complianceFor(w.sessions).pct ?? 0);
  return {
    load: { v: load7, d: pctDelta(load7, load7prev), bars: loadBars },
    fitness: { v: last.fitness, d: pctDelta(last.fitness, wkAgo.fitness), spark: spark("fitness") },
    fatigue: { v: last.fatigue, d: pctDelta(last.fatigue, wkAgo.fatigue), spark: spark("fatigue") },
    form: { v: last.form, dAbs: last.form - wkAgo.form, spark: spark("form") },
    volume: { v: volNow, d: pctDelta(volNow, volPrev), bars: volBars },
    consistency: { v: comp12.pct, dAbs: comp12.pct != null && compPrev.pct != null ? comp12.pct - compPrev.pct : null, bars: compBars },
  };
}

/** Heart-rate zone of a session from its average HR (per-second HR arrives with the Garmin API). */
export function zoneOf(a: Activity): 1 | 2 | 3 | 4 | 5 | null {
  if (!a.hr) return null;
  return a.hr < 135 ? 1 : a.hr < 148 ? 2 : a.hr < 158 ? 3 : a.hr < 168 ? 4 : 5;
}
export function zoneDistribution(days = 84) {
  const t = today(), from = addDays(t, -days);
  const acts = ACTIVITIES.filter((a) => between(a, from, t));
  const load = [0, 0, 0, 0, 0, 0];
  let total = 0, unknown = 0;
  for (const a of acts) { const z = zoneOf(a), l = activityLoad(a); total += l; if (z) load[z] += l; else unknown += l; }
  const known = total - unknown || 1;
  const zones = [1, 2, 3, 4, 5].map((z) => ({ z, load: Math.round(load[z]), pct: Math.round((load[z] / known) * 100) }));
  const easy = zones[0].pct + zones[1].pct, moderate = zones[2].pct, hard = zones[3].pct + zones[4].pct;
  // previous window for the trend line
  const pf = addDays(from, -days);
  const prevActs = ACTIVITIES.filter((a) => between(a, pf, from));
  let pe = 0, pt = 0;
  for (const a of prevActs) { const z = zoneOf(a), l = activityLoad(a); if (z) { pt += l; if (z <= 2) pe += l; } }
  const prevEasy = pt ? Math.round((pe / pt) * 100) : null;
  return { total: Math.round(total), zones, easy, moderate, hard, prevEasy, sessions: acts.length, withHr: acts.filter((a) => a.hr).length };
}

/** Sport cards: current 4 weeks vs the 4 before, plus a 12-week weekly trend. */
export function sportPerformance(sp: "swim" | "bike" | "run") {
  const t = today();
  const win = (endOffset: number) => ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(t, -endOffset - 28), addDays(t, -endOffset)));
  const cur = win(0), prev = win(28);
  const wavg = (xs: Activity[], f: (a: Activity) => number | null) => { const v = xs.filter((a) => f(a) != null); const w = v.reduce((s, a) => s + a.min, 0); return w ? v.reduce((s, a) => s + (f(a) as number) * a.min, 0) / w : null; };
  const pace = (a: Activity) => paceOf(a, sp);
  const hr = (a: Activity) => a.hr ?? null;
  const best = (xs: Activity[]) => { const v = xs.map(pace).filter((x): x is number => x != null); return v.length ? (sp === "bike" ? Math.max(...v) : Math.min(...v)) : null; };
  const longest = (xs: Activity[]) => { const v = xs.map((a) => (sp === "swim" ? a.yd ?? 0 : a.mi ?? 0)); return v.length ? Math.max(...v) : null; };
  const rows = [
    { k: sp === "bike" ? "Avg speed" : "Pace", cur: wavg(cur, pace), prev: wavg(prev, pace), kind: sp === "bike" ? "speed" : "pace" as const },
    { k: sp === "bike" ? "Best speed" : "Best pace", cur: best(cur), prev: best(prev), kind: sp === "bike" ? "speed" : "pace" as const },
    { k: "Heart rate", cur: wavg(cur, hr), prev: wavg(prev, hr), kind: "hr" as const },
    { k: sp === "swim" ? "Longest swim" : sp === "bike" ? "Longest ride" : "Longest run", cur: longest(cur), prev: longest(prev), kind: "dist" as const },
  ];
  // weekly trend (12 weeks): duration-weighted pace per week
  const wk = currentWeek();
  const trend = WEEKS.slice(Math.max(0, wk.week - 12), wk.week).map((w) => { const s = fromYmd(w.start), e = addDays(s, 7); const xs = ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(s, -1), e)); return { week: w.week, v: wavg(xs, pace) }; });
  return { rows, trend, sessions: cur.length };
}

export type Metric = "pace" | "hr" | "distance" | "duration" | "load";
export const METRICS: { k: Metric; label: string }[] = [{ k: "pace", label: "Pace" }, { k: "hr", label: "Heart rate" }, { k: "distance", label: "Distance" }, { k: "duration", label: "Duration" }, { k: "load", label: "Load" }];
export function progressSeries(sp: "swim" | "bike" | "run", metric: Metric, days = 84) {
  const t = today(), from = addDays(t, -days);
  const val = (a: Activity): number | null => metric === "pace" ? paceOf(a, sp) : metric === "hr" ? a.hr ?? null : metric === "distance" ? (sp === "swim" ? a.yd ?? null : a.mi ?? null) : metric === "duration" ? a.min : activityLoad(a);
  const pts = ACTIVITIES.filter((a) => a.sport === sp && between(a, from, t)).map((a) => ({ id: a.id, date: a.date, v: val(a) })).filter((p): p is { id: string; date: string; v: number } => p.v != null);
  const cur = pts.length ? pts[pts.length - 1].v : null;
  const first = pts.length ? pts[0].v : null;
  return { pts, cur, first, delta: pctDelta(cur, first) };
}

/** Recent sessions with planned vs actual and an execution score. */
export function trainingQuality(n = 6) {
  return [...ACTIVITIES].reverse().slice(0, n).map((a) => {
    const r = analyzeActivity(a);
    const durScore = r.planned ? Math.min(1, a.min / Math.max(1, r.planned.min)) : 1;
    const paceScore = r.verdict === "in range" ? 1 : r.verdict ? 0.8 : 1;
    const execution = Math.round(durScore * paceScore * 100);
    const facts: string[] = [];
    if (r.planned) facts.push(`${a.min} of ${r.planned.min} min planned`); else facts.push("no session planned that day");
    if (r.verdict && r.verdict !== "in range") facts.push(r.verdict); else if (r.verdict) facts.push("pace in range");
    if (r.planned && r.planned.sport !== a.sport && r.planned.sport !== "brick") facts.push(`plan was ${r.planned.title.toLowerCase()}`);
    return { a, planned: r.planned, load: r.load, execution, level: execution >= 90 ? "good" : execution >= 75 ? "ok" : "low", insight: facts.join(" · ") };
  });
}

export function raceReadiness() {
  const p = raceProjection();
  const goal = ATHLETE.raceSplits;
  const goalTotal = goal.swim + goal.bike + goal.run + goal.transitions;
  const range = (h: number | null) => (h == null ? null : { lo: h * 0.97, hi: h * 1.04 });
  const gapMin = p.total != null ? (p.total - goalTotal) * 60 : null;
  const t = today();
  const n = ACTIVITIES.filter((a) => between(a, addDays(t, -28), t)).length;
  return { ...p, goalTotal, ranges: { swim: range(p.swimH), bike: range(p.bikeH), run: range(p.runH), total: range(p.total) }, gapMin, onTrack: gapMin != null ? gapMin <= 0 : null, sessions4w: n, score: raceScore().score };
}

/** Three factual observations for the Sunday review, no advice. */
export function observations() {
  const out: { title: string; text: string }[] = [];
  const cur = currentWeek(), st = weekStatus(cur);
  const ld = loadNow();
  out.push({ title: "Load", text: `Fitness ${ld.fitness.toFixed(0)}, fatigue ${ld.fatigue.toFixed(0)}, form ${ld.form > 0 ? "+" : ""}${ld.form.toFixed(0)}. This week ${ld.thisWeek} load vs ${ld.lastWeek} last week (${ld.ramp > 0 ? "+" : ""}${(ld.ramp * 100).toFixed(0)}%).` });
  const c = rollingCompliance(28);
  out.push({ title: "Sessions", text: `${st.done} of ${st.total} sessions this week, ${fmtH(st.actualH)} of ${fmtH(st.plannedH)} planned. 28-day compliance ${c.pct}% (${c.done} of ${c.planned}).` });
  const tt = totals();
  const lr = tt.bests.longestRun, lb = tt.bests.longestRide, ls = tt.bests.longestSwim;
  out.push({ title: "Long sessions", text: `Longest so far: run ${lr?.mi != null ? lr.mi.toFixed(1) + " mi" : "—"}, ride ${lb?.mi != null ? lb.mi.toFixed(1) + " mi" : "—"}, swim ${ls?.yd != null ? ls.yd.toLocaleString() + " yd" : "—"}. Race day: 26.2 mi · 112 mi · 4,224 yd.` });
  return out;
}
const fmtH = (h: number) => `${h.toFixed(1)} h`;
