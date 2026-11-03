// Server only. Apple Watch data arrives from the Velocity iPhone app, which reads Apple Health on the phone (Apple
// gives no website access to it). The app sends workouts and daily values in this shape, signed in as the
// athlete; the server checks every field and stores them like any other maker's. Relative imports only.
import { activityId, feetOf, localClock, paceFields, sportOfText, thinRoute, type BodyIn, type WorkoutIn } from "./import";

/** What the iPhone app sends. Times are seconds since epoch; `offset` is the phone's UTC offset in seconds. */
export interface AppleWorkoutIn {
  uuid: string; type: string; start: number; end: number; offset?: number; name?: string;
  distance_m?: number; avg_hr?: number; kcal?: number; elev_gain_m?: number; route?: [number, number][]; device?: string;
}
export interface AppleDayIn { date: string; rhr?: number; hrv?: number; sleep_h?: number; vo2?: number; weight_kg?: number }
export interface ApplePayload { workouts?: AppleWorkoutIn[]; days?: AppleDayIn[]; device?: string }

const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** HKWorkoutActivityType names (as the app sends them, e.g. "running", "cycling", "swimming") → Velocity sports. */
export const sportOfApple = (type: string) => sportOfText(type.replace(/([a-z])([A-Z])/g, "$1 $2"));

export function appleWorkout(w: AppleWorkoutIn): WorkoutIn | null {
  if (!w || typeof w.uuid !== "string" || !/^[\w-]{8,64}$/.test(w.uuid)) return null;
  const start = num(w.start, 946684800, 4102444800), end = num(w.end, 946684800, 4102444800);
  if (start == null || end == null || end <= start) return null;
  const secs = Math.min(end - start, 24 * 3600);
  const sport = sportOfApple(String(w.type ?? ""));
  const { date, start: clock } = localClock(start, num(w.offset, -50400, 50400) ?? 0);
  const distance = num(w.distance_m, 0, 1e6);
  return {
    id: activityId("ap", w.uuid), externalId: w.uuid, date, start: clock, sport, min: Math.max(1, Math.round(secs / 60)),
    name: (typeof w.name === "string" && w.name.trim() ? w.name.trim() : String(w.type ?? "Workout").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase())).slice(0, 80),
    ...paceFields(sport, distance, secs),
    hr: num(w.avg_hr, 30, 250) != null ? Math.round(w.avg_hr!) : undefined,
    elev_ft: feetOf(num(w.elev_gain_m, 0, 20000)),
    kcal: num(w.kcal, 0, 20000) != null ? Math.round(w.kcal!) : undefined,
    route: Array.isArray(w.route) ? thinRoute(w.route.filter((p) => Array.isArray(p) && p.length === 2).map((p) => [Number(p[0]), Number(p[1])] as [number, number])) : undefined,
  };
}

export function appleDay(d: AppleDayIn): BodyIn | null {
  if (!d || typeof d.date !== "string" || !DATE.test(d.date)) return null;
  const out: BodyIn = { date: d.date };
  const rhr = num(d.rhr, 25, 150), hrv = num(d.hrv, 1, 400), sleep = num(d.sleep_h, 0, 20), vo2 = num(d.vo2, 10, 100), kg = num(d.weight_kg, 20, 400);
  if (rhr != null) out.rhr = rhr;
  if (hrv != null) out.hrv = hrv;
  if (sleep != null) out.sleep_h = sleep;
  if (vo2 != null) out.vo2 = vo2;
  if (kg != null) out.weight_kg = kg;
  return Object.keys(out).length > 1 ? out : null;
}
