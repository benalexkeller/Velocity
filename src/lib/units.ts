// Unit preference: the athlete's choice (Profile → Units) drives every displayed distance, pace and speed.
// Internal storage is imperial (miles, yards, feet, mph, s/mi, s/100 yd) because that is what the wearable
// pipeline and the zone maths write. `units` is a live value: the store sets it from the signed-in athlete's
// profile, so every helper here follows the profile without each screen passing it along. Any helper also takes
// the units as a last argument for code that runs where the store is not (the server, tests).
import { ATHLETE } from "./config";

export type Units = "imperial" | "metric";
export let units: Units = ATHLETE.units;
/** Set by the store when the athlete's profile loads or their Units setting changes. */
export function setUnits(u: Units) { units = u; }

const KM = 1.609344, M_PER_YD = 0.9144, M_PER_FT = 0.3048;

export const dist = (mi: number, u: Units = units) => (u === "metric" ? { v: mi * KM, u: "km" } : { v: mi, u: "mi" });
export const fmtDist = (mi?: number, digits = 1, u: Units = units) => (mi == null ? "-" : `${dist(mi, u).v.toFixed(digits)} ${dist(mi, u).u}`);
export const speed = (mph: number, u: Units = units) => (u === "metric" ? { v: mph * KM, u: "km/h" } : { v: mph, u: "mph" });
export const fmtSpeed = (mph?: number, u: Units = units) => (mph == null ? "-" : `${speed(mph, u).v.toFixed(1)} ${speed(mph, u).u}`);
/** run pace in s/mi → display */
export const runPace = (sPerMi: number, u: Units = units) => (u === "metric" ? { s: sPerMi / KM, u: "/km" } : { s: sPerMi, u: "/mi" });
export const swimDist = (yd: number, u: Units = units) => (u === "metric" ? { v: Math.round(yd * M_PER_YD), u: "m" } : { v: yd, u: "yd" });
export const swimPace = (sPer100yd: number, u: Units = units) => (u === "metric" ? { s: sPer100yd / M_PER_YD, u: "/100 m" } : { s: sPer100yd, u: "/100 yd" });
export const elev = (ft: number, u: Units = units) => (u === "metric" ? { v: Math.round(ft * M_PER_FT), u: "m" } : { v: Math.round(ft), u: "ft" });

/** The unit words for labels: `${u.dist}` → "mi" / "km", and so on. */
export const unitWords = (u: Units = units) => u === "metric"
  ? { dist: "km", swim: "m", elev: "m", speed: "km/h", pace: "/km", swimPace: "/100 m", perDist: "per km", perSwim: "per 100 m", long: { dist: "kilometres", swim: "metres" } }
  : { dist: "mi", swim: "yd", elev: "ft", speed: "mph", pace: "/mi", swimPace: "/100 yd", perDist: "per mile", perSwim: "per 100 yd", long: { dist: "miles", swim: "yards" } };

// ---------- the other direction: what the athlete types, in their units, into storage ----------
export const toMi = (v: number, u: Units = units) => (u === "metric" ? v / KM : v);
export const toYd = (v: number, u: Units = units) => (u === "metric" ? Math.round(v / M_PER_YD) : v);
export const toMph = (v: number, u: Units = units) => (u === "metric" ? v / KM : v);
export const toFt = (v: number, u: Units = units) => (u === "metric" ? Math.round(v / M_PER_FT) : v);
export const toSecPerMi = (s: number, u: Units = units) => (u === "metric" ? s * KM : s);
export const toSecPer100yd = (s: number, u: Units = units) => (u === "metric" ? s * M_PER_YD : s);

// ---------- free text ----------
const clock = (sec: number) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const secOf = (t: string) => { const [m, s] = t.split(":"); return +m * 60 + +s; };
const num = (t: string) => parseFloat(t.replace(/,/g, ""));
const fmtNum = (v: number, digits = 1) => { const r = v.toFixed(digits).replace(/\.0+$/, ""); const n = parseFloat(r); return n >= 1000 ? n.toLocaleString("en-US") : r; };
/** A swim distance converts and rounds to a pool-friendly number: 25 up to 500, 50 beyond. */
const swimLen = (v: number, factor: number) => { const w = v * factor, step = w < 500 ? 25 : 50; return (Math.max(step, Math.round(w / step) * step)).toLocaleString("en-US"); };
/** "4 × 100 yd" is a pool set: the same count and length in the other pool (a 100 is a 100). */
const SET = "(\\d+\\s*[×x]\\s*)(\\d+)\\s*";
/** A whole number of 10 or more converts to a whole number (112 mi → 180 km); anything else keeps a decimal (26.2 mi → 42.2 km, 3 mi → 4.8 km). */
const distNum = (a: string, factor: number) => { const v = num(a) * factor; return fmtNum(v, /\./.test(a) || v < 10 ? 1 : 0); };
const RANGE = "\\s*[–-]\\s*";

/**
 * Rewrites the quantities in a sentence into the athlete's units, whichever system they were written in:
 * "8:30-9:00 /mi", "17-19 mph", "Bike 112 mi", "4 × 100 yd", "1:45 /100 yd" ↔ "5:17-5:36 /km", "27-31 km/h",
 * "Bike 180 km", "4 × 100 m", "1:55 /100 m". Plan text, coach messages and workout steps go through this, so a
 * plan built in miles reads in kilometres the moment the athlete switches, and the other way round.
 */
export function localize(text: string, u: Units = units): string {
  if (!text) return text;
  if (u === "metric") {
    return text
      .replace(new RegExp(`(\\d+:\\d{2})(?:${RANGE}(\\d+:\\d{2}))?\\s*(?:/|per )\\s*100\\s*(?:yd|yards?)\\b`, "g"), (_, a, b) => `${clock(secOf(a) / M_PER_YD)}${b ? `-${clock(secOf(b) / M_PER_YD)}` : ""} /100 m`)
      .replace(new RegExp(`(\\d+:\\d{2})(?:${RANGE}(\\d+:\\d{2}))?\\s*(?:/|per )\\s*(?:mi|mile)\\b`, "g"), (_, a, b) => `${clock(secOf(a) / KM)}${b ? `-${clock(secOf(b) / KM)}` : ""} /km`)
      .replace(new RegExp(`(\\d+(?:\\.\\d+)?)(?:${RANGE}(\\d+(?:\\.\\d+)?))?\\s*mph\\b`, "g"), (_, a, b) => `${fmtNum(num(a) * KM, 0)}${b ? `-${fmtNum(num(b) * KM, 0)}` : ""} km/h`)
      .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:mi|miles?)\b/g, (_, a) => `${distNum(a, KM)} km`)
      .replace(new RegExp(`${SET}(?:yd|yards?)\\b`, "g"), (_, set, len) => `${set}${len} m`)
      .replace(/(\d[\d,]*)\s*(?:yd|yards?)\b/g, (_, a) => `${swimLen(num(a), M_PER_YD)} m`)
      .replace(/(\d[\d,]*)\s*(?:ft|feet)\b/g, (_, a) => `${fmtNum(num(a) * M_PER_FT, 0)} m`)
      .replace(/\bper mile\b/g, "per km").replace(/\bper 100 yd\b/g, "per 100 m");
  }
  const swimmy = /swim|pool|open water|×\s*\d+\s*m\b/i.test(text);
  return text
    .replace(new RegExp(`(\\d+:\\d{2})(?:${RANGE}(\\d+:\\d{2}))?\\s*(?:/|per )\\s*100\\s*(?:m|metres?|meters?)\\b`, "g"), (_, a, b) => `${clock(secOf(a) * M_PER_YD)}${b ? `-${clock(secOf(b) * M_PER_YD)}` : ""} /100 yd`)
    .replace(new RegExp(`(\\d+:\\d{2})(?:${RANGE}(\\d+:\\d{2}))?\\s*(?:/|per )\\s*(?:km|kilomet(?:er|re)s?)\\b`, "g"), (_, a, b) => `${clock(secOf(a) * KM)}${b ? `-${clock(secOf(b) * KM)}` : ""} /mi`)
    .replace(new RegExp(`(\\d+(?:\\.\\d+)?)(?:${RANGE}(\\d+(?:\\.\\d+)?))?\\s*(?:km/h|kph)\\b`, "g"), (_, a, b) => `${fmtNum(num(a) / KM, 0)}${b ? `-${fmtNum(num(b) / KM, 0)}` : ""} mph`)
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:km|kilomet(?:er|re)s?)\b/g, (_, a) => `${distNum(a, 1 / KM)} mi`)
    .replace(new RegExp(`${SET}(?:m|metres?|meters?)\\b(?![/:])`, "g"), (m, set, len) => (swimmy ? `${set}${len} yd` : m))
    .replace(/(\d[\d,]*)\s*(?:m|metres?|meters?)\b(?![/:])/g, (m, a) => (swimmy ? `${swimLen(num(a), 1 / M_PER_YD)} yd` : m))
    .replace(/\bper km\b/g, "per mile").replace(/\bper 100 m\b/g, "per 100 yd");
}
