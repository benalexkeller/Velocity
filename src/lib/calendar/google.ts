// Server only. Google Calendar for one athlete: the sign-in link, the token exchange, the "Velocity training"
// calendar and keeping its events equal to the plan. Velocity asks for one permission, `calendar.app.created`:
// it can make its own calendar and change the events in it, and cannot see any other calendar or event.
// Relative imports only, so the test script can load this file with plain Node.
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { CALENDAR_NAME, googleEvent, sessionPrint, type CalSession } from "./events";

const env = (k: string) => process.env[k] ?? "";
export const googleConfig = () => ({
  clientId: env("GOOGLE_CLIENT_ID"),
  clientSecret: env("GOOGLE_CLIENT_SECRET"),
  // overridable for the test script's stand-in Google server
  authUrl: env("GOOGLE_AUTH_URL") || "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: env("GOOGLE_TOKEN_URL") || "https://oauth2.googleapis.com/token",
  revokeUrl: env("GOOGLE_REVOKE_URL") || "https://oauth2.googleapis.com/revoke",
  api: env("GOOGLE_CALENDAR_API") || "https://www.googleapis.com/calendar/v3",
});
/** True when "Connect Google Calendar" can connect (both values set on the server). */
export const googleOn = () => { const c = googleConfig(); return Boolean(c.clientId && c.clientSecret); };

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const SCOPES = ["openid", "email", CALENDAR_SCOPE];
/** Only asked for when the athlete turns on "Show my other events": read events (titles and times) and the list
 *  of their calendars. Velocity never changes those events and does not store them. */
export const READ_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const LIST_SCOPE = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export const canRead = (scopes: string | null | undefined) => !!scopes && scopes.split(/\s+/).includes(READ_SCOPE) && scopes.split(/\s+/).includes(LIST_SCOPE);

// ---------- the refresh token is stored encrypted (AES-256-GCM); the key never leaves the server ----------
function key() {
  const secret = env("CALENDAR_TOKEN_KEY") || googleConfig().clientSecret;
  if (!secret) throw new Error("no key: GOOGLE_CLIENT_SECRET is not set");
  return Buffer.from(hkdfSync("sha256", secret, "velocity-calendar", "refresh-token", 32));
}
export function seal(plain: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
export function unseal(sealed: string) {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1") throw new Error("unknown token format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

// ---------- sign-in ----------
export function authLink(redirectUri: string, state: string, loginHint?: string, read = false) {
  const c = googleConfig();
  const scope = [...SCOPES, ...(read ? [READ_SCOPE, LIST_SCOPE] : [])].join(" ");
  const q = new URLSearchParams({ client_id: c.clientId, redirect_uri: redirectUri, response_type: "code", scope, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  if (loginHint) q.set("login_hint", loginHint);
  return `${c.authUrl}?${q}`;
}

export class GoogleError extends Error {
  constructor(public status: number, public reason: string, message: string) { super(message); }
}
async function json(res: Response) {
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    const e = body.error as { message?: string; errors?: { reason?: string }[] } | string | undefined;
    const reason = typeof e === "string" ? e : e?.errors?.[0]?.reason ?? String(res.status);
    const message = typeof e === "string" ? String(body.error_description ?? e) : e?.message ?? text.slice(0, 200);
    throw new GoogleError(res.status, reason, message);
  }
  return body;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const c = googleConfig();
  const body = await json(await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) }));
  const idToken = String(body.id_token ?? "");
  let email: string | null = null;
  // the id token comes straight from Google's token endpoint over TLS, so its payload is read without re-checking the signature
  try { email = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")).email ?? null; } catch { email = null; }
  return { access: String(body.access_token ?? ""), refresh: body.refresh_token ? String(body.refresh_token) : null, scopes: String(body.scope ?? ""), email };
}

export async function accessFrom(refresh: string) {
  const c = googleConfig();
  const body = await json(await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ refresh_token: refresh, client_id: c.clientId, client_secret: c.clientSecret, grant_type: "refresh_token" }) }));
  return String(body.access_token ?? "");
}

export async function revoke(token: string) {
  try { await fetch(`${googleConfig().revokeUrl}?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }); } catch { /* best effort */ }
}

// ---------- the calendar ----------
const api = (access: string, path: string, init: RequestInit = {}) =>
  fetch(`${googleConfig().api}${path}`, { ...init, headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

export async function createCalendar(access: string, tz: string) {
  const body = await json(await api(access, "/calendars", { method: "POST", body: JSON.stringify({ summary: CALENDAR_NAME, description: "Training sessions from Velocity (velocityathletes.com). Changes in the app appear here; changes made here are overwritten.", timeZone: tz }) }));
  return String(body.id);
}
/** True when the calendar still exists (the athlete may have deleted it in Google). */
export async function calendarExists(access: string, id: string) {
  const res = await api(access, `/calendars/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 410) return false;
  await json(res);
  return true;
}
export async function deleteCalendar(access: string, id: string) {
  const res = await api(access, `/calendars/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok || res.status === 404 || res.status === 410) return;
  await json(res);
}

// ---------- the athlete's other calendars (read-only, only with READ_SCOPE + LIST_SCOPE) ----------
export interface GCal { id: string; name: string; color: string | null; primary: boolean; selected: boolean }
/** Calendars shown in the athlete's Google Calendar, without Velocity's own and without birthdays/contacts. */
export async function listCalendars(access: string, ownId: string | null): Promise<GCal[]> {
  const body = await json(await api(access, "/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=100"));
  const items = (body.items as Record<string, unknown>[] | undefined) ?? [];
  return items
    .filter((c) => c.id !== ownId && !c.deleted && !c.hidden && !/#contacts@|addressbook#contacts/.test(String(c.id)))
    .map((c) => ({ id: String(c.id), name: String(c.summaryOverride ?? c.summary ?? "Calendar"), color: (c.backgroundColor as string) ?? null, primary: !!c.primary, selected: !!c.selected || !!c.primary }));
}
/** Events of one calendar between two instants; repeating events come as single occurrences. */
export async function listEvents(access: string, calendarId: string, timeMin: string, timeMax: string) {
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250", fields: "items(id,summary,start,end,status,eventType,visibility)" });
  const body = await json(await api(access, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`));
  return ((body.items as Record<string, unknown>[] | undefined) ?? [])
    // working-location markers ("Home", "Office") are not appointments
    .filter((e) => e.status !== "cancelled" && e.eventType !== "workingLocation")
    .map((e) => ({ id: String(e.id), title: String(e.summary ?? "Busy"), start: e.start as { dateTime?: string; date?: string }, end: e.end as { dateTime?: string; date?: string } }));
}

/** Each session's event id is derived from the session id, so the same session can never be added twice. */
export const eventIdOf = (sessionId: string) => "vel" + createHash("sha256").update(sessionId).digest("hex").slice(0, 40);

/** What is in Google, per session id: fingerprint of the event and the session's date. */
export type EventMap = Record<string, { h: string; d: string }>;

export interface SyncResult { map: EventMap; added: number; updated: number; removed: number; remaining: number; calendarGone?: boolean }

/**
 * Makes the calendar equal to `list`: adds new sessions, rewrites changed ones, deletes events of sessions that
 * are gone. Only events dated `from` or later are deleted, so past weeks stay as they were. Stops starting new
 * calls after `budgetMs` and reports what is left; the next call carries on (event ids make it safe to repeat).
 */
export async function syncEvents(opts: { access: string; calendarId: string; list: CalSession[]; tz: string; from: string; map: EventMap; appUrl: string; full?: boolean; budgetMs?: number; parallel?: number }): Promise<SyncResult> {
  const { access, calendarId, list, tz, from, appUrl } = opts;
  const map: EventMap = { ...opts.map };
  const cal = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const deadline = Date.now() + (opts.budgetMs ?? 40000);
  const ids = new Set(list.map((s) => s.id));
  type Job = { kind: "put"; s: CalSession; h: string } | { kind: "del"; id: string };
  const jobs: Job[] = [];
  for (const s of list) { const h = sessionPrint(s, tz); if (opts.full || map[s.id]?.h !== h) jobs.push({ kind: "put", s, h }); }
  for (const [id, v] of Object.entries(map)) if (!ids.has(id) && v.d >= from) jobs.push({ kind: "del", id });

  const out: SyncResult = { map, added: 0, updated: 0, removed: 0, remaining: 0 };
  let stop: GoogleError | null = null;
  let left = jobs.length;
  const run = async (j: Job) => {
    if (j.kind === "del") {
      const res = await api(access, `${cal}/${eventIdOf(j.id)}`, { method: "DELETE" });
      if (!(res.ok || res.status === 404 || res.status === 410)) await json(res);
      delete map[j.id]; out.removed++;
      return;
    }
    const eid = eventIdOf(j.s.id), body = JSON.stringify({ id: eid, ...googleEvent(j.s, tz, appUrl) });
    let res = map[j.s.id] ? await api(access, `${cal}/${eid}`, { method: "PUT", body }) : await api(access, cal, { method: "POST", body });
    // already there (an earlier run was cut short, or the event was deleted in Google): rewrite it in place
    if (res.status === 409) res = await api(access, `${cal}/${eid}`, { method: "PUT", body });
    // listed as there but missing in Google: add it again
    else if (res.status === 404 && map[j.s.id]) res = await api(access, cal, { method: "POST", body });
    await json(res);
    if (map[j.s.id]) out.updated++; else out.added++;
    map[j.s.id] = { h: j.h, d: j.s.date };
  };
  let next = 0;
  const worker = async () => {
    while (!stop && next < jobs.length && Date.now() < deadline) {
      const j = jobs[next++];
      try { await run(j); left--; }
      catch (e) {
        if (e instanceof GoogleError && j.kind === "put" && e.status === 404) { out.calendarGone = true; stop = e; return; }
        if (e instanceof GoogleError && (e.status === 401 || e.status === 403 || e.status === 429 || e.status >= 500)) { stop = e; return; }
        // one bad event must not stop the rest; it is tried again on the next sync because its fingerprint was not saved
        console.error("[calendar] event", e);
        left--;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.parallel ?? 4) }, worker));
  out.remaining = left;
  const s = stop as GoogleError | null;
  // signed out of Google, or the permission was taken away: the athlete has to connect again
  if (s && !out.calendarGone && (s.status === 401 || (s.status === 403 && !/rate|quota|limit/i.test(s.reason)))) throw s;
  return out;
}
