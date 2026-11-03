// Server only. COROS through the COROS Partner API (open.coros.com). COROS issues partner keys to established
// platforms after an application to api@coros.com (a registered company, a technical contact, their terms); keys go
// into Vercel as COROS_CLIENT_ID and COROS_CLIENT_SECRET, and the workout push is switched on in COROS's partner
// portal with the URL /api/webhooks/coros (COROS sends the client id and secret in headers on each push).
// Until the partner documents arrive the addresses and field names below follow COROS's published partner shape
// and can be overridden with COROS_* env values; adjust the two SHAPE blocks when they differ. Nothing from here
// goes to any AI model.
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, after, type NextRequest } from "next/server";
import { env, makerFetch, rowsFor, MakerError, type ConnRow, type DirectProvider } from "./direct";
import { activityId, feetOf, localClock, markConnection, paceFields, saveBodyDays, saveWorkouts, sportOfText, type BodyIn, type WorkoutIn } from "./import";
import type { Sport } from "@/lib/data";
import { AccessLost, freshToken } from "./tokens";

export const corosConfig = () => ({
  clientId: env("COROS_CLIENT_ID"),
  clientSecret: env("COROS_CLIENT_SECRET"),
  base: env("COROS_OAUTH") || "https://open.coros.com/oauth2",
  api: env("COROS_API") || "https://open.coros.com/v2/coros",
});
export const corosOn = () => { const c = corosConfig(); return Boolean(c.clientId && c.clientSecret); };

// ---------- SHAPE: OAuth (COROS answers JSON with access_token, refresh_token, openId, expires_in) ----------
export function corosAuthLink(redirectUri: string, state: string) {
  const c = corosConfig();
  return `${c.base}/authorize?${new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", state })}`;
}
async function corosTokenCall(path: string, q: Record<string, string>) {
  const c = corosConfig();
  const j = await makerFetch<Record<string, unknown>>("coros", `${c.base}/${path}?${new URLSearchParams(q)}`, null, { method: "POST" });
  if (j.result && j.result !== "0000" && !j.access_token) throw new MakerError("coros", 400, String(j.message ?? j.result));
  const expiresIn = Number(j.expires_in ?? 2592000);
  return { a: String(j.access_token ?? ""), r: String(j.refresh_token ?? ""), e: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 2592000), externalUserId: j.openId != null ? String(j.openId) : undefined };
}
export const corosExchange = (code: string, redirectUri: string) => { const c = corosConfig(); return corosTokenCall("accesstoken", { client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri, code, grant_type: "authorization_code" }); };
export const corosRefresh = (refresh: string) => { const c = corosConfig(); return corosTokenCall("refresh-token", { client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refresh, grant_type: "refresh_token" }); };
export const corosDeauthorize = async (access: string) => { const c = corosConfig(); await makerFetch("coros", `${c.base}/deauthorize?${new URLSearchParams({ token: access })}`, null, { method: "POST" }).catch(() => undefined); };

// ---------- SHAPE: workouts and daily values ----------
export interface CorosWorkout { labelId?: string | number; mode?: number; subMode?: number; name?: string; startTime?: number; endTime?: number; startTimezone?: number; distance?: number; duration?: number; totalTime?: number; avgHeartRate?: number; avgSpeed?: number; calorie?: number; totalElevation?: number; fitUrl?: string }
export interface CorosDaily { date?: string | number; restingHeartRate?: number; hrv?: number; sleepDuration?: number; sleepScore?: number; vo2Max?: number }
const ymdCompact = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
export async function corosWorkouts(access: string, openId: string, from: Date, to: Date) {
  const c = corosConfig();
  const j = await makerFetch<{ result?: string; message?: string; data?: CorosWorkout[] }>("coros", `${c.api}/sport/list?${new URLSearchParams({ token: access, openId, startDate: ymdCompact(from), endDate: ymdCompact(to) })}`, access);
  if (j.result && j.result !== "0000") throw new MakerError("coros", /token/i.test(j.message ?? "") ? 401 : 400, String(j.message ?? j.result));
  return j.data ?? [];
}
export async function corosDaily(access: string, openId: string, from: Date, to: Date) {
  const c = corosConfig();
  const j = await makerFetch<{ result?: string; data?: CorosDaily[] }>("coros", `${c.api}/daily/query?${new URLSearchParams({ token: access, openId, startDate: ymdCompact(from), endDate: ymdCompact(to) })}`, access).catch(() => ({ data: [] as CorosDaily[] }));
  return j.data ?? [];
}

// ---------- mapping ----------
/** COROS sport modes (their partner table); unknown modes fall back to the name. */
const MODE: Record<number, Sport> = { 8: "run", 9: "bike", 10: "swim", 13: "swim", 14: "other", 15: "strength", 16: "hike", 18: "run", 19: "run", 20: "run", 21: "bike", 22: "hike", 23: "hike", 30: "run", 31: "bike" };
export function sportOfCoros(mode: number | undefined, name = ""): Sport { return (mode != null && MODE[mode]) || sportOfText(name); }
export function workoutToActivity(w: CorosWorkout): WorkoutIn | null {
  if (w?.startTime == null) return null;
  const start = w.startTime > 1e12 ? w.startTime / 1000 : w.startTime;
  const secs = Math.max(60, w.duration ?? w.totalTime ?? (w.endTime ? (w.endTime > 1e12 ? w.endTime / 1000 : w.endTime) - start : 0));
  // startTimezone is in quarter hours (e.g. 4 = UTC+1)
  const when = localClock(start, (w.startTimezone ?? 0) * 900);
  const sport = sportOfCoros(w.mode, w.name);
  const ext = String(w.labelId ?? `${w.mode ?? 0}-${start}`);
  return {
    id: activityId("co", ext), externalId: ext, date: when.date, start: when.start, sport, name: w.name?.trim() || (sport === "bike" ? "Ride" : sport === "run" ? "Run" : sport === "swim" ? "Swim" : "Workout"),
    min: Math.round(secs / 60), ...paceFields(sport, w.distance, secs),
    hr: w.avgHeartRate ? Math.round(w.avgHeartRate) : undefined, elev_ft: feetOf(w.totalElevation), kcal: w.calorie ? Math.round(w.calorie) : undefined,
  };
}
export function dailyToBody(d: CorosDaily): BodyIn | null {
  const raw = String(d.date ?? "");
  const date = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const out: BodyIn = { date };
  if (d.restingHeartRate) out.rhr = Math.round(d.restingHeartRate);
  if (d.hrv) out.hrv = Math.round(d.hrv * 10) / 10;
  if (d.sleepDuration) out.sleep_h = Math.round((d.sleepDuration / 3600) * 100) / 100;
  if (d.sleepScore) out.sleep_score = Math.round(d.sleepScore);
  if (d.vo2Max) out.vo2 = Math.round(d.vo2Max * 10) / 10;
  return Object.keys(out).length > 1 ? out : null;
}

// ---------- sync ----------
export async function corosToken(sb: SupabaseClient, row: ConnRow) {
  try { return await freshToken(sb, row, async (r) => { const t = await corosRefresh(r); return { a: t.a, r: t.r || r, e: t.e }; }); }
  catch (e) { if (coros.accessLost(e)) throw new AccessLost("coros", "COROS removed Velocity's access. Connect again."); throw e; }
}
export async function corosSyncHistory(sb: SupabaseClient, uid: string, row: ConnRow, days: number) {
  const access = await corosToken(sb, row), openId = row.external_user_id ?? "";
  const to = new Date(), from = new Date(Date.now() - Math.min(days, 365) * 86400000);
  let workouts = 0, bodyDays = 0;
  // COROS lists at most 30 days per call
  for (let t = from.getTime(); t < to.getTime(); t += 30 * 86400000) {
    const a = new Date(t), b = new Date(Math.min(to.getTime(), t + 30 * 86400000));
    const [ws, ds] = await Promise.all([corosWorkouts(access, openId, a, b), corosDaily(access, openId, a, b)]);
    workouts += await saveWorkouts(sb, uid, "coros", ws.map(workoutToActivity).filter((x): x is WorkoutIn => !!x));
    bodyDays += await saveBodyDays(sb, uid, "coros", ds.map(dailyToBody).filter((x): x is BodyIn => !!x));
  }
  const now = new Date().toISOString();
  await markConnection(sb, uid, "coros", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts, bodyDays };
}

// ---------- webhook: COROS pushes workout summaries with the client id and secret in headers ----------
function headersOk(req: NextRequest) {
  const c = corosConfig();
  const id = req.headers.get("client") ?? req.headers.get("x-client-id") ?? req.headers.get("clientid") ?? "", secret = req.headers.get("secret") ?? req.headers.get("x-client-secret") ?? req.headers.get("clientsecret") ?? "";
  const same = (a: string, b: string) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  return same(id, c.clientId) && same(secret, c.clientSecret);
}
async function webhook(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response> {
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "coros", ...fields, note: fields.note.slice(0, 500) });
  if (!headersOk(req)) { await log({ ok: false, note: "bad client headers" }); return NextResponse.json({ result: "4001", message: "unauthorized" }, { status: 401 }); }
  let body: { sportDataList?: (CorosWorkout & { openId?: string })[]; openId?: string; data?: (CorosWorkout & { openId?: string })[] };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ result: "4000", message: "bad json" }, { status: 400 }); }
  const list = body.sportDataList ?? body.data ?? [];
  after(async () => {
    for (const w of list) {
      const external = String(w.openId ?? body.openId ?? "");
      const rows = await rowsFor(admin, "coros", external);
      if (!rows.length) { await log({ event_type: "workout", external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); continue; }
      for (const row of rows) {
        try {
          const a = workoutToActivity(w);
          if (a) { await saveWorkouts(admin, row.user_id, "coros", [a]); await markConnection(admin, row.user_id, "coros", "direct", { last_event_at: new Date().toISOString(), status: "connected", error: null }); }
          await log({ event_type: "workout", external_user_id: external, ok: true, note: a ? `workout ${a.sport} ${a.min} min` : "no usable workout" });
        } catch (e) { console.error("[webhooks/coros]", e); await log({ event_type: "workout", external_user_id: external, ok: false, note: String((e as Error).message ?? e) }); }
      }
    }
  });
  return NextResponse.json({ result: "0000", message: "OK" });
}

// ---------- the provider ----------
export const coros: DirectProvider = {
  key: "coros",
  on: corosOn,
  maxDays: 365,
  authLink: corosAuthLink,
  exchange: corosExchange,
  refresh: async (r) => { const t = await corosRefresh(r); return { a: t.a, r: t.r || r, e: t.e }; },
  identity: async (_access, hint) => ({ id: hint?.externalUserId ?? "" }),
  revoke: async (access) => { await corosDeauthorize(access); },
  history: corosSyncHistory,
  webhook,
  accessLost: (e) => e instanceof MakerError && e.maker === "coros" && (e.status === 401 || e.status === 403),
};
