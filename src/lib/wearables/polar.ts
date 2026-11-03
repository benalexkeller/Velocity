// Server only. Polar through the Polar AccessLink API (v3, www.polaraccesslink.com), open to any developer: PR
// registers a client at admin.polaraccesslink.com, puts POLAR_CLIENT_ID and POLAR_CLIENT_SECRET in Vercel, and
// registers Velocity's webhook once (Admin → "Register webhook"; the key Polar answers with goes into
// POLAR_WEBHOOK_SECRET). The athlete signs in at Polar Flow and allows "accesslink.read_all"; Polar's token does not
// expire. Polar then posts an event for each new exercise, night of sleep and physical-info change; Velocity fetches
// it. Exercises are listed for 30 days back only; sleep and Nightly Recharge for 28. Nothing from here goes to any
// AI model.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, after, type NextRequest } from "next/server";
import { env, makerFetch, rowsFor, secondsOf, tokenPost, MakerError, type ConnRow, type DirectProvider, type Init } from "./direct";
import { activityId, markConnection, paceFields, saveBodyDays, saveWorkouts, sportOfText, type BodyIn, type WorkoutIn } from "./import";
import { AccessLost, unsealTokens } from "./tokens";

export const polarConfig = () => ({
  clientId: env("POLAR_CLIENT_ID"),
  clientSecret: env("POLAR_CLIENT_SECRET"),
  webhookSecret: env("POLAR_WEBHOOK_SECRET"),
  authUrl: env("POLAR_AUTH_URL") || "https://flow.polar.com/oauth2/authorization",
  tokenUrl: env("POLAR_TOKEN_URL") || "https://polarremote.com/v2/oauth2/token",
  api: env("POLAR_API") || "https://www.polaraccesslink.com/v3",
});
export const polarOn = () => { const c = polarConfig(); return Boolean(c.clientId && c.clientSecret); };

// ---------- OAuth ----------
export function polarAuthLink(redirectUri: string, state: string) {
  const c = polarConfig();
  return `${c.authUrl}?${new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: redirectUri, scope: "accesslink.read_all", state })}`;
}
/** Polar's token does not expire; `x_user_id` in the answer is the athlete's Polar id. */
export async function polarExchange(code: string, redirectUri: string) {
  const c = polarConfig();
  const t = await tokenPost("polar", c.tokenUrl, { grant_type: "authorization_code", code, redirect_uri: redirectUri }, { id: c.clientId, secret: c.clientSecret });
  return { a: t.a, r: "", e: Math.floor(Date.now() / 1000) + 10 * 365 * 86400, scope: t.scope, externalUserId: t.raw.x_user_id != null ? String(t.raw.x_user_id) : undefined };
}

// ---------- API ----------
const api = <T,>(access: string, path: string, init?: Init) => makerFetch<T>("polar", `${polarConfig().api}${path}`, access, init);
/** Calls with the client's own credentials (webhook management), not an athlete's token. */
const clientApi = <T,>(path: string, init: Init = {}) => {
  const c = polarConfig();
  return makerFetch<T>("polar", `${c.api}${path}`, null, { ...init, headers: { Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`, ...(init.headers ?? {}) } });
};

/** Every athlete must be registered once before their data can be read (409 = already registered, fine). */
export async function polarRegister(access: string, memberId: string) {
  try { await api(access, "/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ "member-id": memberId }) }); }
  catch (e) { if (!(e instanceof MakerError && e.status === 409)) throw e; }
}
export const polarDeregister = (access: string, polarUserId: string) => api<void>(access, `/users/${encodeURIComponent(polarUserId)}`, { method: "DELETE" });
export const polarUser = (access: string, polarUserId: string) => api<{ "polar-user-id"?: number; "member-id"?: string; "registration-date"?: string; "first-name"?: string }>(access, `/users/${encodeURIComponent(polarUserId)}`);

export interface PolarExercise {
  id: string; upload_time?: string; polar_user?: string; device?: string; device_id?: string; start_time: string; start_time_utc_offset?: number; duration: string;
  calories?: number; distance?: number; heart_rate?: { average?: number; maximum?: number }; training_load?: number; sport?: string; has_route?: boolean; detailed_sport_info?: string;
  training_load_pro?: { cardio_load?: number };
}
export interface PolarNight { date: string; sleep_start_time?: string; sleep_end_time?: string; light_sleep?: number; deep_sleep?: number; rem_sleep?: number; unrecognized_sleep_stage?: number; sleep_score?: number; total_interruption_duration?: number }
export interface PolarRecharge { date: string; heart_rate_avg?: number; heart_rate_variability_avg?: number; nightly_recharge_status?: number; ans_charge?: number }
export interface PolarPhysical { weight?: number; vo2_max?: number; resting_heart_rate?: number; modified?: string; created?: string }

export const polarExercises = (access: string) => api<PolarExercise[]>(access, "/exercises");
export const polarExercise = (access: string, id: string) => api<PolarExercise>(access, `/exercises/${encodeURIComponent(id)}`);
export const polarNights = (access: string) => api<{ nights?: PolarNight[] }>(access, "/users/sleep").then((r) => r.nights ?? []);
export const polarNight = (access: string, date: string) => api<PolarNight>(access, `/users/sleep/${date}`);
export const polarRecharges = (access: string) => api<{ recharges?: PolarRecharge[] }>(access, "/users/nightly-recharge").then((r) => r.recharges ?? []);
export const polarPhysical = (access: string) => api<PolarPhysical>(access, "/users/physical-info");

// ---------- mapping ----------
/** Polar writes local wall-clock times without an offset ("2026-05-16T16:29:14.000") plus the offset in minutes. */
function localOf(t: string) { const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(t); return m ? { date: m[1], start: `${m[2]}:${m[3]}` } : null; }

export function exerciseToWorkout(x: PolarExercise): WorkoutIn | null {
  if (!x?.id || !x.start_time) return null;
  const when = localOf(x.start_time); if (!when) return null;
  const secs = Math.max(60, secondsOf(x.duration));
  const sportText = `${x.detailed_sport_info ?? ""} ${x.sport ?? ""}`;
  const sport = sportOfText(sportText);
  return {
    id: activityId("po", x.id), externalId: x.id, date: when.date, start: when.start, sport,
    name: (x.detailed_sport_info || x.sport || "Workout").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    min: Math.round(secs / 60), ...paceFields(sport, x.distance, secs),
    hr: x.heart_rate?.average ? Math.round(x.heart_rate.average) : undefined,
    kcal: x.calories ? Math.round(x.calories) : undefined,
  };
}
export function nightToBody(n: PolarNight): BodyIn | null {
  if (!n?.date) return null;
  const asleep = (n.light_sleep ?? 0) + (n.deep_sleep ?? 0) + (n.rem_sleep ?? 0) + (n.unrecognized_sleep_stage ?? 0);
  return { date: n.date, ...(asleep > 0 ? { sleep_h: Math.round((asleep / 3600) * 100) / 100 } : {}), ...(typeof n.sleep_score === "number" ? { sleep_score: Math.round(n.sleep_score) } : {}) };
}
/** Nightly Recharge: resting HR and HRV of the night, and its status (-10..10) as a recovery percentage. */
export function rechargeToBody(r: PolarRecharge): BodyIn | null {
  if (!r?.date) return null;
  return {
    date: r.date,
    ...(typeof r.heart_rate_avg === "number" ? { rhr: Math.round(r.heart_rate_avg) } : {}),
    ...(typeof r.heart_rate_variability_avg === "number" ? { hrv: Math.round(r.heart_rate_variability_avg * 10) / 10 } : {}),
    ...(typeof r.nightly_recharge_status === "number" ? { recovery: Math.round(((r.nightly_recharge_status + 10) / 20) * 100) } : {}),
  };
}
export function physicalToBody(p: PolarPhysical, today: string): BodyIn | null {
  if (!p) return null;
  const date = (p.modified ?? p.created ?? today).slice(0, 10);
  const out: BodyIn = { date };
  if (typeof p.weight === "number" && p.weight > 20) out.weight_kg = Math.round(p.weight * 10) / 10;
  if (typeof p.vo2_max === "number" && p.vo2_max > 10) out.vo2 = Math.round(p.vo2_max * 10) / 10;
  return Object.keys(out).length > 1 ? out : null;
}

// ---------- sync ----------
export async function polarSyncHistory(sb: SupabaseClient, uid: string, row: ConnRow, days: number) {
  if (!row.secret) throw new AccessLost("polar");
  const access = unsealTokens(row.secret).a;
  const since = new Date(Date.now() - Math.min(days, 30) * 86400000).toISOString().slice(0, 10);
  const [exercises, nights, recharges, physical] = await Promise.all([polarExercises(access), polarNights(access), polarRecharges(access), polarPhysical(access).catch(() => null)]);
  const acts = exercises.map(exerciseToWorkout).filter((a): a is WorkoutIn => !!a && a.date >= since);
  const today = new Date().toISOString().slice(0, 10);
  const body = [...nights.map(nightToBody), ...recharges.map(rechargeToBody), physical ? physicalToBody(physical, today) : null].filter((b): b is BodyIn => !!b);
  const workouts = await saveWorkouts(sb, uid, "polar", acts);
  const bodyDays = await saveBodyDays(sb, uid, "polar", body);
  const now = new Date().toISOString();
  await markConnection(sb, uid, "polar", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts, bodyDays };
}

// ---------- webhooks ----------
export interface PolarEvent { event: string; user_id: number | string; entity_id?: string; date?: string; timestamp?: string; url?: string }
export const POLAR_EVENTS = ["EXERCISE", "SLEEP", "PHYSICAL_INFORMATION"];
/** Polar-Webhook-Signature = hex HMAC-SHA256(signature secret key, raw body). */
export function polarSignatureOk(rawBody: string, signature: string | null, secret = polarConfig().webhookSecret) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function polarHandleEvent(sb: SupabaseClient, uid: string, row: ConnRow, ev: PolarEvent): Promise<string> {
  if (!row.secret) throw new AccessLost("polar");
  const access = unsealTokens(row.secret).a;
  let note = `ignored ${ev.event}`;
  if (ev.event === "EXERCISE" && ev.entity_id) {
    const a = exerciseToWorkout(await polarExercise(access, ev.entity_id));
    if (a) { await saveWorkouts(sb, uid, "polar", [a]); note = `exercise ${a.sport} ${a.min} min`; }
  } else if (ev.event === "SLEEP") {
    const n = ev.date ? await polarNight(access, ev.date) : null;
    const nights = n ? [n] : await polarNights(access);
    const recharges = await polarRecharges(access).catch(() => [] as PolarRecharge[]);
    const body = [...nights.map(nightToBody), ...recharges.map(rechargeToBody)].filter((b): b is BodyIn => !!b);
    note = `sleep: ${await saveBodyDays(sb, uid, "polar", body)} days`;
  } else if (ev.event === "PHYSICAL_INFORMATION") {
    const b = physicalToBody(await polarPhysical(access), new Date().toISOString().slice(0, 10));
    if (b) { await saveBodyDays(sb, uid, "polar", [b]); note = `physical info ${b.date}`; }
  }
  const now = new Date().toISOString();
  await markConnection(sb, uid, "polar", "direct", { last_event_at: now, status: "connected", error: null });
  return note;
}
async function webhook(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response> {
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "polar", ...fields, note: fields.note.slice(0, 500) });
  if (!polarSignatureOk(raw, req.headers.get("polar-webhook-signature"))) { await log({ ok: false, note: "bad signature" }); return NextResponse.json({ error: "bad_signature" }, { status: 401 }); }
  let ev: PolarEvent;
  try { ev = JSON.parse(raw) as PolarEvent; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (ev.event === "PING") { await log({ event_type: "PING", ok: true, note: "ping" }); return NextResponse.json({ ok: true }); }
  const external = String(ev.user_id ?? "");
  after(async () => {
    const rows = await rowsFor(admin, "polar", external);
    if (!rows.length) { await log({ event_type: ev.event, external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); return; }
    for (const row of rows) {
      try { await log({ event_type: ev.event, external_user_id: external, ok: true, note: await polarHandleEvent(admin, row.user_id, row, ev) }); }
      catch (e) {
        console.error("[webhooks/polar]", e);
        if (polar.accessLost(e)) await admin.from("integrations").update({ status: "error", error: "Polar removed Velocity's access. Connect again.", updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("provider", "polar");
        await log({ event_type: ev.event, external_user_id: external, ok: false, note: String((e as Error).message ?? e) });
      }
    }
  });
  return NextResponse.json({ ok: true });
}

/** Registers Velocity's webhook with Polar (one per client). Polar answers with `signature_secret_key` once: PR
 *  puts it in Vercel as POLAR_WEBHOOK_SECRET. */
export const polarCreateWebhook = (url: string) => clientApi<{ data?: { id?: string; events?: string[]; url?: string; signature_secret_key?: string } }>("/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ events: POLAR_EVENTS, url }) });
export const polarListWebhooks = () => clientApi<{ data?: { id?: string; events?: string[]; url?: string; active?: boolean }[] }>("/webhooks");
export const polarDeleteWebhook = (id: string) => clientApi<void>(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---------- the provider ----------
export const polar: DirectProvider = {
  key: "polar",
  on: polarOn,
  maxDays: 30,
  authLink: polarAuthLink,
  exchange: polarExchange,
  identity: async (_access, hint) => ({ id: hint?.externalUserId ?? "" }),
  afterConnect: async (access, ids) => { await polarRegister(access, ids.uid); },
  revoke: async (access, externalUserId) => { await polarDeregister(access, externalUserId); },
  history: polarSyncHistory,
  webhook,
  accessLost: (e) => e instanceof MakerError && e.maker === "polar" && (e.status === 401 || e.status === 403),
};
