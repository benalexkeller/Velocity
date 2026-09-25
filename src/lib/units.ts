// Unit preference: the athlete's choice drives every displayed number.
// Internal storage is imperial (miles, yards, mph) because that's what the wearable pipeline writes.
import { ATHLETE } from "./config";

export type Units = "imperial" | "metric";
export const units: Units = ATHLETE.units;

export const dist = (mi: number) => (units === "metric" ? { v: mi * 1.609344, u: "km" } : { v: mi, u: "mi" });
export const fmtDist = (mi?: number, digits = 1) => (mi == null ? "—" : `${dist(mi).v.toFixed(digits)} ${dist(mi).u}`);
export const speed = (mph: number) => (units === "metric" ? { v: mph * 1.609344, u: "km/h" } : { v: mph, u: "mph" });
export const fmtSpeed = (mph?: number) => (mph == null ? "—" : `${speed(mph).v.toFixed(1)} ${speed(mph).u}`);
/** run pace in s/mi → display */
export const runPace = (sPerMi: number) => (units === "metric" ? { s: sPerMi / 1.609344, u: "/km" } : { s: sPerMi, u: "/mi" });
export const swimDist = (yd: number) => (units === "metric" ? { v: Math.round(yd * 0.9144), u: "m" } : { v: yd, u: "yd" });
export const swimPace = (sPer100yd: number) => (units === "metric" ? { s: sPer100yd / 0.9144, u: "/100 m" } : { s: sPer100yd, u: "/100 yd" });
export const elev = (ft: number) => (units === "metric" ? { v: Math.round(ft * 0.3048), u: "m" } : { v: Math.round(ft), u: "ft" });
