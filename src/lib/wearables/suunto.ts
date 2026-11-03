// Server only. Suunto through the Suunto Cloud API (cloudapi.suunto.com, behind Azure API Management). PR applies
// at apizone.suunto.com (a company, their partner terms); the portal gives a client id and secret plus a
// subscription key for the API, and takes the redirect URI /api/connect/suunto/callback and the workout
// notification URL /api/webhooks/suunto?key=<SUUNTO_WEBHOOK_KEY>. Keys in Vercel: SUUNTO_CLIENT_ID,
// SUUNTO_CLIENT_SECRET, SUUNTO_SUBSCRIPTION_KEY, SUUNTO_WEBHOOK_KEY. The athlete signs in with the Suunto app
// account; tokens refresh (rotating). Suunto posts {username, workoutid} when a workout is uploaded; Velocity fetches
// it. Field names follow Suunto's published workout schema and can be adjusted in the SHAPE block when the partner
// documents differ. Nothing from here goes to any AI model.
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, after, type NextRequest } from "next/server";
import { env, makerFetch, rowsFor, tokenPost, MakerError, type ConnRow, type DirectProvider } from "./direct";
import { activityId, feetOf, localClock, markConnection, paceFields, saveWorkouts, sportOfText, type WorkoutIn } from "./import";
import type { Sport } from "@/lib/data";
import { AccessLost, freshToken } from "./tokens";

export const suuntoConfig = () => ({
  clientId: env("SUUNTO_CLIENT_ID"),
  clientSecret: env("SUUNTO_CLIENT_SECRET"),
  subscriptionKey: env("SUUNTO_SUBSCRIPTION_KEY"),
  webhookKey: env("SUUNTO_WEBHOOK_KEY"),
  authUrl: env("SUUNTO_AUTH_URL") || "https://cloudapi-oauth.suunto.com/oauth/authorize",
  tokenUrl: env("SUUNTO_TOKEN_URL") || "https://cloudapi-oauth.suunto.com/oauth/token",
  api: env("SUUNTO_API") || "https://cloudapi.suunto.com/v2",
});
export const suuntoOn = () => { const c = suuntoConfig(); return Boolean(c.clientId && c.clientSecret && c.subscriptionKey); };

// ---------- OAuth ----------
export function suuntoAuthLink(redirectUri: string, state: string) {
  const c = suuntoConfig();
  return `${c.authUrl}?${new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: redirectUri, state })}`;
}
export async function suuntoExchange(code: string, redirectUri: string) {
  const c = suuntoConfig();
  const t = await tokenPost("suunto", c.tokenUrl, { grant_type: "authorization_code", code, redirect_uri: redirectUri }, { id: c.clientId, secret: c.clientSecret });
  return { ...t, externalUserId: typeof t.raw.user === "string" ? t.raw.user : typeof t.raw.username === "string" ? t.raw.username : undefined };
}
export const suuntoRefresh = (refresh: string) => { const c = suuntoConfig(); return tokenPost("suunto", c.tokenUrl, { grant_type: "refresh_token", refresh_token: refresh }, { id: c.clientId, secret: c.clientSecret }); };

// ---------- SHAPE: API ----------
const api = <T,>(access: string, path: string) => makerFetch<T>("suunto", `${suuntoConfig().api}${path}`, access, { headers: { "Ocp-Apim-Subscription-Key": suuntoConfig().subscriptionKey } });
export interface SuuntoWorkout { workoutKey: string; activityId?: number; workoutName?: string; startTime?: number; totalTime?: number; totalDistance?: number; totalAscent?: number; timeOffsetInMinutes?: number; energyConsumption?: number; hrdata?: { workoutAvgHR?: number; workoutMaxHR?: number }; description?: string }
export const suuntoWorkouts = (access: string, sinceMs: number, untilMs: number, limit = 100) => api<{ payload?: SuuntoWorkout[]; metadata?: { next?: string } } | SuuntoWorkout[]>(access, `/workouts?${new URLSearchParams({ since: String(sinceMs), until: String(untilMs), limit: String(limit), "filter-by-modification-time": "false" })}`).then((r) => (Array.isArray(r) ? r : r.payload ?? []));
export const suuntoWorkout = (access: string, key: string) => api<{ payload?: SuuntoWorkout } | SuuntoWorkout>(access, `/workouts/${encodeURIComponent(key)}`).then((r) => ("payload" in r && r.payload ? r.payload : (r as SuuntoWorkout)));
export const suuntoMe = (access: string) => api<{ username?: string; payload?: { username?: string } }>(access, "/users/me").then((r) => r.username ?? r.payload?.username ?? "");

// ---------- mapping ----------
/** Suunto activity ids (their activity table); unknown ids fall back to the name. */
const ACTIVITY: Record<number, Sport> = { 1: "hike", 2: "run", 3: "bike", 5: "bike", 6: "bike", 11: "hike", 12: "hike", 13: "strength", 21: "swim", 22: "swim", 24: "swim", 27: "run", 28: "run", 29: "bike", 30: "run", 31: "run", 70: "strength", 71: "strength", 72: "strength", 82: "run", 83: "bike" };
export function sportOfSuunto(id: number | undefined, name = ""): Sport { return (id != null && ACTIVITY[id]) || sportOfText(name); }
export function workoutToActivity(w: SuuntoWorkout): WorkoutIn | null {
  if (!w?.workoutKey || w.startTime == null) return null;
  const startS = w.startTime > 1e12 ? w.startTime / 1000 : w.startTime;
  const secs = Math.max(60, w.totalTime ?? 0);
  const when = localClock(startS, (w.timeOffsetInMinutes ?? 0) * 60);
  const sport = sportOfSuunto(w.activityId, `${w.workoutName ?? ""} ${w.description ?? ""}`);
  return {
    id: activityId("su", w.workoutKey), externalId: w.workoutKey, date: when.date, start: when.start, sport,
    name: w.workoutName?.trim() || (sport === "bike" ? "Ride" : sport === "run" ? "Run" : sport === "swim" ? "Swim" : "Workout"),
    min: Math.round(secs / 60), ...paceFields(sport, w.totalDistance, secs),
    hr: w.hrdata?.workoutAvgHR ? Math.round(w.hrdata.workoutAvgHR) : undefined, elev_ft: feetOf(w.totalAscent),
    // Suunto's energy is in kilojoules in most of its exports
    kcal: w.energyConsumption ? Math.round(w.energyConsumption > 20000 ? w.energyConsumption / 4184 : w.energyConsumption / 4.184) : undefined,
  };
}

// ---------- sync ----------
export async function suuntoToken(sb: SupabaseClient, row: ConnRow) {
  try { return await freshToken(sb, row, async (r) => { const t = await suuntoRefresh(r); return { a: t.a, r: t.r || r, e: t.e }; }); }
  catch (e) { if (suunto.accessLost(e)) throw new AccessLost("suunto", "Suunto removed Velocity's access. Connect again."); throw e; }
}
export async function suuntoSyncHistory(sb: SupabaseClient, uid: string, row: ConnRow, days: number) {
  const access = await suuntoToken(sb, row);
  const until = Date.now(), since = until - Math.min(days, 365) * 86400000;
  const list = await suuntoWorkouts(access, since, until, 200);
  const workouts = await saveWorkouts(sb, uid, "suunto", list.map(workoutToActivity).filter((x): x is WorkoutIn => !!x));
  const now = new Date().toISOString();
  await markConnection(sb, uid, "suunto", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts, bodyDays: 0 };
}

// ---------- webhook: Suunto posts {username, workoutid}; the URL carries ?key=SUUNTO_WEBHOOK_KEY ----------
async function webhook(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response> {
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "suunto", ...fields, note: fields.note.slice(0, 500) });
  const key = req.nextUrl.searchParams.get("key") ?? "", expected = suuntoConfig().webhookKey;
  if (!expected || key.length !== expected.length || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) { await log({ ok: false, note: "bad key" }); return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  let ev: { username?: string; workoutid?: string; workoutId?: string };
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const external = String(ev.username ?? ""), key2 = String(ev.workoutid ?? ev.workoutId ?? "");
  after(async () => {
    const rows = await rowsFor(admin, "suunto", external);
    if (!rows.length) { await log({ event_type: "workout", external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); return; }
    for (const row of rows) {
      try {
        const a = key2 ? workoutToActivity(await suuntoWorkout(await suuntoToken(admin, row), key2)) : null;
        if (a) { await saveWorkouts(admin, row.user_id, "suunto", [a]); await markConnection(admin, row.user_id, "suunto", "direct", { last_event_at: new Date().toISOString(), status: "connected", error: null }); }
        await log({ event_type: "workout", external_user_id: external, ok: true, note: a ? `workout ${a.sport} ${a.min} min` : "no usable workout" });
      } catch (e) {
        console.error("[webhooks/suunto]", e);
        if (e instanceof AccessLost) await admin.from("integrations").update({ status: "error", error: e.message, updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("provider", "suunto");
        await log({ event_type: "workout", external_user_id: external, ok: false, note: String((e as Error).message ?? e) });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

// ---------- the provider ----------
export const suunto: DirectProvider = {
  key: "suunto",
  on: suuntoOn,
  maxDays: 365,
  authLink: suuntoAuthLink,
  exchange: suuntoExchange,
  refresh: async (r) => { const t = await suuntoRefresh(r); return { a: t.a, r: t.r || r, e: t.e }; },
  identity: async (access, hint) => ({ id: hint?.externalUserId || (await suuntoMe(access).catch(() => "")) }),
  history: suuntoSyncHistory,
  webhook,
  accessLost: (e) => e instanceof MakerError && e.maker === "suunto" && (e.status === 401 || (e.status === 400 && /invalid_grant/i.test(e.message))),
};
