// Daily targets and session fuel from the athlete's body data and the day's training.
// Rules follow qa/findings/NUT.md (§C–§J): Burke 2011 / Thomas 2016 carbohydrate bands, Jeukendrup 2014 g/h
// tiers capped by what the gut absorbs, Sawka 2007 / Hew-Butler 2015 fluid, Loucks / Mountjoy energy availability.
import type { Session } from "../data";
import type { Macros, NutritionProfile } from "./types";
import type { RaceDistance } from "../athlete";

export type DayType = "rest" | "light" | "moderate" | "long" | "very long" | "load" | "race";
export interface DayTargets extends Macros {
  bmr: number;          // resting energy, kcal
  base: number;         // resting × 1.4 for a non-training day
  training: number;     // kcal estimated for the day's sessions
  goalAdj: number;      // kcal added/removed for the goal (after the guardrails)
  goalNote: string;     // why goalAdj is what it is (cap reason), for the tooltip
  fluid_ml: number;     // drinks target for the whole day, including in-session drinking
  fluidDuring_ml: number; // the part of fluid_ml that is drunk during sessions
  sodiumDuring_mg: number; // sodium to take during sessions (no daily sodium target)
  dayType: DayType;
  trainMin: number;
  carbsPerKg: number;
  /** kcal had to be raised to reach the energy-availability floor (30 kcal/kg fat-free mass). */
  eaRaised: boolean;
}
export interface TargetOpts { date?: string; raceDate?: string; raceDistance?: RaceDistance; phase?: string }

/** Mifflin–St Jeor resting energy. Unknown sex → midpoint. Needs a weight; height and age fall back to population means. */
export function bmrOf(p: NutritionProfile) {
  const w = p.weight_kg ?? 0, h = p.height_cm ?? 175;
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : 35;
  const core = 10 * w + 6.25 * h - 5 * age;
  return Math.round(p.sex === "male" ? core + 5 : p.sex === "female" ? core - 161 : core - 78);
}
/** Fat-free mass estimate (no body-fat measurement yet): men 15 %, women 23 % body fat. Shown as an estimate. */
export const ffmOf = (p: NutritionProfile) => (p.weight_kg ?? 0) * (p.sex === "female" ? 0.77 : 0.85);

type Group = "easy" | "moderate" | "hard" | "race";
const groupOf = (s: Session): Group => (s.intensity === "Race" ? "race" : /Tempo|Threshold|Intervals/.test(s.intensity) ? "hard" : s.intensity === "Endurance" ? "moderate" : "easy");

/** kcal for a session (Ainsworth 2011 METs by sport and intensity; power/HR methods arrive with the Garmin streams). */
function metOf(s: Session): number {
  const g = groupOf(s);
  switch (s.sport) {
    case "run": return g === "race" ? 11 : g === "hard" ? 11.5 : g === "moderate" ? 9.8 : 9;
    case "bike": return g === "race" ? 8.5 : g === "hard" ? 9.5 : g === "moderate" ? 8 : 7;
    case "brick": return 8.5;
    case "swim": return s.intensity === "Technique" ? 6 : g === "hard" ? 9 : g === "race" ? 9.8 : 7.5;
    case "strength": return 4.5;
    case "hike": return 6;
    case "rest": return 0;
    default: return 6;
  }
}
export function sessionKcal(s: Session, weightKg: number) { return Math.round(metOf(s) * weightKg * (s.min / 60)); }

/** Effective training hours: easy hours count 0.8, endurance 1.0, hard 1.2, technique swims 0.6, strength 0.4, hikes 0.6 (NUT §F). */
function effectiveHours(sessions: Session[]) {
  return sessions.reduce((a, s) => {
    if (s.sport === "rest") return a;
    const w = s.sport === "strength" ? 0.4 : s.sport === "hike" ? 0.6 : s.intensity === "Technique" ? 0.6 : ({ easy: 0.8, moderate: 1, hard: 1.2, race: 1.2 } as const)[groupOf(s)];
    return a + (s.min / 60) * w;
  }, 0);
}
const labelOf = (h: number): DayType => (h < 0.25 ? "rest" : h < 1.25 ? "light" : h < 2.5 ? "moderate" : h < 4 ? "long" : "very long");

const DAY = 86400000;
const daysBetween = (a: string, b: string) => Math.round((new Date(b + "T00:00").getTime() - new Date(a + "T00:00").getTime()) / DAY);
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** All weight stages in date order, with the race-day weight as the last one. */
export function stagesOf(p: NutritionProfile, raceDate?: string) {
  const out = [...p.weight_stages].filter((s) => s.date && s.weight_kg > 0);
  if (p.goal_weight_kg && raceDate && !out.some((s) => s.date === raceDate)) out.push({ date: raceDate, weight_kg: p.goal_weight_kg, label: "Race day" });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function nextStage(p: NutritionProfile, raceDate?: string) {
  const today = localYmd(new Date());
  return stagesOf(p, raceDate).find((s) => s.date > today) ?? null;
}

// ---------- race day ----------
/** During-race carbohydrate (g/h) and drinking (L/h) by event, from NUT §H, for an athlete without a recorded gut-training status. */
function raceDuring(distance: RaceDistance | undefined): { gH: number; lH: number; naH: number } {
  switch (distance) {
    case "140.6": return { gH: 70, lH: 0.6, naH: 500 }; // bike 80–90, run 60, swim 0 → about 70 over the day
    case "70.3": return { gH: 70, lH: 0.6, naH: 500 };
    case "olympic": case "sprint": return { gH: 40, lH: 0.5, naH: 0 };
    case "marathon": case "ultra": return { gH: 60, lH: 0.5, naH: 300 };
    case "half": return { gH: 30, lH: 0.4, naH: 0 };
    case "century": case "gran_fondo": return { gH: 75, lH: 0.7, naH: 600 };
    default: return { gH: 60, lH: 0.5, naH: 300 };
  }
}

/** Day targets. Returns null without a body weight: nothing is shown for a body that is not on file. */
export function targetsFor(p: NutritionProfile, sessions: Session[], raceDateOrOpts?: string | TargetOpts): DayTargets | null {
  const o: TargetOpts = typeof raceDateOrOpts === "string" ? { raceDate: raceDateOrOpts } : raceDateOrOpts ?? {};
  if (!p.weight_kg) return null;
  const w = p.weight_kg;
  const bmr = bmrOf(p);
  const base = p.base_kcal ?? Math.round(bmr * 1.4);
  const active = sessions.filter((s) => s.sport !== "rest");
  const trainMin = active.reduce((a, s) => a + s.min, 0);
  const date = o.date ?? sessions[0]?.date;
  const toRace = date && o.raceDate ? daysBetween(date, o.raceDate) : null;
  const isRaceDay = toRace === 0 || active.some((s) => s.intensity === "Race" && /^race day/i.test(s.text));
  const isLoad = toRace === 1 || toRace === 2;
  const raceWeek = toRace != null && toRace >= 0 && toRace <= 7;

  // ---- carbohydrate (g/kg) ----
  const hEff = effectiveHours(active);
  let dayType: DayType = labelOf(hEff);
  let carbsPerKg = Math.min(12, Math.max(3, 3.5 + 1.6 * hEff));
  let raceCarbs: number | null = null;
  const race = raceDuring(o.raceDistance);
  const raceMin = isRaceDay ? Math.max(trainMin, 60) : 0;
  if (isLoad) { dayType = "load"; carbsPerKg = o.raceDistance === "70.3" ? 9 : 10; }
  if (isRaceDay) {
    dayType = "race";
    // breakfast 2 g/kg 3 h out + the race itself + 1 g/kg after
    raceCarbs = Math.round(2 * w + race.gH * (raceMin / 60) + 1 * w);
    carbsPerKg = +(raceCarbs / w).toFixed(1);
  }
  carbsPerKg = Math.round(carbsPerKg * 10) / 10;

  // ---- energy ----
  const training = active.reduce((a, s) => a + sessionKcal(s, w), 0);
  let needed = 0;
  if (p.base_kcal != null) needed = 0;
  else if (p.goal === "lose") needed = -400;
  else if (p.goal === "gain") needed = 300;
  else if (p.goal === "race_weight") {
    const next = nextStage(p, o.raceDate);
    if (next) { const days = Math.max(7, daysBetween(localYmd(new Date()), next.date)); needed = Math.round(((next.weight_kg - w) * 7700) / days); }
  }
  // guardrails (NUT §J): no deficit on long, load or race days, in race week or the taper; smaller in Build/Peak; ≤ 0.5 kg/week
  let cap = dayType === "rest" || dayType === "light" ? 500 : dayType === "moderate" ? 300 : 0;
  let goalNote = "";
  const phase = o.phase ?? "";
  if (/taper|race week/i.test(phase) || raceWeek) { cap = 0; goalNote = "no deficit in the taper and race week"; }
  else if (/build|peak/i.test(phase)) { cap = dayType === "rest" || dayType === "light" ? Math.min(cap, 250) : 0; if (needed < 0) goalNote = "deficit limited to 250 kcal on light days in Build and Peak"; }
  else if (needed < -cap) goalNote = cap ? `deficit capped at ${cap} kcal on a ${dayType} day` : `no deficit on a ${dayType} day`;
  let goalAdj = needed < 0 ? Math.max(-cap, needed) : Math.min(300, needed);
  if (raceWeek && goalAdj > 0) goalAdj = 0;
  let kcal = base + training + goalAdj;
  // energy availability floor: what is left after exercise must be at least 30 kcal per kg fat-free mass
  const eeeNet = training - (bmr * trainMin) / 1440;
  const eaFloor = Math.round(30 * ffmOf(p) + eeeNet);
  let eaRaised = false;
  if (kcal < eaFloor) { kcal = eaFloor; goalAdj = kcal - base - training; eaRaised = true; goalNote = "raised to keep energy availability at 30 kcal/kg fat-free mass"; }

  // ---- macros ----
  const protein = Math.round((goalAdj < 0 ? 2.2 : /build|peak/i.test(phase) ? 1.9 : 1.7) * w);
  let carbs = raceCarbs ?? Math.round(carbsPerKg * w);
  const fatMin = Math.round(0.8 * w);
  const fatMax = Math.round((dayType === "load" || dayType === "race" ? 1.0 : 1.2) * w);
  let fat = Math.round((kcal - carbs * 4 - protein * 4) / 9);
  if (fat > fatMax) {
    // the surplus goes to carbohydrate (up to 12 g/kg); anything beyond that is not a target
    const spare = (fat - fatMax) * 9;
    fat = fatMax;
    if (raceCarbs == null) { carbs = Math.min(Math.round(12 * w), carbs + Math.round(spare / 4)); carbsPerKg = Math.round((carbs / w) * 10) / 10; }
    kcal = carbs * 4 + protein * 4 + fat * 9;
  } else if (fat < fatMin) {
    // the day's carbohydrate does not fit: on load and race days the calories rise (carb loading is a surplus by
    // design); otherwise the deficit gives way first, and only then the carbohydrate
    fat = fatMin;
    const need = carbs * 4 + protein * 4 + fat * 9;
    if (dayType === "load" || dayType === "race") kcal = need;
    else {
      if (goalAdj < 0) { const back = Math.min(-goalAdj, need - kcal); kcal += back; goalAdj += back; if (back > 0 && !goalNote) goalNote = "deficit reduced so the day's carbohydrate fits"; }
      if (kcal < need && raceCarbs == null) carbs = Math.max(Math.round(3 * w), Math.round((kcal - fat * 9 - protein * 4) / 4));
      kcal = Math.max(kcal, carbs * 4 + protein * 4 + fat * 9);
    }
    carbsPerKg = Math.round((carbs / w) * 10) / 10;
  }
  kcal = Math.round(kcal);
  const fibre = dayType === "load" || dayType === "race" ? 15 : 30;

  // ---- fluid and sodium (NUT §G): daily water plus in-session drinking capped at 0.8 L/h ----
  let fluidDuring = 0, sodiumDuring = 0;
  if (isRaceDay) { fluidDuring = race.lH * (raceMin / 60) * 1000; sodiumDuring = race.naH * (raceMin / 60); }
  else for (const s of active) { const f = sessionFuel(s, w); fluidDuring += f.fluidLh * (s.min / 60) * 1000; sodiumDuring += f.naMgH * (s.min / 60); }
  const awakeShare = isRaceDay ? Math.max(0.3, (16 - raceMin / 60) / 16) : 1;
  const fluid_ml = Math.round((35 * w * awakeShare + fluidDuring) / 50) * 50;

  return { kcal, carbs, protein, fat, fibre, sodium: Math.round(sodiumDuring / 50) * 50, bmr, base, training, goalAdj, goalNote, fluid_ml, fluidDuring_ml: Math.round(fluidDuring / 50) * 50, sodiumDuring_mg: Math.round(sodiumDuring / 50) * 50, dayType, trainMin, carbsPerKg, eaRaised };
}

// ---------- one session ----------
export type SessionClass = "micro" | "easy" | "key";
export const classOf = (s: Session): SessionClass => (s.sport === "strength" || s.intensity === "Technique" || (s.min < 45 && groupOf(s) === "easy") ? "micro" : s.min >= 90 || groupOf(s) !== "easy" ? "key" : "easy");

/** Carbohydrate per hour during a session (NUT §C): duration × intensity tier, capped by sport. Not body-mass based. */
function perHourOf(s: Session): number {
  const g = groupOf(s), m = s.min;
  const need = m < 75 ? 0 : m < 120 ? (g === "easy" ? 0 : 30) : m < 150 ? (g === "easy" ? 30 : 45) : m < 180 ? (g === "easy" ? 45 : 60) : m < 240 ? (g === "easy" ? 60 : 75) : (g === "easy" ? 75 : 90);
  const cap = s.sport === "bike" || s.sport === "brick" ? 90 : s.sport === "run" ? 60 : s.sport === "swim" ? (m >= 75 ? 30 : 0) : s.sport === "hike" ? 45 : s.sport === "strength" ? 0 : 60;
  return Math.min(need, cap);
}
const SWEAT_L_H: Partial<Record<Session["sport"], number>> = { bike: 0.8, brick: 0.9, run: 1.0, swim: 0.3, strength: 0.5, hike: 0.7 };
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
const toHm = (min: number) => `${String(Math.floor(((min % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((min % 60) + 60) % 60).padStart(2, "0")}`;

/** Fuel around one session: before (by clock and class), per hour during, fluid and sodium, after (by the gap to the next session). */
export function sessionFuel(s: Session, weightKg: number, nextGapH: number | null = null) {
  const cls = classOf(s);
  const start = s.start ?? "06:30";
  // BEFORE (NUT §D): how long between the earliest meal (05:30) and the start decides the window
  const avail = (toMin(start) - toMin("05:30")) / 60;
  const window = toMin(start) >= toMin("16:00") ? "lunch" : avail >= 3 ? "3 h" : avail >= 1.5 ? "1.5 h" : avail >= 0.75 ? "45 min" : "dawn";
  const gkg = cls === "micro" ? 0 : window === "lunch" ? (cls === "key" ? 2 : 1) : window === "3 h" ? (cls === "key" ? 2 : 1) : window === "1.5 h" ? (cls === "key" ? 1 : 0.5) : window === "45 min" ? (cls === "key" ? 0.4 : 0.3) : cls === "key" ? 0.5 : 0;
  const before = s.sport === "rest" ? 0 : Math.round(gkg * weightKg);
  const beforeAt = window === "lunch" ? "12:30" : window === "3 h" ? toHm(toMin(start) - 180) : window === "1.5 h" ? toHm(toMin(start) - 90) : window === "45 min" ? toHm(toMin(start) - 45) : toHm(toMin(start) - 45);
  // DURING (NUT §C, §G)
  const perHour = perHourOf(s);
  const during = Math.round((perHour * s.min) / 60);
  const form = perHour === 0 ? "" : perHour <= 60 ? "any single sugar (maltodextrin, glucose)" : "glucose:fructose 2:1";
  const sweat = SWEAT_L_H[s.sport] ?? 0.6;
  const fluidLh = s.min < 45 || s.sport === "swim" ? 0 : Math.round(Math.min(0.8, Math.max(0.3, 0.7 * sweat)) * 10) / 10;
  const naMgH = s.min > 90 ? Math.round((sweat * 900 * 0.7) / 50) * 50 : 0;
  // AFTER (NUT §E)
  const skipCarbs = cls === "micro" || (cls === "easy" && s.min < 60);
  const gap = nextGapH ?? 24.5;
  const after = s.sport === "rest" ? { carbs: 0, protein: 0 } : { carbs: skipCarbs ? 0 : gap < 8 ? Math.round(1.2 * weightKg) : gap <= 24 ? Math.round(1.0 * weightKg) : 0, protein: Math.round(0.3 * weightKg) };
  const afterWindow = skipCarbs ? "next meal" : gap < 8 ? "within 30 min, then hourly" : gap <= 24 ? "within 2 h" : "next meal";
  return { cls, before, beforeAt, perHour, during, form, fluidLh, naMgH, after, window: afterWindow };
}

/** Average daily balance (intake − target) over the last n logged days → projected weight change per week. */
export function projectWeight(balances: number[]) {
  if (!balances.length) return null;
  const avg = balances.reduce((a, b) => a + b, 0) / balances.length;
  return { avgBalance: Math.round(avg), kgPerWeek: +((avg * 7) / 7700).toFixed(2) };
}
