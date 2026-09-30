// Daily targets from the athlete's body data and the day's training. Sports-nutrition standard ranges
// (ACSM / IOC / ISSN position stands); the formulas are documented inline so the Guide tab can show them.
import type { Session } from "../data";
import type { Macros, NutritionProfile } from "./types";

export interface DayTargets extends Macros {
  bmr: number;          // resting energy, kcal
  base: number;         // resting × 1.4 for a non-training day
  training: number;     // kcal estimated for the day's sessions
  goalAdj: number;      // kcal added/removed for the goal
  fluid_ml: number;     // hydration target
  dayType: "rest" | "light" | "moderate" | "long" | "race";
  trainMin: number;
  carbsPerKg: number;
}

const DEFAULT_WEIGHT = 75, DEFAULT_HEIGHT = 178, DEFAULT_AGE = 32;

/** Mifflin–St Jeor resting energy. Unknown sex → midpoint. */
export function bmrOf(p: NutritionProfile) {
  const w = p.weight_kg ?? DEFAULT_WEIGHT, h = p.height_cm ?? DEFAULT_HEIGHT;
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : DEFAULT_AGE;
  const core = 10 * w + 6.25 * h - 5 * age;
  return Math.round(p.sex === "male" ? core + 5 : p.sex === "female" ? core - 161 : core - 78);
}

/** kcal per minute per kg for a session, from MET tables (Ainsworth compendium, rounded for training zones). */
function metOf(s: Session): number {
  const hard = /Tempo|Intervals|Race/.test(s.intensity);
  switch (s.sport) {
    case "run": return hard ? 11.5 : 9.5;
    case "bike": return hard ? 9.5 : 7;
    case "brick": return 9;
    case "swim": return hard ? 9.5 : 7.5;
    case "strength": return 4.5;
    case "hike": return 6;
    case "rest": return 0;
    default: return 6;
  }
}
export function sessionKcal(s: Session, weightKg: number) { return Math.round(metOf(s) * weightKg * (s.min / 60)); }

export function dayTypeOf(sessions: Session[]): DayTargets["dayType"] {
  const active = sessions.filter((s) => s.sport !== "rest");
  const min = active.reduce((a, s) => a + s.min, 0);
  if (active.some((s) => s.intensity === "Race" && s.min > 300)) return "race";
  if (min === 0) return "rest";
  if (min < 75) return "light";
  if (min <= 150) return "moderate";
  return "long";
}
const CARBS_G_PER_KG: Record<DayTargets["dayType"], number> = { rest: 3.5, light: 5, moderate: 6, long: 8, race: 10 };

/** All weight stages in date order, with the race-day weight as the last one. */
export function stagesOf(p: NutritionProfile, raceDate?: string) {
  const out = [...p.weight_stages].filter((s) => s.date && s.weight_kg > 0);
  if (p.goal_weight_kg && raceDate && !out.some((s) => s.date === raceDate)) out.push({ date: raceDate, weight_kg: p.goal_weight_kg, label: "Race day" });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function nextStage(p: NutritionProfile, raceDate?: string) {
  const today = new Date().toISOString().slice(0, 10);
  return stagesOf(p, raceDate).find((s) => s.date > today) ?? null;
}

export function targetsFor(p: NutritionProfile, sessions: Session[], raceDate?: string): DayTargets {
  const w = p.weight_kg ?? DEFAULT_WEIGHT;
  const bmr = bmrOf(p);
  // the athlete can pin their own rest-day calories; then the formula and the goal adjustment step aside
  const base = p.base_kcal ?? Math.round(bmr * 1.4);
  const training = sessions.reduce((a, s) => a + sessionKcal(s, w), 0);
  const trainMin = sessions.filter((s) => s.sport !== "rest").reduce((a, s) => a + s.min, 0);
  // goal: steady 400 kcal/day either way; target weight = the deficit needed to get there by race day, capped at 500
  let goalAdj = 0;
  if (p.base_kcal != null) goalAdj = 0;
  else if (p.goal === "lose") goalAdj = -400;
  else if (p.goal === "gain") goalAdj = 300;
  else if (p.goal === "race_weight") {
    // aim at the next stage on the way (or race day); the deficit/surplus is spread evenly until that date
    const next = nextStage(p, raceDate);
    if (next) { const days = Math.max(7, (new Date(next.date).getTime() - Date.now()) / 86400000); goalAdj = Math.max(-500, Math.min(300, Math.round(((next.weight_kg - w) * 7700) / days))); }
  }
  const kcal = Math.max(1200, base + training + goalAdj);
  const dayType = dayTypeOf(sessions);
  const carbsPerKg = CARBS_G_PER_KG[dayType];
  let carbs = Math.round(carbsPerKg * w);
  const protein = Math.round(1.7 * w);
  // fat = what is left, never under 0.8 g/kg; if that leaves no room, carbs give way
  let fat = Math.round((kcal - carbs * 4 - protein * 4) / 9);
  const fatMin = Math.round(0.8 * w);
  if (fat < fatMin) { fat = fatMin; carbs = Math.max(Math.round(3 * w), Math.round((kcal - fat * 9 - protein * 4) / 4)); }
  const fibre = 30;
  const sodium = 2300 + Math.round(trainMin / 60) * 500;
  const fluid_ml = Math.round((35 * w + (trainMin / 60) * 500) / 50) * 50;
  return { kcal, carbs, protein, fat, fibre, sodium, bmr, base, training, goalAdj, fluid_ml, dayType, trainMin, carbsPerKg };
}

/** Fuel around one session: carbs before, per hour during, carbs + protein after. */
export function sessionFuel(s: Session, weightKg: number) {
  const hard = /Tempo|Intervals|Race/.test(s.intensity);
  const long = s.min >= 90;
  const before = s.sport === "rest" ? 0 : Math.round((long || hard ? 1 : 0.5) * weightKg);
  const perHour = s.min < 60 ? 0 : s.min <= 150 ? (hard ? 60 : 45) : s.min <= 240 ? 75 : 90;
  const during = Math.round((perHour * s.min) / 60);
  const after = s.sport === "rest" ? { carbs: 0, protein: 0 } : (s.min >= 60 || hard) ? { carbs: Math.round(1.1 * weightKg), protein: Math.round(0.3 * weightKg) } : { carbs: 0, protein: Math.round(0.3 * weightKg) };
  return { before, perHour, during, after, window: s.min >= 60 || hard ? "within 60 min" : "next meal" };
}

/** Average daily balance (intake − target) over the last n logged days → projected weight change per week. */
export function projectWeight(balances: number[]) {
  if (!balances.length) return null;
  const avg = balances.reduce((a, b) => a + b, 0) / balances.length;
  return { avgBalance: Math.round(avg), kgPerWeek: +((avg * 7) / 7700).toFixed(2) };
}
