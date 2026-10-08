// Data layer. Today: seeded from PR's real plan + activity log (JSON).
// Tomorrow: the same shapes come from Supabase — swap the loaders, keep the selectors.
import planSeed from "./seed/plan.json";
import actSeed from "./seed/actuals.json";
import { addDays, fromYmd, today, ymd } from "../format";
import { ATHLETE } from "../config";

export type Sport = "swim" | "bike" | "run" | "strength" | "rest" | "hike" | "other" | "brick";
/** planned · done (same sport, ≥ 70 % of the planned time) · partial (same sport, less) · substituted (another sport, ≥ 30 min) · missed */
export type Status = "planned" | "done" | "partial" | "substituted" | "missed";
export const STATUS_LABEL: Record<Status, string> = { planned: "Planned", done: "Completed", partial: "Partial", substituted: "Substituted", missed: "Missed" };

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  dayIndex: number; // 0 = Mon
  start?: string; // "06:30"
  min: number;
  sport: Sport;
  title: string; // "Run"
  detail: string; // "Aerobic · 50 min"
  text: string; // original plan text
  intensity: string; // "Zone 2" / "Tempo" / ...
  why: string;
  status: Status;
  locked?: boolean; // cannot be dragged or moved until unlocked
  actual?: Activity; // the activity logged for this session, when it is done
}
export interface Week {
  week: number;
  start: string;
  phase: string;
  phaseShort: string;
  focus: string;
  recovery: boolean;
  race: boolean;
  sessions: Session[];
  plannedMin: number;
}
export interface Activity {
  id: string;
  date: string;
  start?: string;
  sport: Sport;
  name: string;
  min: number;
  mi?: number;
  pace_s?: number; // s per mile (run)
  mph?: number;
  yd?: number;
  p100_s?: number;
  hr?: number;
  elev_ft?: number;
  route?: [number, number][];
  source: "garmin" | "manual";
  note?: string;
  exertion?: number;
  coachNote?: string;
  excluded?: boolean; // kept in the list, but not counted in analysis, volume or session status
}

// ---------- classification helpers ----------
export function sportOf(text: string): Sport {
  const t = text.toLowerCase();
  if (t.startsWith("rest")) return "rest";
  const sw = /\bswims?\b/.test(t), bk = /\b(bike|rides?|spin)\b/.test(t), rn = /\b(runs?|running)\b/.test(t) || /\bbrick\b/.test(t);
  if (bk && rn) return "brick";
  if (sw) return "swim";
  if (bk) return "bike";
  if (rn) return "run";
  if (/\bhik(e|es|ing)\b/.test(t)) return "hike";
  if (/\b(strength|core|mobility|bodyweight)\b/.test(t)) return "strength";
  return "other";
}
export const SPORT_LABEL: Record<Sport, string> = { swim: "Swim", bike: "Bike", run: "Run", strength: "Strength", rest: "Rest day", hike: "Hike", other: "Session", brick: "Brick" };

export function intensityOf(text: string) {
  const t = text.toLowerCase();
  if (/race sim|race day/.test(t)) return "Race";
  if (/threshold|lthr/.test(t)) return "Threshold";
  if (/\btempo\b/.test(t)) return "Tempo";
  if (/interval|hill reps|pickups/.test(t)) return "Intervals";
  if (/drill|technique/.test(t)) return "Technique";
  if (/\bez\b|easy|z2|recovery/.test(t)) return "Zone 2";
  if (/long (ride|run)/.test(t)) return "Endurance";
  return "Aerobic";
}
export function whyOf(text: string, sport: Sport) {
  const t = text.toLowerCase();
  if (sport === "rest") return "No session planned. Recovery day.";
  if (/drill|technique/.test(t)) return "Drills and relaxed swimming to improve stroke efficiency.";
  if (/strides/.test(t)) return "Easy aerobic run with short strides to keep form sharp.";
  if (/long ride/.test(t)) return "Long steady ride to build bike endurance.";
  if (/long run/.test(t)) return "Long steady run to build run endurance.";
  if (/tempo|threshold/.test(t)) return "Sustained effort just below threshold to raise your sustainable pace.";
  if (/cadence/.test(t)) return "Higher-cadence work to reduce muscular load.";
  if (/strength|core/.test(t)) return "Strength and core work to reduce injury risk.";
  return "Easy aerobic session to build endurance base.";
}
function shortPhase(p: string) {
  return p.split("—")[0].trim();
}
export interface Availability { days?: number[]; weekday_am?: string; weekday_pm?: string; weekend?: string }
export const DEFAULT_AVAILABILITY: Required<Availability> = { days: [1, 2, 3, 4, 5, 6, 0], weekday_am: "06:30", weekday_pm: "18:00", weekend: "08:00" };
function timeFor(text: string, dayIndex: number, sport: Sport, av: Availability = DEFAULT_AVAILABILITY) {
  if (sport === "rest") return undefined;
  const t = text.trim();
  if (/^AM:/i.test(t)) return av.weekday_am ?? DEFAULT_AVAILABILITY.weekday_am;
  if (/^PM:/i.test(t)) return av.weekday_pm ?? DEFAULT_AVAILABILITY.weekday_pm;
  if (dayIndex >= 5) return av.weekend ?? DEFAULT_AVAILABILITY.weekend;
  return av.weekday_am ?? DEFAULT_AVAILABILITY.weekday_am;
}
function cleanText(text: string) {
  return text.replace(/^(AM|PM):\s*/i, "");
}

// ---------- activities ----------
type SeedEntry = { sport: string; name?: string; start?: string; min: number; mi?: number; pace_s?: number; mph?: number; yd?: number; p100_s?: number; hr?: number; elev_ft?: number; route?: [number, number][]; source: string; note?: string; exertion?: number };
type SeedDay = { date: string; entries: SeedEntry[]; note?: string };

export const ACTIVITIES: Activity[] = (actSeed as SeedDay[]).flatMap((d) =>
  d.entries.map((e, i) => ({
    id: `${d.date}-${i}`,
    date: d.date,
    start: e.start || undefined,
    sport: (e.sport === "ride" ? "bike" : e.sport) as Sport,
    name: e.name ?? SPORT_LABEL[(e.sport === "ride" ? "bike" : e.sport) as Sport],
    min: e.min,
    mi: e.mi, pace_s: e.pace_s, mph: e.mph, yd: e.yd, p100_s: e.p100_s, hr: e.hr, elev_ft: e.elev_ft, route: e.route,
    source: e.source as Activity["source"],
    note: e.note,
    exertion: e.exertion,
    coachNote: i === 0 ? d.note : undefined,
  }))
).sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));

export const activitiesOn = (date: string, acts: Activity[] = ACTIVITIES) => acts.filter((a) => a.date === date);

// ---------- plan ----------
/** One plan week as stored (seed file and the plans table share this shape). */
export type PlanWeekJson = { week: number; start: string; phase: string; focus: string; recovery: boolean; race: boolean; days: { text: string; min: number }[] };
export const PLAN_SEED = planSeed as PlanWeekJson[];

/** Does this activity count for this session? Same sport; a brick takes a bike or a run. */
export const fitsSession = (sportPlanned: Sport, a: Activity) => a.sport === sportPlanned || (sportPlanned === "brick" && (a.sport === "bike" || a.sport === "run"));
/** Status of one session from the activity paired with it (if any) and the other activities logged that day. */
export function statusOf(s: { sport: Sport; min: number; date: string }, paired: Activity | undefined, othersThatDay: Activity[]): Status {
  const isPast = fromYmd(s.date) < today();
  if (s.sport === "rest") return isPast ? "done" : "planned";
  if (paired) return paired.min >= 0.7 * s.min ? "done" : "partial";
  if (othersThatDay.some((a) => a.min >= 30)) return "substituted";
  return isPast ? "missed" : "planned";
}
export function sessionStatus(sport: Sport, min: number, date: string, acts: Activity[]): Status {
  const paired = acts.filter((a) => fitsSession(sport, a)).sort((a, b) => b.min - a.min)[0];
  return statusOf({ sport, min, date }, paired, acts.filter((a) => a !== paired));
}
/** How much of a planned session a status is worth in a compliance figure. */
export const STATUS_CREDIT: Record<Status, number> = { done: 1, partial: 0.5, substituted: 0.5, missed: 0, planned: 0 };

/** Minutes of the race itself inside a race week (the "Race day" entry), so it is not counted as training. */
export const isRaceDay = (text: string) => /^race day/i.test(text.replace(/^(AM|PM):\s*/i, ""));
export const raceDayMin = (days: { text: string; min: number }[]) => days.filter((d) => isRaceDay(d.text)).reduce((s, d) => s + (d.min || 0), 0);

/** Builds the app's week objects from a stored plan; statuses come from the activities given. */
export function buildWeeks(plan: PlanWeekJson[], acts: Activity[] = [], av: Availability = DEFAULT_AVAILABILITY): Week[] {
  return plan.map((w) => {
    const startD = fromYmd(w.start);
    const sessions: Session[] = w.days.map((d, i) => {
      const date = ymd(addDays(startD, i));
      const sport = sportOf(d.text);
      const intensity = intensityOf(d.text);
      return {
        id: `w${w.week}-${i}`, date, dayIndex: i,
        start: timeFor(d.text, i, sport, av),
        min: d.min, sport,
        title: isRaceDay(d.text) ? "Race day" : SPORT_LABEL[sport],
        detail: sport === "rest" ? "No session" : `${intensity} · ${d.min} min`,
        text: cleanText(d.text), intensity, why: whyOf(d.text, sport), status: sessionStatus(sport, d.min, date, activitiesOn(date, acts)),
      };
    });
    return {
      week: w.week, start: w.start, phase: w.phase, phaseShort: shortPhase(w.phase), focus: w.focus,
      recovery: w.recovery, race: w.race, sessions,
      plannedMin: w.days.reduce((s, d) => s + (d.min || 0), 0) - (w.race ? raceDayMin(w.days) : 0),
    };
  });
}

/** No plan yet: empty weeks around today so the calendar, dashboard and analysis still have a frame. */
export function virtualWeeks(anchor: Date = today(), back = 4, forward = 8): Week[] {
  const mon = addDays(anchor, -((anchor.getDay() + 6) % 7));
  const out: Week[] = [];
  for (let i = -back; i <= forward; i++) {
    const start = addDays(mon, i * 7);
    out.push({ week: i + back + 1, start: ymd(start), phase: "No plan", phaseShort: "No plan", focus: "", recovery: false, race: false, sessions: [], plannedMin: 0 });
  }
  return out;
}

export const WEEKS: Week[] = buildWeeks(PLAN_SEED, ACTIVITIES);

export function weekOf(date: Date, weeks: Week[] = WEEKS): Week | undefined {
  return weeks.find((w) => {
    const s = fromYmd(w.start);
    return date >= s && date <= addDays(s, 6);
  });
}
export function weekByNumber(n: number) {
  return WEEKS[Math.min(Math.max(n, 1), WEEKS.length) - 1];
}
export function currentWeek(weeks: Week[] = WEEKS) {
  return weekOf(today(), weeks) ?? weeks[0];
}

// ---------- phases ----------
export interface Phase { name: string; short: string; from: number; to: number; weeks: Week[]; peakHours: number; purpose: string; goals: { n: number; title: string; desc: string }[] }
const PHASE_COPY: Record<string, { purpose: string; goals: [string, string][] }> = {
  "Base 1": { purpose: "Consistent weekly routine at easy effort.", goals: [["Routine", "Set weekly rhythm across swim, bike and run."], ["Easy volume", "Increase time at easy effort."], ["Frequency", "Hold a sustainable number of sessions per week."]] },
  "Base 2": { purpose: "Volume and session length increase.", goals: [["Duration", "Lengthen key sessions at the same effort."], ["Endurance", "Longer aerobic sessions in all three sports."], ["Recovery week", "Reduced volume to absorb the block."]] },
  "Base 3": { purpose: "Hills and tempo added. Fueling practiced on every long ride.", goals: [["Aerobic strength", "Hill and tempo sessions to raise sustainable pace."], ["Milestones", "2000 m continuous swim. Weekday long rides move indoors."], ["Retest", "Repeat the week-4 tests. Zones update."]] },
  "Build 1": { purpose: "Ironman-effort intervals and first brick sessions.", goals: [["IM effort", "Intervals at Ironman race effort."], ["Bricks", "Run immediately after the bike."], ["Block cap", "3000 m swim. Half-marathon-distance long run."]] },
  "Build 2": { purpose: "Highest-volume weeks of the plan. Race nutrition rehearsed.", goals: [["Ironman-specific", "Continuous IM-effort blocks grow week over week."], ["Fuel", "Race-nutrition rehearsal every Saturday."], ["Kit", "Full race kit and position on the long ride."]] },
  "Peak": { purpose: "Race simulation, longest run, heat preparation.", goals: [["Race simulation", "Full race-simulation session."], ["Longest run", "2:45 long run, four weeks out."], ["Heat prep", "Overdressed indoor sessions and sauna."]] },
  "Taper": { purpose: "Volume drops. Short intensity touches remain.", goals: [["Taper 1", "Volume −35%. Bike serviced. Pacing chart drafted."], ["Taper 2", "Volume −50%. Fueling and travel finalized."], ["Race week", "Fly in mid-week. Short openers. Race Saturday."]] },
  "Race Week": { purpose: "Volume drops. Short intensity touches remain.", goals: [] },
  "Base": { purpose: "Easy volume in all three sports; long sessions get longer.", goals: [] },
  "Build": { purpose: "Race-effort intervals and bricks on top of the long sessions.", goals: [] },
};
export function phasesOf(weeks: Week[]): Phase[] {
  const out: Phase[] = [];
  for (const w of weeks) {
    if (w.phaseShort === "No plan") continue;
    const short = /^race week$/i.test(w.phaseShort) ? "Taper" : w.phaseShort;
    const last = out[out.length - 1];
    if (last && last.short === short) { last.to = w.week; last.weeks.push(w); }
    else out.push({ name: w.phase, short, from: w.week, to: w.week, weeks: [w], peakHours: 0, purpose: PHASE_COPY[short]?.purpose ?? "", goals: [] });
  }
  let n = 1;
  for (const p of out) {
    p.peakHours = Math.max(...p.weeks.map((w) => w.plannedMin / 60));
    p.goals = (PHASE_COPY[p.short]?.goals ?? []).map(([title, desc]) => ({ n: n++, title, desc }));
  }
  return out;
}
export const PHASES: Phase[] = phasesOf(WEEKS);

// ---------- volume by discipline (planned hours) ----------
export function plannedByDiscipline(w: Week) {
  const o = { swim: 0, bike: 0, run: 0, other: 0 };
  for (const s of w.sessions) {
    if (w.race && /race day/i.test(s.text)) continue;
    const h = s.min / 60;
    if (s.sport === "swim") o.swim += h;
    else if (s.sport === "bike") o.bike += h;
    else if (s.sport === "run") o.run += h;
    else if (s.sport === "brick") { o.bike += h * 0.8; o.run += h * 0.2; }
    else if (s.sport !== "rest") o.other += h;
  }
  return o;
}
export function actualByDiscipline(w: Week, acts: Activity[] = ACTIVITIES) {
  const o = { swim: 0, bike: 0, run: 0, other: 0 };
  for (let i = 0; i < 7; i++) {
    for (const a of activitiesOn(ymd(addDays(fromYmd(w.start), i)), acts)) {
      const h = a.min / 60;
      if (a.sport === "swim" || a.sport === "bike" || a.sport === "run") o[a.sport] += h;
      else o.other += h;
    }
  }
  return o;
}
export const sumH = (o: { swim: number; bike: number; run: number; other: number }) => o.swim + o.bike + o.run + o.other;

// ---------- load model (earned, from work done) ----------
// Load = minutes × intensity², with intensity = average HR ÷ threshold HR (TSS-like). The planned
// factor is the square of each zone's HR midpoint over threshold, so planned and actual sit on one scale.
const INTENSITY_FACTOR: Record<string, number> = { "Zone 2": 0.76, Aerobic: 0.76, Technique: 0.65, Endurance: 0.78, Tempo: 0.85, Threshold: 0.85, Intervals: 0.94, Race: 0.85 };
export const plannedFactor = (intensity: string) => INTENSITY_FACTOR[intensity] ?? 0.76;
export function plannedLoad(s: Session) { return s.sport === "rest" ? 0 : Math.round(s.min * plannedFactor(s.intensity)); }
/** Intensity of an activity: HR ÷ LTHR when there is a heart rate, else from the athlete's 1–10 effort, else a sport default. */
export function intensityFactor(a: Activity, lthr = 155) {
  if (a.hr) return Math.min(1.5, a.hr / lthr);
  if (a.exertion) return Math.min(1.1, 0.5 + 0.05 * a.exertion);
  return a.sport === "swim" || a.sport === "bike" || a.sport === "run" || a.sport === "brick" ? 0.72 : 0.5;
}
export function activityLoad(a: Activity, lthr = 155) {
  return Math.round(a.min * intensityFactor(a, lthr) ** 2);
}
export function weekLoad(w: Week, acts: Activity[] = ACTIVITIES) {
  const planned = w.sessions.reduce((s, x) => s + plannedLoad(x), 0);
  let actual = 0;
  for (let i = 0; i < 7; i++) for (const a of activitiesOn(ymd(addDays(fromYmd(w.start), i)), acts)) actual += activityLoad(a);
  return { planned, actual };
}

// ---------- compliance ----------
export function rollingCompliance(days = 28, weeks: Week[] = WEEKS) {
  const t = today();
  let planned = 0, done = 0;
  for (const w of weeks) for (const s of w.sessions) {
    const d = fromYmd(s.date);
    if (s.sport === "rest" || d > t || d < addDays(t, -days)) continue;
    if (d.getTime() === t.getTime() && s.status === "planned") continue; // today's session is not missed yet
    planned++;
    done += STATUS_CREDIT[s.status];
  }
  return { planned, done, pct: planned ? Math.round((done / planned) * 100) : null };
}
export function weekStatus(w: Week, acts: Activity[] = ACTIVITIES) {
  const sessions = w.sessions.filter((s) => s.sport !== "rest");
  const done = sessions.filter((s) => s.status === "done").length;
  return { done, total: sessions.length, actualH: sumH(actualByDiscipline(w, acts)), plannedH: w.plannedMin / 60, load: weekLoad(w, acts) };
}

// Sunday review: facts only — last week's numbers, this week's plan.
export function sundayReview() {
  const cur = currentWeek();
  const prev = cur.week > 1 ? weekByNumber(cur.week - 1) : null;
  const parts: string[] = [];
  if (prev) {
    const st = weekStatus(prev);
    parts.push(`Last week: ${st.done}/${st.total} sessions · ${st.actualH.toFixed(1)} of ${st.plannedH.toFixed(1)} h`);
  }
  const sessions = cur.sessions.filter((x) => x.sport !== "rest");
  const key = sessions.reduce<Session | null>((m, x) => (!m || x.min > m.min ? x : m), null);
  const D = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  parts.push(`This week: ${sessions.length} sessions · ${(cur.plannedMin / 60).toFixed(1)} h${key ? ` · Key session ${D[key.dayIndex]} ${key.title} ${key.min} min` : ""}`);
  return parts.join("  ·  ");
}
export const SUNDAY_REVIEW = sundayReview();
export const RACE = ATHLETE.race;
