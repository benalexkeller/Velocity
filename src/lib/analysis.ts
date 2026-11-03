// Analysis math. Everything here is computed from the same data the rest of the app uses
// (plan + activities + body metrics). Formulas are documented inline so the page can show them.
// `createAnalysis(activities, weeks)` builds the whole toolkit for a given data set, so the pages
// can run it over the live plan store (seed + everything logged on this device) — see useAnalysis().
import bodySeed from "./data/seed/body.json";
import { ACTIVITIES as SEED_ACTIVITIES, WEEKS as SEED_WEEKS, PHASES as SEED_PHASES, activityLoad as activityLoadIn, activitiesOn as activitiesOnIn, actualByDiscipline as actualByDisciplineIn, plannedByDiscipline, plannedLoad as plannedLoadOf, currentWeek as currentWeekIn, rollingCompliance as rollingComplianceIn, STATUS_CREDIT, weekStatus as weekStatusIn, type Activity, type Phase, type Session, type Sport, type Week } from "./data";
import { DEFAULT_ATHLETE, DEFAULT_LTHR, hrZone, type Athlete } from "./athlete";
import { addDays, fromYmd, today, ymd } from "./format";
import { fmtDist, swimDist } from "./units";

// ---------- body metrics (Garmin) ----------
export interface BodyDay { date: string; rhr?: number; hrv?: number; sleep_h?: number; sleep_score?: number; stress?: number; vo2?: number; /** WHOOP recovery % */ recovery?: number; /** WHOOP day strain */ strain?: number }
export const BODY_SEED: BodyDay[] = (bodySeed as BodyDay[]).slice().sort((a, b) => a.date.localeCompare(b.date));

function avg(xs: (number | undefined)[]) { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }

// ---------- pace corridors (plan start → race day) ----------
// Coach-set. Lower = faster for run/swim (seconds); bike is mph (higher = faster).
const CORRIDOR: Record<"run" | "swim" | "bike", { start: [number, number]; race: [number, number] }> = {
  run: { start: [615, 675], race: [570, 630] }, // 10:15–11:15 → 9:30–10:30 /mi
  swim: { start: [100, 110], race: [88, 98] }, // 1:40–1:50 → 1:28–1:38 /100 yd
  bike: { start: [16.5, 18], race: [18.5, 20] }, // mph
};
export function corridorFor(planStart: string, raceDate: string) {
  return (sp: "run" | "swim" | "bike", date: Date) => {
    const s = fromYmd(planStart), r = fromYmd(raceDate);
    const f = Math.min(1, Math.max(0, (date.getTime() - s.getTime()) / Math.max(1, r.getTime() - s.getTime())));
    const c = CORRIDOR[sp];
    return { lo: c.start[0] + (c.race[0] - c.start[0]) * f, hi: c.start[1] + (c.race[1] - c.start[1]) * f };
  };
}
export function paceOf(a: Activity, sp: "run" | "swim" | "bike"): number | null {
  if (sp === "run") return a.pace_s ?? null;
  if (sp === "swim") return a.p100_s ?? null;
  return a.mph ?? null;
}
/** Sessions long enough for their pace to mean something in an average (a 12-min swim does not move the 4-week swim pace). */
export function paceEligible(a: Activity, sp: "run" | "swim" | "bike"): boolean {
  if (sp === "swim") return a.min >= 15 && (a.yd ?? 0) >= 500;
  if (sp === "bike") return a.min >= 20 && (a.mi ?? 0) >= 5;
  return a.min >= 15 && (a.mi ?? 0) >= 2;
}
export function parseRange(s: string | undefined): [number, number] | null {
  if (!s) return null;
  const parts = s.replace(/mph/g, "").split(/[–-]/).map((x) => x.trim());
  if (parts.length !== 2) return null;
  const toN = (x: string) => (x.includes(":") ? x.split(":").reduce((a, b) => a * 60 + Number(b), 0) : Number(x));
  const a = toN(parts[0]), b = toN(parts[1]);
  return isNaN(a) || isNaN(b) ? null : [a, b];
}
/** Heart-rate zone of a session from its average HR (per-second HR arrives with the Garmin API). */
export function zoneOfIn(a: Activity, lthr: number | null = DEFAULT_LTHR): 1 | 2 | 3 | 4 | 5 | null {
  if (!a.hr) return null;
  return hrZone(a.sport, a.hr, lthr);
}
export interface LoadPoint { date: string; load: number; fitness: number; fatigue: number; form: number }
export type Metric = "pace" | "hr" | "distance" | "duration" | "load";
export const METRICS: { k: Metric; label: string }[] = [{ k: "pace", label: "Pace" }, { k: "hr", label: "Heart rate" }, { k: "distance", label: "Distance" }, { k: "duration", label: "Duration" }, { k: "load", label: "Load" }];

export interface AnalysisInputs { phases?: Phase[]; body?: BodyDay[]; athlete?: Athlete }
export function createAnalysis(ACTIVITIES: Activity[], WEEKS: Week[], inputs: AnalysisInputs = {}) {
  const PHASES = inputs.phases ?? SEED_PHASES;
  const BODY = (inputs.body ?? BODY_SEED).slice().sort((a, b) => a.date.localeCompare(b.date));
  const ATHLETE = inputs.athlete ?? DEFAULT_ATHLETE;
  const LTHR = ATHLETE.lthr ?? DEFAULT_LTHR;
  const activityLoad = (a: Activity) => activityLoadIn(a, LTHR);
  const zoneOf = (a: Activity) => zoneOfIn(a, LTHR);
  const activitiesOn = (date: string) => activitiesOnIn(date, ACTIVITIES);
  const actualByDiscipline = (w: Week) => actualByDisciplineIn(w, ACTIVITIES);
  const currentWeek = () => currentWeekIn(WEEKS);
  const rollingCompliance = (days = 28) => rollingComplianceIn(days, WEEKS);
  const weekStatus = (w: Week) => weekStatusIn(w, ACTIVITIES);
  const phaseWeeks = (p: Phase) => WEEKS.slice(p.from - 1, p.to);
  const fmtH = (h: number) => `${h.toFixed(1)} h`;
  const corridorAt = corridorFor(ATHLETE.planStart, ATHLETE.race.date);

  // ---------- body metrics (Garmin) ----------
  function bodyWindow(days: number, endOffset = 0) {
    const end = addDays(today(), -endOffset), start = addDays(end, -days);
    return BODY.filter((b) => { const d = fromYmd(b.date); return d > start && d <= end; });
  }
  function bodySummary(days = 7, endOffset = 0) {
    const w = bodyWindow(days, endOffset);
    const vo2 = [...BODY].reverse().find((b) => b.vo2 != null && fromYmd(b.date) <= addDays(today(), -endOffset))?.vo2 ?? null;
    return { rhr: avg(w.map((b) => b.rhr)), hrv: avg(w.map((b) => b.hrv)), sleep: avg(w.map((b) => b.sleep_h)), sleepScore: avg(w.map((b) => b.sleep_score)), stress: avg(w.map((b) => b.stress)), vo2, n: w.length };
  }

  // ---------- load model (earned from work done) ----------
  // Fitness = 42-day exponentially weighted daily load; Fatigue = 7-day; Form = Fitness − Fatigue.
  // The averages start 42 days before the first data (plan start or first activity, whichever is earlier),
  // seeded with the mean daily load of the first 14 days, so Fitness is not a warm-up artefact.
  // Only days from the plan start (or today, if the plan starts later) are shown.
  const LOAD_SERIES: LoadPoint[] = (() => {
    const out: LoadPoint[] = [];
    const t = today();
    const firstAct = ACTIVITIES.length ? fromYmd(ACTIVITIES.reduce((m, a) => (a.date < m ? a.date : m), ACTIVITIES[0].date)) : null;
    const planStart = fromYmd(ATHLETE.planStart);
    const dataStart = [planStart, t, ...(firstAct ? [firstAct] : [])].reduce((m, d) => (d < m ? d : m));
    const showFrom = planStart < t ? planStart : t;
    const dayLoadAt = (d: Date) => activitiesOn(ymd(d)).reduce((s, a) => s + activityLoad(a), 0);
    let seed = 0;
    for (let i = 0; i < 14; i++) seed += dayLoadAt(addDays(dataStart, i));
    let fit = seed / 14, fat = seed / 14;
    for (let d = addDays(dataStart, -42); d <= t; d = addDays(d, 1)) {
      const load = d >= dataStart ? dayLoadAt(d) : seed / 14;
      fit += (load - fit) / 42;
      fat += (load - fat) / 7;
      if (d >= showFrom) out.push({ date: ymd(d), load: d >= dataStart ? load : 0, fitness: fit, fatigue: fat, form: fit - fat });
    }
    if (!out.length) out.push({ date: ymd(t), load: 0, fitness: 0, fatigue: 0, form: 0 });
    return out;
  })();
  function loadNow() {
    const last = LOAD_SERIES.at(-1) ?? { date: ymd(today()), load: 0, fitness: 0, fatigue: 0, form: 0 };
    const wk = currentWeek();
    const weekLoad = (w: number) => { if (!WEEKS[w - 1]) return 0; const s = fromYmd(WEEKS[w - 1].start); let t = 0; for (let i = 0; i < 7; i++) t += activitiesOn(ymd(addDays(s, i))).reduce((x, a) => x + activityLoad(a), 0); return t; };
    const thisW = weekLoad(wk.week), lastW = wk.week > 1 ? weekLoad(wk.week - 1) : 0;
    const ramp = lastW ? (thisW - lastW) / lastW : 0;
    return { ...last, thisWeek: thisW, lastWeek: lastW, ramp, rampFlag: ramp > 0.10 && fromYmd(wk.start) <= addDays(today(), -6) };
  }
  function loadWeekly() {
    // one point per plan week (last day of week or today)
    return WEEKS.filter((w) => fromYmd(w.start) <= today()).map((w) => {
      const end = addDays(fromYmd(w.start), 6);
      const pt = [...LOAD_SERIES].reverse().find((p) => fromYmd(p.date) <= end) ?? LOAD_SERIES[0];
      return { week: w.week, ...pt };
    });
  }

  // ---------- compliance ----------
  function complianceFor(sessions: Session[]) {
    const t = today();
    const s = sessions.filter((x) => x.sport !== "rest" && fromYmd(x.date) <= t);
    const done = s.reduce((n, x) => n + STATUS_CREDIT[x.status], 0);
    return { done, total: s.length, pct: s.length ? Math.round((done / s.length) * 100) : null };
  }
  function complianceByPhase() {
    return PHASES.filter((p) => fromYmd(p.weeks[0].start) <= today()).map((p) => ({ phase: p.short, ...complianceFor(phaseWeeks(p).flatMap((w) => w.sessions)) }));
  }

  function paceSeries(sp: "run" | "swim" | "bike", days = 84) {
    const since = addDays(today(), -days);
    return ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) >= since && paceOf(a, sp) != null).map((a) => ({ id: a.id, date: a.date, v: paceOf(a, sp) as number, min: a.min, hr: a.hr }));
  }
  function weightedAvgPace(sp: "run" | "swim" | "bike", days = 28, endOffset = 0) {
    const end = addDays(today(), -endOffset), since = addDays(end, -days);
    const pts = ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) > since && fromYmd(a.date) <= end && paceOf(a, sp) != null && paceEligible(a, sp));
    const w = pts.reduce((s, a) => s + a.min, 0);
    return w ? pts.reduce((s, a) => s + (paceOf(a, sp) as number) * a.min, 0) / w : null;
  }

  // ---------- volume ----------
  function volumeWeekly(n = 12) {
    const cur = currentWeek();
    const from = Math.max(1, cur.week - n + 1);
    return WEEKS.slice(from - 1, cur.week).map((w) => ({ week: w.week, start: w.start, actual: actualByDiscipline(w), planned: plannedByDiscipline(w), plannedH: w.plannedMin / 60 }));
  }

  // ---------- totals & bests ----------
  function totals() {
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

  // ---------- race projection ----------
  // Shown only once training is specific enough (Build phase, or long sessions at half the race distance).
  // Run: Riegel from the longest recent run (exponent 1.06), ×1.12 off the bike in a triathlon.
  // Bike: average speed of rides of 2 h or more. Swim: pace of the longest swim ≥ 1,500 yd (or ¾ of the race swim) × 1.05.
  function raceProjection() {
    const D = ATHLETE.raceDist;
    const t = today(), since = addDays(t, -56);
    const recent = ACTIVITIES.filter((a) => fromYmd(a.date) > since && fromYmd(a.date) <= t);
    const longest = (sp: "run" | "bike" | "swim") => recent.filter((a) => a.sport === sp).reduce<Activity | null>((m, a) => { const d = sp === "swim" ? a.yd ?? 0 : a.mi ?? 0; const md = m ? (sp === "swim" ? m.yd ?? 0 : m.mi ?? 0) : -1; return d > md ? a : m; }, null);
    const lr = longest("run"), lb = longest("bike"), ls = longest("swim");
    const tri = D.swimYd > 0 && D.bikeMi > 0 && D.runMi > 0;
    const phase = currentWeek()?.phase ?? "";
    const specific = /build|peak|taper|race/i.test(phase);
    const halfDone = (D.runMi === 0 || (lr?.mi ?? 0) >= D.runMi * 0.5) && (D.bikeMi === 0 || (lb?.mi ?? 0) >= D.bikeMi * 0.5);
    const ready = ATHLETE.hasRace && (specific || halfDone);
    let runH: number | null = D.runMi === 0 ? 0 : null;
    if (D.runMi > 0 && lr?.mi && lr.mi >= 2) runH = ((lr.min / 60) * Math.pow(D.runMi / lr.mi, 1.06)) * (tri ? 1.12 : 1);
    let bikeH: number | null = D.bikeMi === 0 ? 0 : null;
    if (D.bikeMi > 0) {
      const rides = recent.filter((a) => a.sport === "bike" && a.mph && a.min >= 120);
      const w = rides.reduce((x, a) => x + a.min, 0);
      if (w) bikeH = D.bikeMi / (rides.reduce((x, a) => x + (a.mph as number) * a.min, 0) / w);
    }
    let swimH: number | null = D.swimYd === 0 ? 0 : null;
    if (D.swimYd > 0) {
      const minYd = Math.min(1500, D.swimYd * 0.75);
      const sw = recent.filter((a) => a.sport === "swim" && a.p100_s && (a.yd ?? 0) >= minYd).sort((a, b) => (b.yd ?? 0) - (a.yd ?? 0))[0];
      if (sw?.p100_s) swimH = ((D.swimYd / 100) * sw.p100_s * 1.05) / 3600;
    }
    const tr = tri ? ATHLETE.raceSplits.transitions : 0;
    const total = swimH != null && bikeH != null && runH != null ? swimH + bikeH + runH + tr : null;
    return { ready, phase, longest: { run: lr?.mi ?? 0, bike: lb?.mi ?? 0, swim: ls?.yd ?? 0 }, swimH, bikeH, runH, transitions: tr, total, goal: ATHLETE.raceSplits };
  }

  // ---------- single-activity analysis ----------
  function analyzeActivity(a: Activity) {
    const week = WEEKS.find((w) => w.sessions.some((s) => s.date === a.date));
    const onDay = week?.sessions.filter((s) => s.date === a.date) ?? [];
    const restDay = onDay.length > 0 && onDay.every((s) => s.sport === "rest");
    // a rest day is not a planned session: nothing to compare duration or pace against
    // the session this activity was paired with (same sport only); another sport never stands in for the plan
    const planned = onDay.find((s) => s.actual?.id === a.id) ?? onDay.find((s) => s.sport === a.sport || (s.sport === "brick" && (a.sport === "bike" || a.sport === "run"))) ?? null;
    const otherPlanned = planned ? null : onDay.find((s) => s.sport !== "rest") ?? null;
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
    return { planned, otherPlanned, restDay, zone, range, pace, verdict, load, durDelta, fitnessEffect: load / 42, fatigueEffect: load / 7, ef, efAvg, efN: sameType.length, sport: sp as Sport | null };
  }

  // =====================================================================
  // Analytics page (mock v2) — every panel below is computed from the same data.
  // =====================================================================
  const dayLoad = (d: Date) => activitiesOn(ymd(d)).reduce((s, a) => s + activityLoad(a), 0);
  const pctDelta = (cur: number | null, prev: number | null) => (cur == null || prev == null || !prev ? null : ((cur - prev) / Math.abs(prev)) * 100);
  const between = (a: Activity, from: Date, to: Date) => { const d = fromYmd(a.date); return d > from && d <= to; };

  /** Top KPI tiles. Deltas compare with the previous period of the same length. */
  // KPI row (V-080/081): this week vs plan, week load, fitness, form, 28-day compliance, run efficiency.
  // Deltas are in points or units, and only when the earlier window has data.
  function kpis() {
    const t = today();
    const last = LOAD_SERIES[LOAD_SERIES.length - 1], wkAgo = LOAD_SERIES[Math.max(0, LOAD_SERIES.length - 8)];
    const cur = currentWeek(), prev = cur.week > 1 ? WEEKS[cur.week - 2] : null;
    const ws = weekStatus(cur);
    const planned = (w: Week) => w.sessions.reduce((x, s) => x + plannedLoadOf(s), 0);
    const actual = (w: Week) => { let x = 0; for (let i = 0; i < 7; i++) for (const a of activitiesOn(ymd(addDays(fromYmd(w.start), i)))) x += activityLoad(a); return x; };
    const spark = (k: "fitness" | "fatigue" | "form") => LOAD_SERIES.slice(-28).map((p) => p[k]);
    const recent = WEEKS.slice(Math.max(0, cur.week - 8), cur.week);
    const daysWithLoad = (from: number, to: number) => { let n = 0; for (let i = from; i < to; i++) if (dayLoad(addDays(t, -i)) > 0) n++; return n; };
    const baseline = daysWithLoad(7, 49) >= 3; // the 7-days-ago value means something only with earlier training
    const form = last.form;
    const formWord = form <= -30 ? "very fatigued" : form < -10 ? "fatigued" : form <= 5 ? "neutral" : form <= 25 ? "fresh" : last.fitness < wkAgo.fitness ? "detraining" : "very fresh";
    const comp = rollingCompliance(28);
    // run efficiency: metres per minute per heartbeat on steady runs ≥ 20 min (threshold and above left out), duration-weighted
    const ef = (fromDay: number, toDay: number) => {
      let w = 0, x = 0;
      for (const a of ACTIVITIES) {
        if (a.sport !== "run" || !a.hr || !a.pace_s || a.min < 20) continue;
        const d = fromYmd(a.date), age = (t.getTime() - d.getTime()) / 864e5;
        if (age < fromDay || age >= toDay || hrZone("run", a.hr, LTHR) > 3) continue;
        x += ((1609.34 / (a.pace_s / 60)) / a.hr) * a.min; w += a.min;
      }
      return w ? x / w : null;
    };
    const efNow = ef(0, 28), efPrev = ef(28, 56);
    const vo2All = BODY.filter((b) => b.vo2 != null).map((b) => ({ date: b.date, v: b.vo2 as number }));
    const vo2Now = vo2All.at(-1) ?? null, vo2Ago = [...vo2All].reverse().find((b) => fromYmd(b.date) <= addDays(t, -28)) ?? null;
    return {
      vo2: { v: vo2Now?.v ?? null, date: vo2Now?.date ?? null, d: vo2Now && vo2Ago ? vo2Now.v - vo2Ago.v : null, since: vo2Ago?.date ?? null, spark: vo2All.slice(-12).map((b) => b.v) },
      week: { done: ws.done, total: ws.total, h: ws.actualH, plannedH: ws.plannedH, bars: recent.map((w) => weekStatus(w).actualH) },
      load: { v: Math.round(actual(cur)), planned: Math.round(planned(cur)), last: prev ? Math.round(actual(prev)) : null, bars: recent.map((w) => actual(w)) },
      fitness: { v: last.fitness, d: baseline ? last.fitness - wkAgo.fitness : null, spark: spark("fitness") },
      form: { v: form, word: formWord, fatigue: last.fatigue, fitness: last.fitness, spark: spark("form") },
      compliance: { v: comp.pct, done: comp.done, planned: comp.planned },
      ef: { v: efNow, d: efNow != null && efPrev != null ? efNow - efPrev : null, ratio: efNow != null && efPrev ? efNow / efPrev : null },
    };
  }

  function zoneDistribution(days = 84) {
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

  /** The last `n` calendar weeks (Monday to Sunday) up to the current one, labelled with the plan's week number when inside the plan. */
  function lastWeeks(n = 12) {
    const cur = currentWeek();
    const s0 = fromYmd(cur.start);
    return Array.from({ length: n }, (_, i) => { const start = addDays(s0, -7 * (n - 1 - i)); const ys = ymd(start); const w = WEEKS.find((x) => x.start === ys); return { start: ys, week: w ? w.week : null }; });
  }
  /** Sport cards: the last 5 sessions (fewer when there are fewer) against the 5 before, plus a 12-week weekly trend. */
  function sportPerformance(sp: "swim" | "bike" | "run") {
    const all = ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) <= today());
    const cur = all.slice(-5), prev = all.slice(Math.max(0, all.length - 10), Math.max(0, all.length - 5));
    const wavg = (xs: Activity[], f: (a: Activity) => number | null) => { const v = xs.filter((a) => f(a) != null); const w = v.reduce((s, a) => s + a.min, 0); return w ? v.reduce((s, a) => s + (f(a) as number) * a.min, 0) / w : null; };
    const pace = (a: Activity) => paceOf(a, sp);
    const hr = (a: Activity) => a.hr ?? null;
    const best = (xs: Activity[]) => { const v = xs.filter((a) => paceEligible(a, sp)).map(pace).filter((x): x is number => x != null); return v.length ? (sp === "bike" ? Math.max(...v) : Math.min(...v)) : null; };
    const longest = (xs: Activity[]) => { const v = xs.map((a) => (sp === "swim" ? a.yd ?? 0 : a.mi ?? 0)); return v.length ? Math.max(...v) : null; };
    const rows = [
      { k: sp === "bike" ? "Avg speed" : "Pace", cur: wavg(cur.filter((a) => paceEligible(a, sp)), pace), prev: wavg(prev.filter((a) => paceEligible(a, sp)), pace), kind: sp === "bike" ? "speed" : "pace" as const },
      { k: sp === "bike" ? "Best speed" : "Best pace", cur: best(cur), prev: best(prev), kind: sp === "bike" ? "speed" : "pace" as const },
      { k: "Heart rate", cur: wavg(cur, hr), prev: wavg(prev, hr), kind: "hr" as const },
      { k: sp === "swim" ? "Longest swim" : sp === "bike" ? "Longest ride" : "Longest run", cur: longest(cur), prev: longest(prev), kind: "dist" as const },
    ];
    // weekly trend (12 weeks): duration-weighted pace per week
    const trend = lastWeeks(12).map((w) => { const s = fromYmd(w.start), e = addDays(s, 7); const xs = ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(s, -1), e)); return { week: w.week, start: w.start, v: wavg(xs, pace) }; });
    return { rows, trend, sessions: cur.length, prevSessions: prev.length };
  }

  // ---------- thresholds (from the plan's zones, else the best recent session) ----------
  /** Threshold pace or speed in storage units (s/mi, s/100 yd, mph). */
  function thresholdRef(sp: "swim" | "bike" | "run"): number | null {
    const z = ATHLETE.zones[sp]?.["Tempo"];
    const r = parseRange(z);
    if (r && !(sp === "bike" && /W$/.test(z ?? ""))) return sp === "run" ? r[0] : sp === "swim" ? (r[0] + r[1]) / 2 : r[1];
    const t = today();
    const v = ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(t, -56), t) && paceEligible(a, sp)).map((a) => paceOf(a, sp)).filter((x): x is number => x != null);
    return v.length ? (sp === "bike" ? Math.max(...v) : Math.min(...v)) : null;
  }
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  /** A 0-100 score for the latest session of a sport: intensity against threshold (40), efficiency against the
   *  athlete's own usual (30), duration against the longest recent session (30). Parts without data are left out
   *  and the score is scaled to what is there. */
  function sessionScore(sp: "swim" | "bike" | "run") {
    const t = today();
    const a = [...ACTIVITIES].reverse().find((x) => x.sport === sp && fromYmd(x.date) <= t && paceEligible(x, sp) && paceOf(x, sp) != null);
    if (!a) return null;
    const parts: { k: string; pts: number; max: number; text: string }[] = [];
    const missing: string[] = [];
    const pace = paceOf(a, sp) as number, ref = thresholdRef(sp);
    if (ref) {
      const ratio = sp === "bike" ? pace / ref : ref / pace;
      parts.push({ k: "Intensity", pts: clamp01((ratio - 0.8) / 0.2) * 40, max: 40, text: `${Math.round(ratio * 100)}% of threshold ${sp === "bike" ? "speed" : "pace"}` });
    } else missing.push("threshold");
    const r = analyzeActivity(a);
    if (r.ef != null && r.efAvg != null && r.efN >= 2) {
      const q = r.ef / r.efAvg;
      parts.push({ k: "Efficiency", pts: q < 1 ? clamp01((q - 0.9) / 0.1) * 20 : 20 + clamp01((q - 1) / 0.1) * 10, max: 30, text: `${q >= 1 ? "+" : ""}${Math.round((q - 1) * 100)}% speed per heartbeat vs your 4-week usual` });
    } else missing.push("heart rate");
    const longest = Math.max(...ACTIVITIES.filter((x) => x.sport === sp && between(x, addDays(t, -56), t)).map((x) => x.min), a.min);
    parts.push({ k: "Duration", pts: clamp01(a.min / longest) * 30, max: 30, text: `${a.min} of your longest ${longest} min` });
    const max = parts.reduce((x, p) => x + p.max, 0);
    const score = Math.round((parts.reduce((x, p) => x + p.pts, 0) / max) * 100);
    return { activity: a, score, parts: parts.map((p) => ({ ...p, pts: Math.round(p.pts) })), missing };
  }

  /** Expert insights per sport, one point per plan week (last 12), from whole-session values. */
  function sportInsights(sp: "swim" | "bike" | "run") {
    const weeks = lastWeeks(12);
    const inWeek = (w: { start: string }) => { const s0 = fromYmd(w.start); return ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(s0, -1), addDays(s0, 7))); };
    const wavg = (xs: { v: number; w: number }[]) => { const w = xs.reduce((s2, x) => s2 + x.w, 0); return w ? xs.reduce((s2, x) => s2 + x.v * x.w, 0) / w : null; };
    type Series = { k: string; label: string; kind: "pace" | "speed" | "hr"; info: string; pts: { week: number | null; start: string; v: number | null }[] };
    const out: Series[] = [];
    const series = (k: string, label: string, kind: Series["kind"], info: string, f: (xs: Activity[]) => number | null) => out.push({ k, label, kind, info, pts: weeks.map((w) => ({ week: w.week, start: w.start, v: f(inWeek(w)) })) });
    if (sp === "run") {
      series("thr", "Pace at threshold heart rate", "pace", "What your pace would be at your threshold heart rate, from each steady run's speed per heartbeat (runs of 20 min or more with heart rate). Falling = fitter.",
        (xs) => wavg(xs.filter((a) => a.hr && a.pace_s && a.min >= 20).map((a) => ({ v: 1609.34 / (((1609.34 / (a.pace_s! / 60)) / a.hr!) * LTHR) * 60, w: a.min }))));
      const z2 = parseRange(ATHLETE.zones.run?.["Zone 2"]);
      series("hrEasy", "Heart rate at easy pace", "hr", "Average heart rate of runs at your easy (Zone 2) pace, or within 8% of the week's average pace when none fall in the zone. Falling at the same pace = the same work costs less.",
        (xs) => { const withHr = xs.filter((a) => a.hr && a.pace_s); const inZone = z2 ? withHr.filter((a) => a.pace_s! >= z2[0] && a.pace_s! <= z2[1]) : []; const avgP = wavg(xs.filter((a) => a.pace_s).map((a) => ({ v: a.pace_s!, w: a.min }))); const near = avgP != null ? withHr.filter((a) => Math.abs(a.pace_s! - avgP) / avgP <= 0.08) : []; return wavg((inZone.length ? inZone : near).map((a) => ({ v: a.hr!, w: a.min }))); });
      series("long", "Longest run pace", "pace", "Pace of the longest run of the week. Holding pace as the long run grows is race durability.",
        (xs) => { const l = xs.filter((a) => a.pace_s).sort((a, b) => (b.mi ?? 0) - (a.mi ?? 0))[0]; return l?.pace_s ?? null; });
    } else if (sp === "bike") {
      series("thr", "Speed at threshold heart rate", "speed", "What your speed would be at your threshold heart rate, from each steady ride's speed per heartbeat (rides of 20 min or more with heart rate). Rising = fitter. Power curves appear once a power meter is connected.",
        (xs) => wavg(xs.filter((a) => a.hr && a.mph && a.min >= 20).map((a) => ({ v: (a.mph! / a.hr!) * LTHR, w: a.min }))));
      const z2 = parseRange(ATHLETE.zones.bike?.["Zone 2"]); const z2mph = z2 && !/W$/.test(ATHLETE.zones.bike?.["Zone 2"] ?? "") ? z2 : null;
      series("hrEasy", "Heart rate at steady speed", "hr", "Average heart rate of rides at your steady (Zone 2) speed, or within 8% of the week's average speed when none fall in the zone. Falling at the same speed = the same work costs less.",
        (xs) => { const withHr = xs.filter((a) => a.hr && a.mph); const inZone = z2mph ? withHr.filter((a) => a.mph! >= z2mph[0] && a.mph! <= z2mph[1]) : []; const avgV = wavg(xs.filter((a) => a.mph).map((a) => ({ v: a.mph!, w: a.min }))); const near = avgV != null ? withHr.filter((a) => Math.abs(a.mph! - avgV) / avgV <= 0.08) : []; return wavg((inZone.length ? inZone : near).map((a) => ({ v: a.hr!, w: a.min }))); });
      series("long", "Longest ride speed", "speed", "Average speed of the longest ride of the week. Holding speed as the ride grows is race durability.",
        (xs) => { const l = xs.filter((a) => a.mph).sort((a, b) => (b.mi ?? 0) - (a.mi ?? 0))[0]; return l?.mph ?? null; });
    } else {
      series("thr", "Threshold pace", "pace", "Best pace of swims of 1,000 yd (900 m) or more in the six weeks up to that week, a stand-in for critical swim speed. Falling = fitter.",
        (xs) => { if (!xs.length) return null; const end = addDays(fromYmd(xs[0].date), 7); const win = ACTIVITIES.filter((a) => a.sport === "swim" && a.p100_s && (a.yd ?? 0) >= 1000 && between(a, addDays(end, -42), end)); const v = win.map((a) => a.p100_s!); return v.length ? Math.min(...v) : null; });
      series("long", "Longest swim pace", "pace", "Pace of the longest swim of the week. Holding pace as the swim grows is race durability.",
        (xs) => { const l = xs.filter((a) => a.p100_s).sort((a, b) => (b.yd ?? 0) - (a.yd ?? 0))[0]; return l?.p100_s ?? null; });
    }
    return out.map((sr) => { const vals = sr.pts.filter((p) => p.v != null); return { ...sr, cur: vals.length ? vals[vals.length - 1].v : null }; });
  }

  /** Body values over a range, for the Body charts. */
  function bodySeries(k: "rhr" | "hrv" | "sleep_h" | "stress" | "vo2" | "recovery", days: number) {
    const from = addDays(today(), -days);
    return BODY.filter((b) => b[k] != null && (days >= 3650 || fromYmd(b.date) > from)).map((b) => ({ date: b.date, v: b[k] as number }));
  }

  /** Race window: each leg's projection moved by the sport's 8-week pace trend, with a spread from how much the
   *  sessions scatter; plus the countdown, sessions near goal pace and long-session durability. */
  function raceWindow() {
    const p = raceProjection();
    const D = ATHLETE.raceDist, t = today();
    const daysToRace = ATHLETE.hasRace ? Math.round((fromYmd(ATHLETE.race.date).getTime() - t.getTime()) / 864e5) : null;
    const goal = ATHLETE.raceSplits, goalOn = ATHLETE.hasRace && !!ATHLETE.race.goal;
    const legs = (["swim", "bike", "run"] as const).map((sp) => {
      const dist = sp === "swim" ? D.swimYd : sp === "bike" ? D.bikeMi : D.runMi;
      const centre = sp === "swim" ? p.swimH : sp === "bike" ? p.bikeH : p.runH;
      const xs = ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(t, -56), t) && paceEligible(a, sp) && paceOf(a, sp) != null);
      // weighted linear trend of pace against age in days (negative age = earlier), weights = minutes
      let trend = 0, spread = 0.03;
      if (xs.length >= 3) {
        const pts = xs.map((a) => ({ x: -(t.getTime() - fromYmd(a.date).getTime()) / 864e5, y: paceOf(a, sp) as number, w: a.min }));
        const W = pts.reduce((s2, q) => s2 + q.w, 0), mx = pts.reduce((s2, q) => s2 + q.x * q.w, 0) / W, my = pts.reduce((s2, q) => s2 + q.y * q.w, 0) / W;
        const sxx = pts.reduce((s2, q) => s2 + q.w * (q.x - mx) ** 2, 0), sxy = pts.reduce((s2, q) => s2 + q.w * (q.x - mx) * (q.y - my), 0);
        const slope = sxx ? sxy / sxx : 0; // pace units per day
        const rel = (slope * (daysToRace ?? 0)) / my; // relative change by race day
        trend = Math.max(-0.05, Math.min(0.05, sp === "bike" ? -rel : rel)); // for time: a faster pace (lower) shortens, a higher speed shortens
        const resid = Math.sqrt(pts.reduce((s2, q) => s2 + q.w * (q.y - (my + slope * (q.x - mx))) ** 2, 0) / W) / my;
        spread = Math.max(0.02, Math.min(0.08, resid));
      }
      const mid = centre != null && dist > 0 ? centre * (1 + trend) : centre;
      const goalH = goalOn ? (sp === "swim" ? goal.swim : sp === "bike" ? goal.bike : goal.run) : null;
      // sessions in the last 28 days within 5% of goal pace
      let near: { n: number; of: number } | null = null;
      if (goalH && dist > 0) {
        const goalPace = sp === "swim" ? (goalH * 3600) / (dist / 100) : sp === "bike" ? dist / goalH : (goalH * 3600) / dist;
        const recent = ACTIVITIES.filter((a) => a.sport === sp && between(a, addDays(t, -28), t) && paceEligible(a, sp) && paceOf(a, sp) != null);
        near = { n: recent.filter((a) => Math.abs((paceOf(a, sp) as number) - goalPace) / goalPace <= 0.05).length, of: recent.length };
      }
      const longest = sp === "swim" ? p.longest.swim : sp === "bike" ? p.longest.bike : p.longest.run;
      return { k: sp, show: dist > 0, mid, lo: mid != null ? mid * (1 - spread) : null, hi: mid != null ? mid * (1 + spread) : null, trend, spread, near, durability: dist > 0 ? Math.min(1, longest / dist) : null, goalH };
    }).filter((l) => l.show);
    const complete = legs.every((l) => l.mid != null);
    const sum = (f: (l: (typeof legs)[number]) => number | null) => (complete ? legs.reduce((s2, l) => s2 + (f(l) ?? 0), 0) + p.transitions : null);
    const goalTotal = goalOn ? goal.swim + goal.bike + goal.run + goal.transitions : null;
    return { ready: p.ready, daysToRace, legs, total: { mid: sum((l) => l.mid), lo: sum((l) => l.lo), hi: sum((l) => l.hi) }, transitions: p.transitions, goalTotal, longest: p.longest };
  }

  function progressSeries(sp: "swim" | "bike" | "run", metric: Metric, days = 84) {
    const t = today(), from = addDays(t, -days);
    const val = (a: Activity): number | null => metric === "pace" ? paceOf(a, sp) : metric === "hr" ? a.hr ?? null : metric === "distance" ? (sp === "swim" ? a.yd ?? null : a.mi ?? null) : metric === "duration" ? a.min : activityLoad(a);
    const pts = ACTIVITIES.filter((a) => a.sport === sp && between(a, from, t)).map((a) => ({ id: a.id, date: a.date, v: val(a) })).filter((p): p is { id: string; date: string; v: number } => p.v != null);
    const cur = pts.length ? pts[pts.length - 1].v : null;
    const first = pts.length ? pts[0].v : null;
    return { pts, cur, first, delta: pctDelta(cur, first) };
  }

  /** Recent sessions with planned vs actual and an execution score. */
  /** Recent activities against the plan, in words: Completed (same sport, ≥ 70 % of the planned time), Partial, Unplanned. */
  function trainingQuality(n = 6) {
    return [...ACTIVITIES].reverse().slice(0, n).map((a) => {
      const r = analyzeActivity(a);
      const status: "Completed" | "Partial" | "Unplanned" = r.planned ? (a.min >= 0.7 * r.planned.min ? "Completed" : "Partial") : "Unplanned";
      const facts: string[] = [];
      if (r.planned) facts.push(`${Math.round(a.min)} of ${r.planned.min} min planned`);
      else if (r.otherPlanned) facts.push(`plan was ${r.otherPlanned.title.toLowerCase()} ${r.otherPlanned.min} min`);
      else facts.push(r.restDay ? "rest day in the plan" : "no session planned that day");
      if (r.verdict && r.verdict !== "in range") facts.push(r.verdict); else if (r.verdict) facts.push("pace in range");
      return { a, planned: r.planned, load: r.load, status, level: status === "Completed" ? "good" : status === "Partial" ? "ok" : "none", insight: facts.join(", ") };
    });
  }

  function raceReadiness() {
    const p = raceProjection();
    const goal = ATHLETE.raceSplits;
    const goalTotal = ATHLETE.hasRace && ATHLETE.race.goal ? goal.swim + goal.bike + goal.run + goal.transitions : null;
    const gapMin = p.total != null && goalTotal != null ? (p.total - goalTotal) * 60 : null;
    const t = today();
    const n = ACTIVITIES.filter((a) => between(a, addDays(t, -28), t)).length;
    return { ...p, goalTotal, gapMin, sessions4w: n };
  }

  /** Three factual observations for the Sunday review, no advice. */
  function observations() {
    const out: { title: string; text: string }[] = [];
    const cur = currentWeek(), st = weekStatus(cur);
    const ld = loadNow();
    out.push({ title: "Load", text: `Fitness ${ld.fitness.toFixed(0)}, fatigue ${ld.fatigue.toFixed(0)}, form ${ld.form > 0 ? "+" : ""}${ld.form.toFixed(0)}. This week ${ld.thisWeek} load vs ${ld.lastWeek} last week (${ld.ramp > 0 ? "+" : ""}${(ld.ramp * 100).toFixed(0)}%).` });
    const c = rollingCompliance(28);
    out.push({ title: "Sessions", text: `${st.done} of ${st.total} sessions this week, ${fmtH(st.actualH)} of ${fmtH(st.plannedH)} planned. Completed sessions, 28 days: ${c.pct == null ? "-" : `${c.pct}%`} (${Math.round(c.done * 2) / 2} of ${c.planned}).` });
    const tt = totals();
    const lr = tt.bests.longestRun, lb = tt.bests.longestRide, ls = tt.bests.longestSwim;
    const u = ATHLETE.units;
    const sw = (yd: number) => `${swimDist(yd, u).v.toLocaleString()} ${swimDist(yd, u).u}`;
    out.push({ title: "Long sessions", text: `Longest so far: run ${lr?.mi != null ? fmtDist(lr.mi, 1, u) : "-"}, ride ${lb?.mi != null ? fmtDist(lb.mi, 1, u) : "-"}, swim ${ls?.yd != null ? sw(ls.yd) : "-"}. Race day: ${ATHLETE.raceDist.runMi ? fmtDist(ATHLETE.raceDist.runMi, 1, u) : "-"}, ${ATHLETE.raceDist.bikeMi ? fmtDist(ATHLETE.raceDist.bikeMi, 0, u) : "-"}, ${ATHLETE.raceDist.swimYd ? sw(ATHLETE.raceDist.swimYd) : "-"}.` });
    return out;
  }


  return { activities: ACTIVITIES, weeks: WEEKS, phases: PHASES, athlete: ATHLETE, BODY, bodySummary, corridorAt, activitiesOn, actualByDiscipline, currentWeek, rollingCompliance, weekStatus, LOAD_SERIES, loadNow, loadWeekly, complianceFor, complianceByPhase, paceSeries, weightedAvgPace, volumeWeekly, totals, raceProjection, analyzeActivity, kpis, zoneDistribution, sportPerformance, sportInsights, sessionScore, thresholdRef, bodySeries, raceWindow, progressSeries, trainingQuality, raceReadiness, observations };
}
export type Analysis = ReturnType<typeof createAnalysis>;
/** The seed-only toolkit, for code that runs outside the plan store (content, scripts). */
export const SEED_ANALYSIS = createAnalysis(SEED_ACTIVITIES, SEED_WEEKS);

export const zoneOf = zoneOfIn;
