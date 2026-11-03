// Server only. WHOOP through its developer platform (developer.whoop.com), API v2. The athlete signs in at WHOOP
// and allows Velocity to read recovery, sleep, cycles (day strain), workouts and body measurements; WHOOP then
// sends a webhook whenever a sleep, recovery or workout is scored, and Velocity fetches that record. Nothing from
// WHOOP goes to any AI model. Relative imports only, so test scripts can load this file with plain Node.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tokens } from "./tokens";
import { activityId, feetOf, localClock, offsetSeconds, paceFields, sportOfText, type BodyIn, type WorkoutIn } from "./import";

const env = (k: string) => process.env[k] ?? "";
export const whoopConfig = () => ({
  clientId: env("WHOOP_CLIENT_ID"),
  clientSecret: env("WHOOP_CLIENT_SECRET"),
  authUrl: env("WHOOP_AUTH_URL") || "https://api.prod.whoop.com/oauth/oauth2/auth",
  tokenUrl: env("WHOOP_TOKEN_URL") || "https://api.prod.whoop.com/oauth/oauth2/token",
  api: env("WHOOP_API") || "https://api.prod.whoop.com/developer",
});
/** True when "Connect WHOOP" can connect (both values set on the server). */
export const whoopOn = () => { const c = whoopConfig(); return Boolean(c.clientId && c.clientSecret); };

export const WHOOP_SCOPES = ["offline", "read:profile", "read:body_measurement", "read:cycles", "read:recovery", "read:sleep", "read:workout"];

export class WhoopError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** WHOOP's sign-in page. `state` must be at least eight characters. */
export function whoopAuthLink(redirectUri: string, state: string) {
  const c = whoopConfig();
  const q = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: redirectUri, scope: WHOOP_SCOPES.join(" "), state });
  return `${c.authUrl}?${q}`;
}

async function tokenCall(body: Record<string, string>): Promise<Tokens & { scope: string }> {
  const c = whoopConfig();
  const res = await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }) });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = {}; }
  if (!res.ok) throw new WhoopError(res.status, String(j.error_description ?? j.error ?? text.slice(0, 200)));
  const expiresIn = Number(j.expires_in ?? 3600);
  return { a: String(j.access_token ?? ""), r: String(j.refresh_token ?? ""), e: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600), scope: String(j.scope ?? "") };
}
/** The sign-in code → tokens. */
export const whoopExchange = (code: string, redirectUri: string) => tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
/** A fresh access token; WHOOP cancels the old refresh token at once, so the new pair must be stored. */
export const whoopRefresh = (refresh: string) => tokenCall({ grant_type: "refresh_token", refresh_token: refresh, scope: "offline" });

async function api<T>(access: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${whoopConfig().api}${path}`, { ...init, headers: { Authorization: `Bearer ${access}`, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new WhoopError(res.status, text.slice(0, 200) || String(res.status));
  return (text ? JSON.parse(text) : {}) as T;
}

// ---------- records ----------
export interface WhoopWorkout {
  id: string; user_id: number; start: string; end: string; timezone_offset: string; sport_name?: string | null; sport_id?: number; score_state: string;
  score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number; kilojoule?: number; distance_meter?: number | null; altitude_gain_meter?: number | null } | null;
}
export interface WhoopSleep {
  id: string; cycle_id?: number; user_id: number; start: string; end: string; timezone_offset: string; nap: boolean; score_state: string;
  score?: { stage_summary?: { total_in_bed_time_milli?: number; total_awake_time_milli?: number; total_light_sleep_time_milli?: number; total_slow_wave_sleep_time_milli?: number; total_rem_sleep_time_milli?: number }; sleep_performance_percentage?: number | null; respiratory_rate?: number | null } | null;
}
export interface WhoopRecovery {
  cycle_id: number; sleep_id: string; user_id: number; score_state: string;
  score?: { user_calibrating?: boolean; recovery_score?: number; resting_heart_rate?: number; hrv_rmssd_milli?: number; spo2_percentage?: number | null; skin_temp_celsius?: number | null } | null;
}
export interface WhoopCycle { id: number; user_id: number; start: string; end?: string | null; timezone_offset: string; score_state: string; score?: { strain?: number; kilojoule?: number; average_heart_rate?: number; max_heart_rate?: number } | null }
interface Page<T> { records: T[]; next_token?: string | null }

export const whoopProfile = (access: string) => api<{ user_id: number; email?: string; first_name?: string; last_name?: string }>(access, "/v2/user/profile/basic");
export const whoopWorkout = (access: string, id: string) => api<WhoopWorkout>(access, `/v2/activity/workout/${encodeURIComponent(id)}`);
export const whoopSleep = (access: string, id: string) => api<WhoopSleep>(access, `/v2/activity/sleep/${encodeURIComponent(id)}`);
export const whoopRecoveryOfCycle = (access: string, cycleId: number) => api<WhoopRecovery>(access, `/v2/cycle/${cycleId}/recovery`);
export const whoopCycle = (access: string, cycleId: number) => api<WhoopCycle>(access, `/v2/cycle/${cycleId}`);
/** Ends Velocity's access at WHOOP (webhooks for this athlete stop too). */
export const whoopRevoke = (access: string) => api<void>(access, "/v2/user/access", { method: "DELETE" });

/** Every record of one kind between two instants, newest first, over as many pages as needed (at most `max`). */
export async function whoopList<T>(access: string, kind: "workout" | "sleep" | "recovery" | "cycle", start: string, end: string, max = 400): Promise<T[]> {
  const path = kind === "workout" ? "/v2/activity/workout" : kind === "sleep" ? "/v2/activity/sleep" : kind === "recovery" ? "/v2/recovery" : "/v2/cycle";
  const out: T[] = [];
  let token: string | null | undefined;
  for (let page = 0; page < 40 && out.length < max; page++) {
    const q = new URLSearchParams({ limit: "25", start, end });
    if (token) q.set("nextToken", token);
    const p = await api<Page<T>>(access, `${path}?${q}`);
    out.push(...(p.records ?? []));
    token = p.next_token;
    if (!token) break;
  }
  return out;
}

// ---------- mapping ----------
const title = (s: string) => s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function workoutToActivity(w: WhoopWorkout): WorkoutIn | null {
  if (!w?.id || !w.start || !w.end) return null;
  const startS = Date.parse(w.start) / 1000, endS = Date.parse(w.end) / 1000;
  if (!Number.isFinite(startS) || !Number.isFinite(endS)) return null;
  const secs = Math.max(60, endS - startS);
  const { date, start } = localClock(startS, offsetSeconds(w.timezone_offset));
  const sportName = w.sport_name?.trim() || "Workout";
  const sport = sportOfText(sportName);
  const s = w.score_state === "SCORED" ? w.score ?? null : null;
  return {
    id: activityId("wh", w.id), externalId: w.id, date, start, sport, name: title(sportName), min: Math.round(secs / 60),
    ...paceFields(sport, s?.distance_meter ?? undefined, secs),
    hr: s?.average_heart_rate ? Math.round(s.average_heart_rate) : undefined,
    elev_ft: feetOf(s?.altitude_gain_meter),
    kcal: s?.kilojoule ? Math.round(s.kilojoule / 4.184) : undefined,
    strain: typeof s?.strain === "number" ? Math.round(s.strain * 10) / 10 : undefined,
  };
}

/** The local calendar date a sleep belongs to: the morning it ended. */
export const sleepDate = (s: Pick<WhoopSleep, "end" | "timezone_offset">) => localClock(Date.parse(s.end) / 1000, offsetSeconds(s.timezone_offset)).date;

export function sleepToBody(s: WhoopSleep): BodyIn | null {
  if (!s?.end || s.nap || s.score_state !== "SCORED" || !s.score) return null;
  const st = s.score.stage_summary ?? {};
  const asleep = (st.total_light_sleep_time_milli ?? 0) + (st.total_slow_wave_sleep_time_milli ?? 0) + (st.total_rem_sleep_time_milli ?? 0);
  const inBed = (st.total_in_bed_time_milli ?? 0) - (st.total_awake_time_milli ?? 0);
  const ms = asleep > 0 ? asleep : inBed;
  return {
    date: sleepDate(s),
    ...(ms > 0 ? { sleep_h: ms / 3600000 } : {}),
    ...(typeof s.score.sleep_performance_percentage === "number" ? { sleep_score: s.score.sleep_performance_percentage } : {}),
  };
}

/** Recovery is scored for a sleep; its values belong to the morning that sleep ended. */
export function recoveryToBody(r: WhoopRecovery, sleep: Pick<WhoopSleep, "end" | "timezone_offset">): BodyIn | null {
  if (r?.score_state !== "SCORED" || !r.score || !sleep?.end) return null;
  const sc = r.score;
  return {
    date: sleepDate(sleep),
    ...(typeof sc.recovery_score === "number" ? { recovery: sc.recovery_score } : {}),
    ...(typeof sc.resting_heart_rate === "number" ? { rhr: sc.resting_heart_rate } : {}),
    ...(typeof sc.hrv_rmssd_milli === "number" ? { hrv: sc.hrv_rmssd_milli } : {}),
  };
}

/** Day strain belongs to the local date the cycle started (a cycle runs from one wake to the next). */
export function cycleToBody(c: WhoopCycle): BodyIn | null {
  if (c?.score_state !== "SCORED" || !c.score || typeof c.score.strain !== "number" || !c.start) return null;
  return { date: localClock(Date.parse(c.start) / 1000, offsetSeconds(c.timezone_offset)).date, strain: c.score.strain };
}

// ---------- webhooks ----------
export interface WhoopEvent { user_id: number; id: string | number; type: string; trace_id?: string }
/** X-WHOOP-Signature = base64(HMAC-SHA256(client secret, timestamp + raw body)). */
export function whoopSignatureOk(rawBody: string, signature: string | null, timestamp: string | null, secret = whoopConfig().clientSecret) {
  if (!signature || !timestamp || !secret) return false;
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60000) return false;
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
