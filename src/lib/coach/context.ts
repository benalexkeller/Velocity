// Turns the athlete's data (the store) into the compact context the coach reads. Built in the browser so
// unsaved moves and edits are included; sent with every question. Kept small: it is what the model is paid for.
import type { PlanStore } from "@/lib/store";
import type { CoachContext } from "./types";
import { addDays, fromYmd, today, ymd } from "@/lib/format";
import { fmtPace } from "@/lib/format";
import type { Activity } from "@/lib/data";
import { nutritionContext } from "./nutrition-bridge";
import { fmtDist, fmtSpeed, localize, runPace, swimDist, swimPace, type Units } from "@/lib/units";
import type { Zones } from "@/lib/workout";

const r1 = (x: number) => Math.round(x * 10) / 10;

// activities go to the coach in the athlete's units, the same numbers they see on screen
function distOf(a: Activity, u: Units) {
  if (a.sport === "swim" && a.yd != null) return `${swimDist(a.yd, u).v} ${swimDist(a.yd, u).u}`;
  if (a.mi != null) return fmtDist(a.mi, 1, u);
  return undefined;
}
function paceOf(a: Activity, u: Units) {
  if (a.sport === "swim" && a.p100_s != null) return `${fmtPace(swimPace(a.p100_s, u).s)}${swimPace(a.p100_s, u).u.replace(" ", "")}`;
  if (a.sport === "run" && a.pace_s != null) return `${fmtPace(runPace(a.pace_s, u).s)}${runPace(a.pace_s, u).u}`;
  if (a.sport === "bike" && a.mph != null) return fmtSpeed(a.mph, u);
  return undefined;
}
/** The zones are stored in imperial without a unit on each range; the coach gets them in the athlete's units, labelled. */
function zonesIn(z: Zones, u: Units): Zones {
  const out: Zones = {};
  for (const [sport, zs] of Object.entries(z)) {
    if (sport === "meta" || sport === "hr") { out[sport] = zs; continue; }
    out[sport] = Object.fromEntries(Object.entries(zs).map(([k, v]) => [k, sport === "run" ? localize(`${v} /mi`, u) : sport === "swim" ? localize(`${v} /100 yd`, u) : localize(v, u)]));
  }
  return out;
}
/** Nothing that came from Google reaches an AI model (privacy policy, Data from Google): Fitbit data arrives through
 *  Google's Health API, so Fitbit workouts and the body values Fitbit set stay out of the coach's context. */
const fromGoogle = (a: { source?: string }) => a.source === "fitbit";
function withoutGoogle<T extends { date: string }>(b: T, src: Record<string, string> | undefined): T {
  if (!src) return b;
  const out = { ...b } as Record<string, unknown>;
  for (const [k, maker] of Object.entries(src)) if (maker === "fitbit" && k in out) delete out[k];
  return out as T;
}
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function buildCoachContext(p: PlanStore, opts: { whole?: boolean } = {}): CoachContext {
  const t = today(), u = p.athlete.units;
  const cur = p.hasPlan ? p.currentWeek() : undefined;
  const next = cur ? p.weeks[cur.week] : undefined; // weeks[] is 0-based; cur.week is 1-based → the next one
  const sessions = [cur, next].filter((w): w is NonNullable<typeof w> => !!w).flatMap((w) => w.sessions).map((s) => ({
    id: s.id, date: s.date, start: s.start, sport: s.sport, intensity: s.intensity, min: s.min, text: s.text, status: s.status, locked: s.locked || undefined,
    actual: s.actual && !fromGoogle(s.actual) ? `${s.actual.min} min${distOf(s.actual, u) ? `, ${distOf(s.actual, u)}` : ""}${s.actual.hr ? `, ${s.actual.hr} bpm` : ""}` : s.actual ? `${s.actual.min} min` : undefined,
  }));
  const since = ymd(addDays(t, -14));
  const activities = p.counted.filter((a) => a.date >= since && a.date <= ymd(t) && !fromGoogle(a)).map((a) => ({
    date: a.date, start: a.start, sport: a.sport, name: a.name, min: a.min, dist: distOf(a, u), pace: paceOf(a, u), hr: a.hr, exertion: a.exertion, note: a.note,
  }));
  const weeks = (cur ? p.weeks.slice(Math.max(0, cur.week - 4), cur.week) : []).map((w) => {
    const st = p.weekStatus(w);
    const longest: { bike?: number; run?: number; swim?: number } = {};
    for (let i = 0; i < 7; i++) for (const a of p.activitiesOn(ymd(addDays(fromYmd(w.start), i)))) {
      if (fromGoogle(a)) continue;
      if (a.sport === "bike" || a.sport === "run" || a.sport === "swim") longest[a.sport] = Math.max(longest[a.sport] ?? 0, a.min);
    }
    return { week: w.week, start: w.start, phase: w.phaseShort, plannedH: r1(st.plannedH), doneH: r1(st.actualH), sessions: `${st.done}/${st.total}`, longest };
  });
  // restructure mode: every remaining week, compact (today's week onward)
  const plan_all = opts.whole && cur ? p.weeks.filter((w) => w.week >= cur.week).map((w) => ({
    week: w.week, start: w.start, phase: w.phaseShort, recovery: w.recovery || undefined, race: w.race || undefined,
    sessions: w.sessions.filter((s) => s.sport !== "rest").map((s) => ({ id: s.id, date: s.date, start: s.start, sport: s.sport, intensity: s.intensity, min: s.min, text: s.text.slice(0, 80), status: s.status, locked: s.locked || undefined })),
  })) : undefined;
  const body = p.body.length ? p.body[p.body.length - 1] : null;
  const nutrition = nutritionContext();
  const a = p.athlete;
  return {
    today: ymd(t), now: hm(new Date()),
    athlete: {
      // no name or email: they can come from the athlete's Google profile, and nothing from Google goes to an AI model
      units: a.units,
      race: a.hasRace ? { name: a.race.name, date: a.race.date, distance: a.race.distanceLabel, goal: a.race.goal } : null,
      lthr: a.lthr, ftp: a.ftp, zones: zonesIn(a.zones, u), availability: a.availability,
    },
    plan: cur && p.planRange ? { phase: cur.phase, week: cur.week, weeks: p.weeks.length, start: p.planRange.start, end: p.planRange.end } : null,
    sessions, activities, weeks, ...(plan_all ? { plan_all } : {}),
    body: body ? withoutGoogle({ date: body.date, rhr: body.rhr, hrv: body.hrv, sleep_h: body.sleep_h, sleep_score: body.sleep_score, vo2: body.vo2 }, (body as { src?: Record<string, string> }).src) : null,
    // the meal library, plus food and targets for yesterday and today when this page has the nutrition data
    ...(!opts.whole ? { nutrition } : {}),
  };
}
