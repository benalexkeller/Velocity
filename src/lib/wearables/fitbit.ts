// Server only. Fitbit through the Google Health API (health.googleapis.com, v4). Google retired the Fitbit Web API
// on 2 November 2026; Fitbit and Pixel Watch data now come through this API, with the athlete's Google Account.
// The athlete signs in at Google and allows Velocity to read activity, sleep and health metrics; Google then posts
// a notification whenever a data type changes (webhooks), and Velocity fetches that range. Nothing from here goes
// to any AI model.
//
// Set-up (PR, once): a Google Cloud project of its own (not the calendar one: these are restricted scopes and would
// put the approved calendar consent screen back into review), the "Google Health API" enabled, a Web OAuth client
// whose redirect URI is https://velocityathletes.com/api/connect/fitbit/callback, test users while unverified
// (100 users cap until Google's security review). Keys in Vercel: GOOGLE_HEALTH_CLIENT_ID, GOOGLE_HEALTH_CLIENT_SECRET,
// GOOGLE_HEALTH_PROJECT_NUMBER (the project *number*), GOOGLE_HEALTH_WEBHOOK_SECRET (any long random string).
// Athletes must have the Google Health app set up with that Google Account, else the identity call says
// ACCOUNT_NOT_LINKED. Refresh tokens last 7 days while the OAuth client is in "Testing"; publish it before launch.
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, after, type NextRequest } from "next/server";
import { env, makerFetch, rowsFor, secondsOf, tokenPost, MakerError, type ConnRow, type DirectProvider, type Init } from "./direct";
import { activityId, deleteWorkout, feetOf, localClock, markConnection, paceFields, saveBodyDays, saveWorkouts, sportOfText, type BodyIn, type WorkoutIn } from "./import";
import { AccessLost, freshToken } from "./tokens";

export const fitbitConfig = () => ({
  clientId: env("GOOGLE_HEALTH_CLIENT_ID"),
  clientSecret: env("GOOGLE_HEALTH_CLIENT_SECRET"),
  projectNumber: env("GOOGLE_HEALTH_PROJECT_NUMBER"),
  webhookSecret: env("GOOGLE_HEALTH_WEBHOOK_SECRET"),
  authUrl: env("GOOGLE_HEALTH_AUTH_URL") || "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: env("GOOGLE_HEALTH_TOKEN_URL") || "https://oauth2.googleapis.com/token",
  revokeUrl: env("GOOGLE_HEALTH_REVOKE_URL") || "https://oauth2.googleapis.com/revoke",
  api: env("GOOGLE_HEALTH_API") || "https://health.googleapis.com/v4",
});
export const fitbitOn = () => { const c = fitbitConfig(); return Boolean(c.clientId && c.clientSecret); };

export const FITBIT_SCOPES = [
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
];

/** The data types Velocity reads, and the webhook subscriptions it asks for. */
export const FITBIT_TYPES = ["exercise", "sleep", "daily-resting-heart-rate", "daily-heart-rate-variability", "daily-vo2-max", "weight"] as const;
type FitbitType = (typeof FITBIT_TYPES)[number];

// ---------- OAuth ----------
export function fitbitAuthLink(redirectUri: string, state: string, challenge?: string) {
  const c = fitbitConfig();
  const q = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", scope: FITBIT_SCOPES.join(" "), state, access_type: "offline", prompt: "consent", include_granted_scopes: "true" });
  if (challenge) { q.set("code_challenge", challenge); q.set("code_challenge_method", "S256"); }
  return `${c.authUrl}?${q}`;
}
export async function fitbitExchange(code: string, redirectUri: string, verifier?: string) {
  const c = fitbitConfig();
  return tokenPost("fitbit", c.tokenUrl, { client_id: c.clientId, client_secret: c.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri, ...(verifier ? { code_verifier: verifier } : {}) });
}
/** Google hands out a new access token and keeps the refresh token (no rotation). */
export async function fitbitRefresh(refresh: string) {
  const c = fitbitConfig();
  const t = await tokenPost("fitbit", c.tokenUrl, { client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token", refresh_token: refresh });
  return { a: t.a, r: t.r || refresh, e: t.e };
}
/** Ends Velocity's access at Google (either token works; the refresh token ends everything). */
export async function fitbitRevoke(token: string) {
  const c = fitbitConfig();
  await fetch(`${c.revokeUrl}?${new URLSearchParams({ token })}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15000) });
}

// ---------- API ----------
const api = <T,>(access: string, path: string, init?: Init) => makerFetch<T>("fitbit", `${fitbitConfig().api}${path}`, access, init);

export interface FitbitIdentity { name?: string; legacyUserId?: string; healthUserId?: string }
/** The athlete's Google Health id. 400 ACCOUNT_NOT_LINKED: the Google Health app is not set up with this account. */
export async function fitbitIdentity(access: string): Promise<FitbitIdentity> {
  try { return await api<FitbitIdentity>(access, "/users/me/identity"); }
  catch (e) {
    if (e instanceof MakerError && e.status === 400 && /ACCOUNT_NOT_LINKED/i.test(e.message)) throw new MakerError("fitbit", 400, "This Google Account has no Google Health profile yet. Open the Google Health app, sign in with it, then connect again.");
    throw e;
  }
}
export interface PairedDevice { name?: string; displayName?: string; deviceType?: string; model?: string; lastSyncTime?: string }
export const fitbitDevices = (access: string) => api<{ pairedDevices?: PairedDevice[] }>(access, "/users/me/pairedDevices").then((r) => r.pairedDevices ?? []).catch(() => [] as PairedDevice[]);

// data points
interface GDate { year?: number; month?: number; day?: number }
interface GTime { hours?: number; minutes?: number; seconds?: number }
interface Civil { date?: GDate; time?: GTime }
export interface Interval { startTime?: string; endTime?: string; startUtcOffset?: string; endUtcOffset?: string; civilStartTime?: Civil; civilEndTime?: Civil }
export interface DataPoint {
  name?: string;
  dataSource?: { device?: { displayName?: string; model?: string }; platform?: string; recordingMethod?: string; application?: { packageName?: string } };
  exercise?: { interval?: Interval; exerciseType?: string; displayName?: string; activeDuration?: string; metricsSummary?: { distanceMillimeters?: string | number; caloriesKcal?: number | string; steps?: string | number; averageHeartRateBeatsPerMinute?: number | string; elevationGainMillimeters?: string | number; averageSpeedMillimetersPerSecond?: string | number; averagePaceSecondsPerMeter?: number | string }; exerciseMetadata?: { hasGps?: boolean } };
  sleep?: { interval?: Interval; type?: string; summary?: { minutesAsleep?: string | number; minutesAwake?: string | number; minutesInSleepPeriod?: string | number }; metadata?: { stagesState?: string; isMainSleep?: boolean } };
  dailyRestingHeartRate?: { date?: GDate; beatsPerMinute?: string | number };
  dailyHeartRateVariability?: { date?: GDate; averageHeartRateVariabilityMilliseconds?: number; deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds?: number };
  dailyVo2Max?: { date?: GDate; vo2Max?: number; estimated?: boolean };
  weight?: { sampleTime?: { physicalTime?: string; civilTime?: Civil }; weightQuantity?: { value?: number; unit?: string }; kilograms?: number; weightKilograms?: number; grams?: number | string };
}
interface Page { dataPoints?: DataPoint[]; nextPageToken?: string }

/** Every data point of one type that matches `filter`, newest first, over as many pages as needed (at most `max`). */
export async function fitbitList(access: string, type: FitbitType, filter: string, max = 400): Promise<DataPoint[]> {
  const out: DataPoint[] = [];
  let token: string | undefined;
  const path = type === "sleep" ? `/users/me/dataTypes/sleep/dataPoints:reconcile` : `/users/me/dataTypes/${type}/dataPoints`;
  for (let page = 0; page < 40 && out.length < max; page++) {
    const q = new URLSearchParams({ filter });
    if (type === "sleep") q.set("dataSourceFamily", "users/me/dataSourceFamilies/google-wearables");
    else q.set("pageSize", type === "exercise" ? "25" : "1000");
    if (token) q.set("pageToken", token);
    const p = await api<Page>(access, `${path}?${q}`);
    out.push(...(p.dataPoints ?? []));
    token = p.nextPageToken || undefined;
    if (!token) break;
  }
  return out;
}
export const fitbitGet = (access: string, type: FitbitType, id: string) => api<DataPoint>(access, `/users/me/dataTypes/${type}/dataPoints/${encodeURIComponent(id)}`);

/** The filter for a type over a date range (civil dates, YYYY-MM-DD); daily types filter on their date. */
export function fitbitFilter(type: FitbitType, from: string, to: string): string {
  if (type === "exercise") return `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${to}"`;
  if (type === "sleep") return `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${to}"`;
  if (type === "weight") return `weight.sample_time.civil_time >= "${from}" AND weight.sample_time.civil_time < "${to}"`;
  const field = type.replace(/-/g, "_"); // daily-resting-heart-rate → daily_resting_heart_rate
  return `${field}.date >= "${from}" AND ${field}.date < "${to}"`;
}

// ---------- mapping ----------
const two = (n: number) => String(n).padStart(2, "0");
const dateOf = (d: GDate | undefined) => (d?.year && d.month && d.day ? `${d.year}-${two(d.month)}-${two(d.day)}` : null);
const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : undefined; };
const lastSeg = (name: string | undefined) => (name ?? "").split("/").pop() ?? "";
/** Local date and clock of an interval's start: the civil time when Google gives it, else start + offset. */
function clockOf(iv: Interval | undefined, which: "start" | "end") {
  const civil = which === "start" ? iv?.civilStartTime : iv?.civilEndTime;
  const d = dateOf(civil?.date);
  if (d) return { date: d, start: `${two(civil?.time?.hours ?? 0)}:${two(civil?.time?.minutes ?? 0)}` };
  const t = which === "start" ? iv?.startTime : iv?.endTime, off = which === "start" ? iv?.startUtcOffset : iv?.endUtcOffset;
  if (!t) return null;
  const epoch = Date.parse(t) / 1000;
  if (!Number.isFinite(epoch)) return null;
  return localClock(epoch, secondsOf(off ?? "0s"));
}
const title = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function exerciseToWorkout(dp: DataPoint): WorkoutIn | null {
  const ex = dp.exercise, iv = ex?.interval;
  if (!ex || !iv?.startTime || !iv.endTime) return null;
  const startS = Date.parse(iv.startTime) / 1000, endS = Date.parse(iv.endTime) / 1000;
  if (!Number.isFinite(startS) || !Number.isFinite(endS)) return null;
  const active = secondsOf(ex.activeDuration) || endS - startS;
  const secs = Math.max(60, active);
  const when = clockOf(iv, "start"); if (!when) return null;
  const type = ex.exerciseType ?? "";
  const sport = sportOfText(`${type} ${ex.displayName ?? ""}`);
  const m = ex.metricsSummary ?? {};
  const metres = num(m.distanceMillimeters) != null ? num(m.distanceMillimeters)! / 1000 : undefined;
  return {
    id: activityId("fb", lastSeg(dp.name)), externalId: lastSeg(dp.name), date: when.date, start: when.start, sport,
    name: ex.displayName?.trim() || (type ? title(type) : "Workout"), min: Math.round(secs / 60),
    ...paceFields(sport, metres, secs),
    hr: num(m.averageHeartRateBeatsPerMinute) ? Math.round(num(m.averageHeartRateBeatsPerMinute)!) : undefined,
    elev_ft: feetOf(num(m.elevationGainMillimeters) != null ? num(m.elevationGainMillimeters)! / 1000 : undefined),
    kcal: num(m.caloriesKcal) ? Math.round(num(m.caloriesKcal)!) : undefined,
  };
}

/** A night's sleep belongs to the morning it ended; naps (under 3 h, or marked as such) are skipped. */
export function sleepToBody(dp: DataPoint): BodyIn | null {
  const s = dp.sleep; if (!s?.interval) return null;
  const mins = num(s.summary?.minutesAsleep);
  const startS = Date.parse(s.interval.startTime ?? ""), endS = Date.parse(s.interval.endTime ?? "");
  const hours = Number.isFinite(startS) && Number.isFinite(endS) ? (endS - startS) / 3600000 : 0;
  if (s.metadata?.isMainSleep === false || /NAP/i.test(s.metadata?.stagesState ?? "") || (hours > 0 && hours < 3)) return null;
  const when = clockOf(s.interval, "end"); if (!when) return null;
  if (mins == null || mins <= 0) return null;
  return { date: when.date, sleep_h: Math.round((mins / 60) * 100) / 100 };
}
export function rhrToBody(dp: DataPoint): BodyIn | null {
  const d = dateOf(dp.dailyRestingHeartRate?.date), v = num(dp.dailyRestingHeartRate?.beatsPerMinute);
  return d && v ? { date: d, rhr: Math.round(v) } : null;
}
export function hrvToBody(dp: DataPoint): BodyIn | null {
  const h = dp.dailyHeartRateVariability, d = dateOf(h?.date);
  const v = num(h?.averageHeartRateVariabilityMilliseconds) ?? num(h?.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds);
  return d && v ? { date: d, hrv: Math.round(v * 10) / 10 } : null;
}
export function vo2ToBody(dp: DataPoint): BodyIn | null {
  const d = dateOf(dp.dailyVo2Max?.date), v = num(dp.dailyVo2Max?.vo2Max);
  return d && v ? { date: d, vo2: Math.round(v * 10) / 10 } : null;
}
/** Weight in kilograms, whichever of the documented shapes Google used for the point. */
export function weightToBody(dp: DataPoint): BodyIn | null {
  const w = dp.weight; if (!w) return null;
  const civil = dateOf(w.sampleTime?.civilTime?.date);
  const d = civil ?? (w.sampleTime?.physicalTime ? localClock(Date.parse(w.sampleTime.physicalTime) / 1000, 0).date : null);
  let kg = num(w.kilograms) ?? num(w.weightKilograms);
  if (kg == null && num(w.grams) != null) kg = num(w.grams)! / 1000;
  if (kg == null && w.weightQuantity) {
    const v = num(w.weightQuantity.value), unit = (w.weightQuantity.unit ?? "").toUpperCase();
    if (v != null) kg = /^(LB|POUND)/.test(unit) ? v * 0.45359237 : /^(GRAM|G)$/.test(unit) ? v / 1000 : v; // KILOGRAM, KG or unset: kilograms
  }
  return d && kg && kg > 20 && kg < 400 ? { date: d, weight_kg: Math.round(kg * 10) / 10 } : null;
}
export const bodyOf = (type: FitbitType, dp: DataPoint): BodyIn | null =>
  type === "sleep" ? sleepToBody(dp) : type === "daily-resting-heart-rate" ? rhrToBody(dp) : type === "daily-heart-rate-variability" ? hrvToBody(dp) : type === "daily-vo2-max" ? vo2ToBody(dp) : type === "weight" ? weightToBody(dp) : null;

// ---------- sync ----------
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export async function fitbitToken(sb: SupabaseClient, row: ConnRow) {
  try { return await freshToken(sb, row, fitbitRefresh); }
  catch (e) {
    if (fitbit.accessLost(e)) throw new AccessLost("fitbit", "Google removed Velocity's access to your Fitbit data. Connect again.");
    throw e;
  }
}

/** Pulls one type over a date range into the athlete's account. Returns the counts. */
export async function fitbitPull(sb: SupabaseClient, uid: string, access: string, type: FitbitType, from: string, to: string) {
  const points = await fitbitList(access, type, fitbitFilter(type, from, to));
  if (type === "exercise") {
    const acts = points.map(exerciseToWorkout).filter((a): a is WorkoutIn => !!a);
    return { workouts: await saveWorkouts(sb, uid, "fitbit", acts), bodyDays: 0 };
  }
  const body = points.map((p) => bodyOf(type, p)).filter((b): b is BodyIn => !!b);
  return { workouts: 0, bodyDays: await saveBodyDays(sb, uid, "fitbit", body) };
}

export async function fitbitSyncHistory(sb: SupabaseClient, uid: string, row: ConnRow, days: number) {
  const access = await fitbitToken(sb, row);
  const end = new Date(Date.now() + 86400000), start = new Date(Date.now() - days * 86400000);
  let workouts = 0, bodyDays = 0;
  for (const type of FITBIT_TYPES) {
    try { const r = await fitbitPull(sb, uid, access, type, ymd(start), ymd(end)); workouts += r.workouts; bodyDays += r.bodyDays; }
    catch (e) { if (e instanceof MakerError && e.status === 403) continue; throw e; } // a scope the athlete did not grant
  }
  const now = new Date().toISOString();
  await markConnection(sb, uid, "fitbit", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts, bodyDays, since: ymd(start) };
}

// ---------- webhooks ----------
/** One notification (Google batches up to 99 in one POST, possibly across athletes). */
export interface FitbitNotification {
  data?: { version?: string; clientProvidedSubscriptionName?: string; healthUserId?: string; dataType?: string; operation?: "UPSERT" | "DELETE" | string; recordId?: string;
    intervals?: { civilDateTimeInterval?: { start?: string; end?: string }; civilIso8601TimeInterval?: { start?: string; end?: string }; physicalTimeInterval?: { start?: string; end?: string } }[] };
}
/** The shared secret Google sends in the Authorization header of every webhook call. */
export function fitbitWebhookOk(authorization: string | null, secret = fitbitConfig().webhookSecret) {
  if (!authorization || !secret) return false;
  const a = Buffer.from(authorization.replace(/^Bearer\s+/i, "")), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** The civil date range a notification covers, widened by a day each side (sleep and daily values straddle midnight). */
export function notificationRange(n: FitbitNotification): { from: string; to: string } {
  const civil = (n.data?.intervals ?? []).flatMap((i) => [i.civilDateTimeInterval?.start, i.civilDateTimeInterval?.end, i.civilIso8601TimeInterval?.start, i.civilIso8601TimeInterval?.end]).filter((x): x is string => !!x).map((x) => x.slice(0, 10)).sort();
  const today = ymd(new Date());
  const lo = civil[0] ?? today, hi = civil[civil.length - 1] ?? today;
  const shift = (d: string, k: number) => ymd(new Date(Date.parse(d) + k * 86400000));
  return { from: shift(lo, -1), to: shift(hi, 2) };
}
export async function fitbitHandleNotification(sb: SupabaseClient, uid: string, row: ConnRow, n: FitbitNotification): Promise<string> {
  const type = n.data?.dataType as FitbitType | undefined;
  if (!type || !(FITBIT_TYPES as readonly string[]).includes(type)) return `ignored ${n.data?.dataType ?? "?"}`;
  if (n.data?.operation === "DELETE") {
    if (type === "exercise" && n.data.recordId) { await deleteWorkout(sb, uid, activityId("fb", lastSeg(n.data.recordId))); return "workout deleted"; }
    return "delete ignored (values stay)";
  }
  const access = await fitbitToken(sb, row);
  const { from, to } = notificationRange(n);
  const r = await fitbitPull(sb, uid, access, type, from, to);
  const now = new Date().toISOString();
  await markConnection(sb, uid, "fitbit", "direct", { last_event_at: now, status: "connected", error: null });
  return `${type} ${from}..${to}: ${r.workouts} workouts, ${r.bodyDays} days`;
}

async function webhook(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response> {
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "fitbit", ...fields, note: fields.note.slice(0, 500) });
  // Google verifies the endpoint with {"type":"verification"}: 200 when the secret is right, 401 without it
  if (!fitbitWebhookOk(req.headers.get("authorization"))) { await log({ ok: false, note: "bad secret" }); return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (body && typeof body === "object" && !Array.isArray(body) && (body as { type?: string }).type === "verification") { await log({ event_type: "verification", ok: true, note: "endpoint verified" }); return new NextResponse(null, { status: 200 }); }
  const list = (Array.isArray(body) ? body : [body]) as FitbitNotification[];
  // answer 204 now; fetch the data after the response (Google retries anything slower than its timeout)
  after(async () => {
    for (const n of list) {
      const external = String(n.data?.healthUserId ?? "");
      const rows = await rowsFor(admin, "fitbit", external);
      if (!rows.length) { await log({ event_type: n.data?.dataType, external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); continue; }
      for (const row of rows) {
        try { await log({ event_type: n.data?.dataType, external_user_id: external, ok: true, note: await fitbitHandleNotification(admin, row.user_id, row, n) }); }
        catch (e) {
          console.error("[webhooks/fitbit]", e);
          if (e instanceof AccessLost) await admin.from("integrations").update({ status: "error", error: e.message, updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("provider", "fitbit");
          await log({ event_type: n.data?.dataType, external_user_id: external, ok: false, note: String((e as Error).message ?? e) });
        }
      }
    }
  });
  return new NextResponse(null, { status: 204 });
}

/** Registers Velocity's webhook endpoint with Google for this project (once; PR runs it from Admin). Google calls the
 *  endpoint twice to verify it before saving. `access` is a Google Health token of any connected account. */
export async function fitbitCreateSubscriber(access: string, endpointUri: string) {
  const c = fitbitConfig();
  if (!c.projectNumber || !c.webhookSecret) throw new MakerError("fitbit", 400, "GOOGLE_HEALTH_PROJECT_NUMBER and GOOGLE_HEALTH_WEBHOOK_SECRET are needed first.");
  const body = { endpointUri, endpointAuthorization: { secret: c.webhookSecret }, subscriberConfigs: FITBIT_TYPES.map((dataType) => ({ dataType, subscriptionCreatePolicy: "AUTOMATIC" })) };
  return api<Record<string, unknown>>(access, `/projects/${c.projectNumber}/subscribers?subscriberId=velocity`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
export const fitbitListSubscribers = (access: string) => api<Record<string, unknown>>(access, `/projects/${fitbitConfig().projectNumber}/subscribers`);

// ---------- the provider ----------
export const fitbit: DirectProvider = {
  key: "fitbit",
  on: fitbitOn,
  pkce: true,
  maxDays: 365,
  authLink: fitbitAuthLink,
  exchange: fitbitExchange,
  refresh: fitbitRefresh,
  identity: async (access) => {
    const id = await fitbitIdentity(access);
    const devices = await fitbitDevices(access);
    const dev = devices.find((d) => d.displayName || d.model);
    return { id: String(id.healthUserId ?? id.legacyUserId ?? ""), device: dev ? (dev.displayName ?? dev.model) : undefined };
  },
  revoke: async (access) => { await fitbitRevoke(access); },
  history: fitbitSyncHistory,
  webhook,
  accessLost: (e) => e instanceof MakerError && e.maker === "fitbit" && ((e.status === 400 && /invalid_grant/i.test(e.message)) || e.status === 401),
};
