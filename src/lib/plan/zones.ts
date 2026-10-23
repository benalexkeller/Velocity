// Training zones derived from the plan builder's answers, so every athlete trains to their own
// numbers rather than the seed athlete's. Text format matches the zone table the rest of the app
// reads (imperial: min/mi, mph or W, /100 yd). Marked "provisional" until a test replaces them.
import type { Intake } from "./intake";
import type { RaceDistance } from "../athlete";
import { distanceInfo } from "../athlete";

const KM = 1.609344, YD = 0.9144;
type Zones = Record<string, Record<string, string>>;

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const paceRange = (lo: number, hi: number) => `${mmss(Math.min(lo, hi))} – ${mmss(Math.max(lo, hi))}`;
const toSec = (s: string) => { const m = s.trim().match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
const half = (x: number) => Math.round(x * 2) / 2;

/** Marathon-equivalent race pace in seconds per mile: from the goal when there is one, else from the easy pace. */
function runRacePaceSec(intake: Intake, units: "imperial" | "metric", distance: RaceDistance): number | null {
  const info = distanceInfo(distance);
  const runMi = info.dist.runMi;
  const g = intake.goal;
  if (g.kind !== "finish" && g.target_hours && runMi > 0) {
    const runH = g.splits?.run ?? g.target_hours * info.frac.run;
    if (runH > 0) return (runH * 3600) / runMi;
  }
  const easy = toSec(intake.fitness.run_pace);
  if (easy) return (units === "metric" ? easy * KM : easy) / 1.17; // easy runs ≈ 17 % slower than marathon pace
  return null;
}

export function deriveZones(intake: Intake, units: "imperial" | "metric", distance: RaceDistance): Zones | null {
  const z: Zones = {};
  const f = intake.fitness;
  // ---- run: everything hangs off marathon-equivalent race pace (sec/mi) ----
  const mp = runRacePaceSec(intake, units, distance);
  if (mp) {
    z.run = {
      "Zone 2": paceRange(mp * 1.12, mp * 1.22),
      Aerobic: paceRange(mp * 1.12, mp * 1.22),
      Endurance: paceRange(mp * 1.08, mp * 1.18),
      Tempo: paceRange(mp * 0.95, mp * 1.0),
      Intervals: paceRange(mp * 0.85, mp * 0.9),
      Strides: paceRange(mp * 0.78, mp * 0.82),
      Race: paceRange(mp - 5, mp + 5),
    };
  }
  // ---- bike: watts from FTP; else speed from the steady solo speed ----
  if (f.bike_ftp && f.bike_ftp > 50) {
    const ftp = f.bike_ftp;
    const w = (a: number, b: number) => `${Math.round(ftp * a)} – ${Math.round(ftp * b)} W`;
    const race = distance === "140.6" ? [0.68, 0.78] : distance === "70.3" ? [0.78, 0.86] : distance === "olympic" ? [0.85, 0.95] : distance === "century" || distance === "gran_fondo" ? [0.72, 0.85] : [0.9, 1.0];
    z.bike = { "Zone 2": w(0.56, 0.75), Aerobic: w(0.56, 0.75), Endurance: w(0.65, 0.8), Tempo: w(0.76, 0.9), Intervals: w(1.06, 1.2), Race: w(race[0], race[1]) };
  } else if (f.bike_speed && f.bike_speed > 5) {
    const v = units === "metric" ? f.bike_speed / KM : f.bike_speed; // mph
    const r = (a: number, b: number) => `${half(v * a)} – ${half(v * b)} mph`;
    z.bike = { "Zone 2": r(0.85, 0.95), Aerobic: r(0.85, 0.95), Endurance: r(0.9, 1.0), Tempo: r(1.02, 1.08), Intervals: r(1.1, 1.2), Race: r(0.95, 1.03) };
  }
  // ---- swim: everything off the current pace per 100 ----
  const sp = toSec(f.swim_pace_100);
  if (sp) {
    const p = units === "metric" ? sp * YD : sp; // per 100 yd
    z.swim = { Technique: paceRange(p + 10, p + 20), Aerobic: paceRange(p - 2, p + 8), "Zone 2": paceRange(p - 2, p + 8), Endurance: paceRange(p - 5, p + 5), Tempo: paceRange(p - 10, p - 4), Intervals: paceRange(p - 15, p - 9), Race: paceRange(p, p + 10) };
  }
  // ---- heart rate: Friel's run percentages of LTHR ----
  if (f.lthr && f.lthr > 90) {
    const l = f.lthr, b = (x: number) => Math.round(l * x);
    z.hr = { "Zone 1": `< ${b(0.85)}`, "Zone 2": `${b(0.85)} – ${b(0.9) - 1}`, "Zone 3": `${b(0.9)} – ${b(0.95) - 1}`, "Zone 4": `${b(0.95)} – ${b(1.0) - 1}`, "Zone 5": `≥ ${b(1.0)}` };
  }
  if (!Object.keys(z).length) return null;
  z.meta = { source: "intake", ...(f.lthr ? { lthr: String(f.lthr) } : {}), ...(f.bike_ftp ? { ftp: String(f.bike_ftp) } : {}) };
  return z;
}
