// Turns the athlete's data (the store) into the compact context the coach reads. Built in the browser so
// unsaved moves and edits are included; sent with every question. Kept small: it is what the model is paid for.
import type { PlanStore } from "@/lib/store";
import type { CoachContext } from "./types";
import { addDays, fromYmd, today, ymd } from "@/lib/format";
import { fmtPace } from "@/lib/format";
import type { Activity } from "@/lib/data";

const r1 = (x: number) => Math.round(x * 10) / 10;

function distOf(a: Activity) {
  if (a.sport === "swim" && a.yd != null) return `${a.yd} yd`;
  if (a.mi != null) return `${a.mi.toFixed(1)} mi`;
  return undefined;
}
function paceOf(a: Activity) {
  if (a.sport === "swim" && a.p100_s != null) return `${fmtPace(a.p100_s)}/100yd`;
  if (a.sport === "run" && a.pace_s != null) return `${fmtPace(a.pace_s)}/mi`;
  if (a.sport === "bike" && a.mph != null) return `${a.mph.toFixed(1)} mph`;
  return undefined;
}
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function buildCoachContext(p: PlanStore, opts: { whole?: boolean } = {}): CoachContext {
  const t = today();
  const cur = p.hasPlan ? p.currentWeek() : undefined;
  const next = cur ? p.weeks[cur.week] : undefined; // weeks[] is 0-based; cur.week is 1-based → the next one
  const sessions = [cur, next].filter((w): w is NonNullable<typeof w> => !!w).flatMap((w) => w.sessions).map((s) => ({
    id: s.id, date: s.date, start: s.start, sport: s.sport, intensity: s.intensity, min: s.min, text: s.text, status: s.status, locked: s.locked || undefined,
    actual: s.actual ? `${s.actual.min} min${distOf(s.actual) ? ` · ${distOf(s.actual)}` : ""}${s.actual.hr ? ` · ${s.actual.hr} bpm` : ""}` : undefined,
  }));
  const since = ymd(addDays(t, -14));
  const activities = p.counted.filter((a) => a.date >= since && a.date <= ymd(t)).map((a) => ({
    date: a.date, start: a.start, sport: a.sport, name: a.name, min: a.min, dist: distOf(a), pace: paceOf(a), hr: a.hr, exertion: a.exertion, note: a.note,
  }));
  const weeks = (cur ? p.weeks.slice(Math.max(0, cur.week - 4), cur.week) : []).map((w) => {
    const st = p.weekStatus(w);
    const longest: { bike?: number; run?: number; swim?: number } = {};
    for (let i = 0; i < 7; i++) for (const a of p.activitiesOn(ymd(addDays(fromYmd(w.start), i)))) {
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
  const a = p.athlete;
  return {
    today: ymd(t), now: hm(new Date()),
    athlete: {
      name: a.firstName, units: a.units,
      race: a.hasRace ? { name: a.race.name, date: a.race.date, distance: a.race.distanceLabel, goal: a.race.goal } : null,
      lthr: a.lthr, ftp: a.ftp, zones: a.zones, availability: a.availability,
    },
    plan: cur && p.planRange ? { phase: cur.phase, week: cur.week, weeks: p.weeks.length, start: p.planRange.start, end: p.planRange.end } : null,
    sessions, activities, weeks, ...(plan_all ? { plan_all } : {}),
    body: body ? { date: body.date, rhr: body.rhr, hrv: body.hrv, sleep_h: body.sleep_h, sleep_score: body.sleep_score, vo2: body.vo2 } : null,
  };
}
