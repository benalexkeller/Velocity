// Server only. Garmin through Garmin's own Connect Developer Program (Health API and Activity API), for the day the
// LLC's application is approved: paste GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET and GARMIN_WEBHOOK_SECRET into Vercel
// and "Connect Garmin" switches from Junction to this. Sign-in is OAuth 2.0 with PKCE; afterwards Garmin pushes
// summaries to Velocity's endpoint the moment a watch syncs (Starter tier: push only, no history). Garmin data never
// goes to any AI model for training. Relative imports only, so test scripts can load this file with plain Node.
import { createHash, randomBytes } from "node:crypto";
import type { Tokens } from "./tokens";
import { activityId, feetOf, localClock, paceFields, sportOfText, thinRoute, type BodyIn, type WorkoutIn } from "./import";
import type { Sport } from "@/lib/data";

const env = (k: string) => process.env[k] ?? "";
export const garminConfig = () => ({
  clientId: env("GARMIN_CLIENT_ID"),
  clientSecret: env("GARMIN_CLIENT_SECRET"),
  /** part of the push address, so only Garmin (who was given the address) can post data */
  webhookSecret: env("GARMIN_WEBHOOK_SECRET"),
  authUrl: env("GARMIN_AUTH_URL") || "https://connect.garmin.com/oauth2Confirm",
  tokenUrl: env("GARMIN_TOKEN_URL") || "https://connectapi.garmin.com/di-oauth2-service/oauth/token",
  api: env("GARMIN_API") || "https://apis.garmin.com/wellness-api/rest",
  /** Enterprise tier only: Velocity may ask Garmin to send history (backfill) */
  backfill: env("GARMIN_BACKFILL") === "1",
});
/** True when "Connect Garmin" goes straight to Garmin (all three values set on the server). */
export const garminDirectOn = () => { const c = garminConfig(); return Boolean(c.clientId && c.clientSecret && c.webhookSecret); };

export class GarminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---------- sign-in (OAuth 2.0 with PKCE) ----------
export function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
export function garminAuthLink(redirectUri: string, state: string, challenge: string) {
  const c = garminConfig();
  const q = new URLSearchParams({ client_id: c.clientId, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", redirect_uri: redirectUri, state });
  return `${c.authUrl}?${q}`;
}
async function tokenCall(body: Record<string, string>): Promise<Tokens & { scope: string; refreshExpiresAt: number }> {
  const c = garminConfig();
  const res = await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...body }) });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = {}; }
  if (!res.ok) throw new GarminError(res.status, String(j.error_description ?? j.error ?? text.slice(0, 200)));
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Number(j.expires_in ?? 86400), refreshIn = Number(j.refresh_token_expires_in ?? 7776000);
  return { a: String(j.access_token ?? ""), r: String(j.refresh_token ?? ""), e: now + (Number.isFinite(expiresIn) ? expiresIn : 86400), scope: String(j.scope ?? ""), refreshExpiresAt: now + (Number.isFinite(refreshIn) ? refreshIn : 7776000) };
}
export const garminExchange = (code: string, verifier: string, redirectUri: string) => tokenCall({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: redirectUri });
/** A fresh access token; Garmin sends a new refresh token each time, which replaces the stored one. */
export const garminRefresh = (refresh: string) => tokenCall({ grant_type: "refresh_token", refresh_token: refresh });

async function api<T>(access: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${garminConfig().api}${path}`, { ...init, headers: { Authorization: `Bearer ${access}`, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  if (res.status === 204 || res.status === 202) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new GarminError(res.status, text.slice(0, 200) || String(res.status));
  return (text ? JSON.parse(text) : {}) as T;
}
/** Garmin's stable id for the athlete; pushes are matched to athletes by it. */
export const garminUserId = async (access: string) => String((await api<{ userId: string }>(access, "/user/id")).userId);
/** What the athlete allowed: ["ACTIVITY_EXPORT", "HEALTH_EXPORT", ...]. */
export const garminPermissions = (access: string) => api<string[]>(access, "/user/permissions");
/** Ends Velocity's access at Garmin (Disconnect, Delete my account). */
export const garminDeregister = (access: string) => api<void>(access, "/user/registration", { method: "DELETE" });
/** Enterprise tier: asks Garmin to push history for a window (at most 90 days per call); the data arrives later through the push endpoint. */
export async function garminBackfill(access: string, kind: "activities" | "dailies" | "sleeps" | "hrv" | "userMetrics", startSeconds: number, endSeconds: number) {
  await api<void>(access, `/backfill/${kind}?summaryStartTimeInSeconds=${Math.floor(startSeconds)}&summaryEndTimeInSeconds=${Math.floor(endSeconds)}`);
}

// ---------- what Garmin pushes ----------
export interface GarminActivity {
  userId: string; summaryId: string; activityId?: number; activityName?: string; activityType?: string; startTimeInSeconds: number; startTimeOffsetInSeconds?: number;
  durationInSeconds: number; distanceInMeters?: number; averageHeartRateInBeatsPerMinute?: number; maxHeartRateInBeatsPerMinute?: number;
  activeKilocalories?: number; totalElevationGainInMeters?: number; deviceName?: string; isParent?: boolean; parentSummaryId?: string; manual?: boolean;
}
export interface GarminActivityDetail { userId: string; summaryId: string; activityId?: number; summary: GarminActivity; samples?: { latitudeInDegree?: number; longitudeInDegree?: number }[] }
export interface GarminDaily { userId: string; summaryId: string; calendarDate: string; restingHeartRateInBeatsPerMinute?: number; averageStressLevel?: number; bodyBatteryChargedValue?: number; bodyBatteryDrainedValue?: number; steps?: number }
export interface GarminSleep { userId: string; summaryId: string; calendarDate: string; durationInSeconds?: number; deepSleepDurationInSeconds?: number; lightSleepDurationInSeconds?: number; remSleepInSeconds?: number; awakeDurationInSeconds?: number; validation?: string; overallSleepScore?: { value?: number } }
export interface GarminHrv { userId: string; summaryId: string; calendarDate: string; lastNightAvg?: number; lastNight5MinHigh?: number }
export interface GarminUserMetrics { userId: string; summaryId: string; calendarDate: string; vo2Max?: number; vo2MaxCycling?: number; fitnessAge?: number }
export interface GarminBodyComp { userId: string; summaryId: string; measurementTimeInSeconds: number; measurementTimeOffsetInSeconds?: number; weightInGrams?: number; bodyFatInPercent?: number }
export interface GarminDeregistration { userId: string }
export interface GarminPermissionsChange { userId: string; permissions?: string[] }
/** One push from Garmin: any of these lists may be present. */
export interface GarminPush {
  activities?: GarminActivity[]; manuallyUpdatedActivities?: GarminActivity[]; activityDetails?: GarminActivityDetail[];
  dailies?: GarminDaily[]; sleeps?: GarminSleep[]; hrv?: GarminHrv[]; userMetrics?: GarminUserMetrics[]; bodyComps?: GarminBodyComp[];
  deregistrations?: GarminDeregistration[]; userPermissionsChange?: GarminPermissionsChange[];
}

const TYPE_SPORT: Record<string, Sport> = {
  RUNNING: "run", INDOOR_RUNNING: "run", TREADMILL_RUNNING: "run", TRACK_RUNNING: "run", TRAIL_RUNNING: "run", VIRTUAL_RUN: "run", OBSTACLE_RUN: "run", STREET_RUNNING: "run", ULTRA_RUN: "run",
  CYCLING: "bike", INDOOR_CYCLING: "bike", ROAD_BIKING: "bike", MOUNTAIN_BIKING: "bike", GRAVEL_CYCLING: "bike", VIRTUAL_RIDE: "bike", CYCLOCROSS: "bike", TRACK_CYCLING: "bike", E_BIKE_FITNESS: "bike", BMX: "bike", RECUMBENT_CYCLING: "bike", HANDCYCLING: "bike",
  LAP_SWIMMING: "swim", OPEN_WATER_SWIMMING: "swim", SWIMMING: "swim",
  STRENGTH_TRAINING: "strength", INDOOR_CARDIO: "strength", FITNESS_EQUIPMENT: "strength", HIIT: "strength", YOGA: "strength", PILATES: "strength", ELLIPTICAL: "strength", STAIR_CLIMBING: "strength", INDOOR_ROWING: "strength", ROWING: "strength",
  HIKING: "hike", WALKING: "hike", CASUAL_WALKING: "hike", SPEED_WALKING: "hike", MOUNTAINEERING: "hike",
};
export const sportOfGarmin = (type: string | undefined, name?: string) => TYPE_SPORT[(type ?? "").toUpperCase()] ?? sportOfText(`${type ?? ""} ${name ?? ""}`);
const pretty = (type: string | undefined) => (type ?? "Activity").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function activityToWorkout(a: GarminActivity, route?: [number, number][]): WorkoutIn | null {
  if (!a?.summaryId || !a.startTimeInSeconds || !a.durationInSeconds) return null;
  // a multisport parent holds no data of its own: its legs (children) arrive as activities too
  if (a.isParent) return null;
  const { date, start } = localClock(a.startTimeInSeconds, a.startTimeOffsetInSeconds ?? 0);
  const sport = sportOfGarmin(a.activityType, a.activityName);
  return {
    id: activityId("ga", a.summaryId), externalId: a.activityId != null ? String(a.activityId) : a.summaryId, date, start, sport,
    name: a.activityName?.trim() || pretty(a.activityType), min: Math.round(a.durationInSeconds / 60),
    ...paceFields(sport, a.distanceInMeters, a.durationInSeconds),
    hr: a.averageHeartRateInBeatsPerMinute ? Math.round(a.averageHeartRateInBeatsPerMinute) : undefined,
    elev_ft: feetOf(a.totalElevationGainInMeters),
    kcal: a.activeKilocalories ? Math.round(a.activeKilocalories) : undefined,
    ...(route ? { route } : {}),
  };
}
/** The GPS track of an activity, from its detail samples. */
export const routeOfDetail = (d: GarminActivityDetail) => thinRoute((d.samples ?? []).filter((s) => typeof s.latitudeInDegree === "number" && typeof s.longitudeInDegree === "number").map((s) => [s.latitudeInDegree!, s.longitudeInDegree!] as [number, number]));

export function dailyToBody(d: GarminDaily): BodyIn | null {
  if (!d?.calendarDate) return null;
  const out: BodyIn = { date: d.calendarDate };
  if (typeof d.restingHeartRateInBeatsPerMinute === "number" && d.restingHeartRateInBeatsPerMinute > 0) out.rhr = d.restingHeartRateInBeatsPerMinute;
  if (typeof d.averageStressLevel === "number" && d.averageStressLevel >= 0) out.stress = d.averageStressLevel;
  return Object.keys(out).length > 1 ? out : null;
}
export function sleepToBody(s: GarminSleep): BodyIn | null {
  if (!s?.calendarDate) return null;
  const stages = (s.deepSleepDurationInSeconds ?? 0) + (s.lightSleepDurationInSeconds ?? 0) + (s.remSleepInSeconds ?? 0);
  const secs = stages > 0 ? stages : s.durationInSeconds ?? 0;
  const out: BodyIn = { date: s.calendarDate };
  if (secs > 0) out.sleep_h = secs / 3600;
  if (typeof s.overallSleepScore?.value === "number") out.sleep_score = s.overallSleepScore.value;
  return Object.keys(out).length > 1 ? out : null;
}
export const hrvToBody = (h: GarminHrv): BodyIn | null => (h?.calendarDate && typeof h.lastNightAvg === "number" ? { date: h.calendarDate, hrv: h.lastNightAvg } : null);
export const metricsToBody = (m: GarminUserMetrics): BodyIn | null => (m?.calendarDate && typeof m.vo2Max === "number" ? { date: m.calendarDate, vo2: m.vo2Max } : null);
export function bodyCompToBody(b: GarminBodyComp): BodyIn | null {
  if (!b?.measurementTimeInSeconds || typeof b.weightInGrams !== "number") return null;
  return { date: localClock(b.measurementTimeInSeconds, b.measurementTimeOffsetInSeconds ?? 0).date, weight_kg: b.weightInGrams / 1000 };
}
