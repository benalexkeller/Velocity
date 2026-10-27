// Junction (junction.com, formerly Vital): the middleman that connects Garmin accounts for us. Server-side only.
// Three jobs: make a Junction user for an athlete, hand the athlete to Junction's Garmin sign-in page, and turn
// the workouts Junction sends to our webhook into Velocity activities.
import { createHmac, timingSafeEqual } from "crypto";
import type { Activity, Sport } from "@/lib/data";
import { WEARABLE_API_KEY, WEARABLE_REGION } from "./config";

const BASES: Record<string, string> = {
  "sandbox-us": "https://api.sandbox.us.junction.com",
  "sandbox-eu": "https://api.sandbox.eu.junction.com",
  us: "https://api.us.junction.com",
  eu: "https://api.eu.junction.com",
};
const base = () => BASES[WEARABLE_REGION] ?? BASES["sandbox-us"];
const headers = () => ({ Accept: "application/json", "Content-Type": "application/json", "x-vital-api-key": WEARABLE_API_KEY });

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) {
    // creating a user twice returns 400 with the existing user's id: hand it back as a normal result
    const detail = (json as { detail?: { user_id?: string } } | null)?.detail;
    if (res.status === 400 && detail?.user_id) return { user_id: detail.user_id } as T;
    throw new Error(`junction ${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  }
  return json as T;
}

/** Junction's id for this athlete; creates the user when it does not exist yet. */
export async function ensureUser(clientUserId: string, timezone?: string): Promise<string> {
  const r = await call<{ user_id: string }>("POST", "/v2/user", { client_user_id: clientUserId, ...(timezone ? { fallback_time_zone: timezone } : {}) });
  return r.user_id;
}

/** The URL of Junction's Garmin sign-in page for this athlete; valid for ten minutes. */
export async function garminLinkUrl(junctionUserId: string, redirectUrl: string): Promise<string> {
  const r = await call<{ link_web_url: string }>("POST", "/v2/link/token", { user_id: junctionUserId, provider: "garmin", redirect_url: redirectUrl, on_error: "redirect", on_close: "redirect" });
  return r.link_web_url;
}

/** Every workout Junction holds for this athlete between two dates (YYYY-MM-DD), Garmin only. */
export async function listWorkouts(junctionUserId: string, startDate: string, endDate: string): Promise<JunctionWorkout[]> {
  const r = await call<{ workouts?: JunctionWorkout[] }>("GET", `/v2/summary/workouts/${junctionUserId}?start_date=${startDate}&end_date=${endDate}&provider=garmin`);
  return r.workouts ?? [];
}

/** Google's encoded polyline → [lat, lng] points, thinned to about 120 for the route map. */
export function decodePolyline(str: string, keep = 120): [number, number][] {
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lng += d;
    }
    pts.push([lat / 1e5, lng / 1e5]);
  }
  const step = Math.max(1, Math.floor(pts.length / keep));
  return pts.filter((_, k) => k % step === 0 || k === pts.length - 1);
}

/** Removes the Garmin connection at Junction (the athlete's data in Velocity stays). */
export async function disconnectGarmin(junctionUserId: string): Promise<void> {
  await call("DELETE", `/v2/user/${junctionUserId}/garmin`);
}

/** The per-second stream of one workout (GPS, heart rate), thinned to ~120 points for the route map. */
export async function workoutRoute(workoutId: string): Promise<[number, number][] | undefined> {
  try {
    const s = await call<{ lat?: number[]; lng?: number[]; lon?: number[] }>("GET", `/v2/timeseries/workouts/${workoutId}/stream`);
    const lat = s.lat ?? [], lng = s.lng ?? s.lon ?? [];
    if (!lat.length || lat.length !== lng.length) return undefined;
    const step = Math.max(1, Math.floor(lat.length / 120));
    const pts: [number, number][] = [];
    for (let i = 0; i < lat.length; i += step) if (Number.isFinite(lat[i]) && Number.isFinite(lng[i])) pts.push([lat[i], lng[i]]);
    return pts.length > 1 ? pts : undefined;
  } catch { return undefined; }
}

// ---------- webhook signature (Svix format: svix-id, svix-timestamp, svix-signature) ----------
export function verifySignature(secret: string, rawBody: string, h: { id?: string | null; ts?: string | null; sig?: string | null }): boolean {
  if (!secret || !h.id || !h.ts || !h.sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(h.ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${h.id}.${h.ts}.${rawBody}`).digest("base64");
  return h.sig.split(" ").some((part) => {
    const [, value] = part.split(",");
    if (!value) return false;
    const a = Buffer.from(value), b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

// ---------- mapping Junction's workout summary → Velocity activity ----------
export interface JunctionWorkout {
  id: string; provider_id?: string; title?: string | null;
  sport?: { name?: string; slug?: string } | null;
  time_start: string; time_end?: string; timezone_offset?: number | null;
  moving_time?: number | null; distance?: number | null; calories?: number | null;
  average_hr?: number | null; max_hr?: number | null; average_speed?: number | null; total_elevation_gain?: number | null;
  map?: { polyline?: string | null; summary_polyline?: string | null } | null;
  source?: { slug?: string; provider?: string } | null;
}

const M_PER_MI = 1609.344, M_PER_YD = 0.9144, FT_PER_M = 3.28084;

export function sportOfSlug(slug: string | undefined, name: string | undefined): Sport {
  const s = `${slug ?? ""} ${name ?? ""}`.toLowerCase();
  if (/swim|pool|open_water|open water/.test(s)) return "swim";
  if (/bik|cycl|ride|spin|velo|mtb|gravel/.test(s)) return "bike";
  if (/run|jog|treadmill|track|trail_run/.test(s)) return "run";
  if (/strength|weight|gym|crossfit|lift|training/.test(s)) return "strength";
  if (/hik|walk|mountain/.test(s)) return "hike";
  return "other";
}

/** Local date and clock time of a workout start, using the provider's timezone offset (seconds) when given. */
function localStart(iso: string, offset?: number | null) {
  const t = new Date(iso).getTime() + (offset ?? 0) * 1000;
  const d = new Date(t);
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const start = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { date, start };
}

export function toActivity(w: JunctionWorkout): Activity | null {
  if (!w?.id || !w.time_start) return null;
  const sport = sportOfSlug(w.sport?.slug, w.sport?.name);
  const { date, start } = localStart(w.time_start, w.timezone_offset);
  const secs = w.moving_time ?? (w.time_end ? (new Date(w.time_end).getTime() - new Date(w.time_start).getTime()) / 1000 : 0);
  const min = Math.max(1, Math.round(secs / 60));
  const m = w.distance ?? null;
  const a: Activity = {
    id: `jn-${w.id}`, date, start, sport,
    name: w.title?.trim() || `${w.sport?.name ?? "Workout"}`,
    min, source: "garmin",
    hr: w.average_hr ? Math.round(w.average_hr) : undefined,
    elev_ft: w.total_elevation_gain ? Math.round(w.total_elevation_gain * FT_PER_M) : undefined,
  };
  if (m && m > 0) {
    if (sport === "swim") { a.yd = Math.round(m / M_PER_YD); if (secs > 0) a.p100_s = Math.round(secs / (a.yd / 100)); }
    else {
      a.mi = Math.round((m / M_PER_MI) * 100) / 100;
      if (secs > 0) { if (sport === "bike") a.mph = Math.round((a.mi / (secs / 3600)) * 10) / 10; else a.pace_s = Math.round(secs / a.mi); }
    }
  }
  const poly = w.map?.summary_polyline || w.map?.polyline;
  if (poly) { try { const r = decodePolyline(poly); if (r.length > 1) a.route = r; } catch { /* bad polyline: no route */ } }
  return a;
}

/** Daily figures from Junction's timeseries events: one value per local day. */
export function dailyValues(data: unknown): { date: string; value: number }[] {
  const rows = Array.isArray(data) ? data : [];
  const out = new Map<string, number[]>();
  for (const r of rows as { timestamp?: string; value?: number }[]) {
    if (!r?.timestamp || typeof r.value !== "number") continue;
    const date = r.timestamp.slice(0, 10);
    out.set(date, [...(out.get(date) ?? []), r.value]);
  }
  return [...out].map(([date, vs]) => ({ date, value: Math.round((vs.reduce((s, x) => s + x, 0) / vs.length) * 10) / 10 }));
}
