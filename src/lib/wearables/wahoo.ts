// Server only. Wahoo through the Wahoo Cloud API (api.wahooligan.com). PR registers an app at
// developers.wahooligan.com (approval by Wahoo), sets its redirect URI to /api/connect/wahoo/callback, turns the
// webhook on there with the URL /api/webhooks/wahoo and a token, and puts WAHOO_CLIENT_ID, WAHOO_CLIENT_SECRET and
// WAHOO_WEBHOOK_TOKEN in Vercel. The athlete signs in at Wahoo; access tokens last two hours and refreshing hands
// out a new pair (the old one dies after the first call with the new token). Wahoo posts a workout summary when a
// ride or run is uploaded; history is read page by page. Nothing from here goes to any AI model.
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, after, type NextRequest } from "next/server";
import { env, makerFetch, rowsFor, tokenPost, MakerError, type ConnRow, type DirectProvider, type Init } from "./direct";
import { activityId, deleteWorkout, feetOf, localClock, markConnection, paceFields, saveWorkouts, sportOfText, type WorkoutIn } from "./import";
import type { Sport } from "@/lib/data";
import { AccessLost, freshToken } from "./tokens";

export const wahooConfig = () => ({
  clientId: env("WAHOO_CLIENT_ID"),
  clientSecret: env("WAHOO_CLIENT_SECRET"),
  webhookToken: env("WAHOO_WEBHOOK_TOKEN"),
  authUrl: env("WAHOO_AUTH_URL") || "https://api.wahooligan.com/oauth/authorize",
  tokenUrl: env("WAHOO_TOKEN_URL") || "https://api.wahooligan.com/oauth/token",
  api: env("WAHOO_API") || "https://api.wahooligan.com/v1",
});
export const wahooOn = () => { const c = wahooConfig(); return Boolean(c.clientId && c.clientSecret); };
export const WAHOO_SCOPES = ["user_read", "workouts_read", "offline_data"];

// ---------- OAuth ----------
export function wahooAuthLink(redirectUri: string, state: string) {
  const c = wahooConfig();
  return `${c.authUrl}?${new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", scope: WAHOO_SCOPES.join(" "), state })}`;
}
export const wahooExchange = (code: string, redirectUri: string) => { const c = wahooConfig(); return tokenPost("wahoo", c.tokenUrl, { client_id: c.clientId, client_secret: c.clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }); };
export const wahooRefresh = (refresh: string) => { const c = wahooConfig(); return tokenPost("wahoo", c.tokenUrl, { client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token", refresh_token: refresh }); };

// ---------- API ----------
const api = <T,>(access: string, path: string, init?: Init) => makerFetch<T>("wahoo", `${wahooConfig().api}${path}`, access, init);
export const wahooUser = (access: string) => api<{ id: number | string; first?: string; last?: string; weight?: string | number }>(access, "/user");
export const wahooDeauthorize = (access: string) => api<void>(access, "/permissions", { method: "DELETE" });

export interface WahooSummary { distance_accum?: string | number; ascent_accum?: string | number; heart_rate_avg?: string | number; calories_accum?: string | number; duration_active_accum?: string | number; duration_total_accum?: string | number; speed_avg?: string | number; power_avg?: string | number; time_zone?: string; file?: { url?: string } }
export interface WahooWorkout { id: number | string; starts: string; minutes?: number | string; name?: string; workout_type_id?: number; workout_summary?: WahooSummary | null; workout_token?: string }
export const wahooWorkouts = (access: string, page = 1, perPage = 30) => api<{ workouts?: WahooWorkout[] } | WahooWorkout[]>(access, `/workouts?${new URLSearchParams({ page: String(page), per_page: String(perPage) })}`).then((r) => (Array.isArray(r) ? r : r.workouts ?? []));
export const wahooWorkout = (access: string, id: string | number) => api<WahooWorkout>(access, `/workouts/${encodeURIComponent(String(id))}`);

// ---------- mapping ----------
const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : undefined; };
/** Wahoo's workout type ids → Velocity's sports (the developer page's table). */
export function sportOfWahoo(typeId: number | undefined, name = ""): Sport {
  if (typeId != null) {
    if ([0, 11, 12, 13, 14, 15, 16, 49, 61, 64, 68, 70].includes(typeId)) return "bike";
    if ([1, 3, 4, 5, 67, 71].includes(typeId)) return "run";
    if ([25, 26].includes(typeId)) return "swim";
    if ([6, 7, 8, 9, 10, 56].includes(typeId)) return "hike";
    if (typeId === 42) return "strength";
  }
  return sportOfText(name); // an id not in the table: the name decides
}
/** The clock Wahoo gives is UTC ("2026-05-12T07:00:00.000Z"); the summary's time_zone names the local zone. */
function clockOf(starts: string, tz: string | undefined) {
  const epoch = Date.parse(starts) / 1000;
  if (!Number.isFinite(epoch)) return null;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(epoch * 1000));
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
      return { date: `${get("year")}-${get("month")}-${get("day")}`, start: `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}` };
    } catch { /* unknown zone name */ }
  }
  return localClock(epoch, 0);
}
export function workoutToActivity(w: WahooWorkout): WorkoutIn | null {
  if (!w?.id || !w.starts) return null;
  const s = w.workout_summary ?? {};
  const when = clockOf(w.starts, s.time_zone); if (!when) return null;
  const secs = num(s.duration_active_accum) ?? num(s.duration_total_accum) ?? (num(w.minutes) ?? 0) * 60;
  if (!secs || secs < 60) return null;
  const sport = sportOfWahoo(w.workout_type_id, w.name);
  return {
    id: activityId("wa", String(w.id)), externalId: String(w.id), date: when.date, start: when.start, sport,
    name: w.name?.trim() || (sport === "bike" ? "Ride" : sport === "run" ? "Run" : "Workout"), min: Math.round(secs / 60),
    ...paceFields(sport, num(s.distance_accum), secs),
    hr: num(s.heart_rate_avg) ? Math.round(num(s.heart_rate_avg)!) : undefined,
    elev_ft: feetOf(num(s.ascent_accum)),
    kcal: num(s.calories_accum) ? Math.round(num(s.calories_accum)!) : undefined,
  };
}

// ---------- sync ----------
export async function wahooToken(sb: SupabaseClient, row: ConnRow) {
  try { return await freshToken(sb, row, async (r) => { const t = await wahooRefresh(r); return { a: t.a, r: t.r, e: t.e }; }); }
  catch (e) { if (wahoo.accessLost(e)) throw new AccessLost("wahoo", "Wahoo removed Velocity's access. Connect again."); throw e; }
}
export async function wahooSyncHistory(sb: SupabaseClient, uid: string, row: ConnRow, days: number) {
  const access = await wahooToken(sb, row);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const acts: WorkoutIn[] = [];
  for (let page = 1; page <= 20; page++) {
    const list = await wahooWorkouts(access, page, 30);
    for (const w of list) { const a = workoutToActivity(w); if (a) acts.push(a); }
    if (list.length < 30 || (acts.length && acts[acts.length - 1].date < since)) break;
  }
  const workouts = await saveWorkouts(sb, uid, "wahoo", acts.filter((a) => a.date >= since));
  const now = new Date().toISOString();
  await markConnection(sb, uid, "wahoo", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts, bodyDays: 0 };
}

// ---------- webhook ----------
export interface WahooEvent { event_type?: string; webhook_token?: string; user?: { id?: number | string }; workout_summary?: WahooSummary & { workout?: WahooWorkout; id?: number | string } }
export function wahooTokenOk(token: string | undefined, expected = wahooConfig().webhookToken) {
  if (!token || !expected) return false;
  const a = Buffer.from(token), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function wahooHandleEvent(sb: SupabaseClient, uid: string, row: ConnRow, ev: WahooEvent): Promise<string> {
  const w = ev.workout_summary?.workout;
  if (ev.event_type === "workout_summary" && w?.id) {
    const a = workoutToActivity({ ...w, workout_summary: ev.workout_summary });
    if (a) { await saveWorkouts(sb, uid, "wahoo", [a]); await markConnection(sb, uid, "wahoo", "direct", { last_event_at: new Date().toISOString(), status: "connected", error: null }); return `workout ${a.sport} ${a.min} min`; }
    return "workout without a usable summary";
  }
  if (/delete/i.test(ev.event_type ?? "") && w?.id) { await deleteWorkout(sb, uid, activityId("wa", String(w.id))); return "workout deleted"; }
  return `ignored ${ev.event_type ?? "?"}`;
}
async function webhook(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response> {
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "wahoo", ...fields, note: fields.note.slice(0, 500) });
  let ev: WahooEvent;
  try { ev = JSON.parse(raw) as WahooEvent; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!wahooTokenOk(ev.webhook_token)) { await log({ ok: false, note: "bad token" }); return NextResponse.json({ error: "bad_token" }, { status: 401 }); }
  const external = String(ev.user?.id ?? "");
  after(async () => {
    const rows = await rowsFor(admin, "wahoo", external);
    if (!rows.length) { await log({ event_type: ev.event_type, external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); return; }
    for (const row of rows) {
      try { await log({ event_type: ev.event_type, external_user_id: external, ok: true, note: await wahooHandleEvent(admin, row.user_id, row, ev) }); }
      catch (e) { console.error("[webhooks/wahoo]", e); await log({ event_type: ev.event_type, external_user_id: external, ok: false, note: String((e as Error).message ?? e) }); }
    }
  });
  return NextResponse.json({ ok: true });
}

// ---------- the provider ----------
export const wahoo: DirectProvider = {
  key: "wahoo",
  on: wahooOn,
  maxDays: 365,
  authLink: wahooAuthLink,
  exchange: wahooExchange,
  refresh: async (r) => { const t = await wahooRefresh(r); return { a: t.a, r: t.r, e: t.e }; },
  identity: async (access) => ({ id: String((await wahooUser(access)).id) }),
  revoke: async (access) => { await wahooDeauthorize(access); },
  history: wahooSyncHistory,
  webhook,
  accessLost: (e) => e instanceof MakerError && e.maker === "wahoo" && (e.status === 401 || (e.status === 400 && /invalid_grant/i.test(e.message))),
};
