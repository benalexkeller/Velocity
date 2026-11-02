// Server only. Outlook calendars through Microsoft Graph, for personal Microsoft accounts (Outlook.com, Hotmail, Live)
// and work or school accounts (Microsoft 365). One permission, Calendars.ReadWrite: Velocity makes its own
// "Velocity training" calendar and writes the sessions there; with "Show my events" on it also reads the athlete's
// other calendars, which it never changes and never stores. Relative imports only, so test scripts can load it.
import { CALENDAR_NAME, outlookEvent, type CalSession, type RawEvent } from "./events";
import { CalError, type Writer } from "./engine";

const env = (k: string) => process.env[k] ?? "";
export const microsoftConfig = () => ({
  clientId: env("MICROSOFT_CLIENT_ID"),
  clientSecret: env("MICROSOFT_CLIENT_SECRET"),
  // "common": any Microsoft account, personal or work. Overridable for the stand-in Microsoft server used in tests.
  authUrl: env("MICROSOFT_AUTH_URL") || "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: env("MICROSOFT_TOKEN_URL") || "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  api: env("MICROSOFT_GRAPH_API") || "https://graph.microsoft.com/v1.0",
});
/** True when "Connect Outlook" can connect (both values set on the server). */
export const outlookOn = () => { const c = microsoftConfig(); return Boolean(c.clientId && c.clientSecret); };

export const OUTLOOK_SCOPES = ["openid", "email", "offline_access", "https://graph.microsoft.com/Calendars.ReadWrite"];

export function outlookAuthLink(redirectUri: string, state: string) {
  const c = microsoftConfig();
  const q = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope: OUTLOOK_SCOPES.join(" "), state, prompt: "select_account" });
  return `${c.authUrl}?${q}`;
}

async function json(res: Response) {
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    const e = body.error as { code?: string; message?: string } | string | undefined;
    const reason = typeof e === "string" ? e : e?.code ?? String(res.status);
    const message = typeof e === "string" ? String(body.error_description ?? e) : e?.message ?? text.slice(0, 200);
    throw new CalError(res.status, reason, message);
  }
  return body;
}

/** The sign-in code → tokens and the account's email address (from the id token Microsoft sends with them). */
export async function outlookExchange(code: string, redirectUri: string) {
  const c = microsoftConfig();
  const body = await json(await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code", scope: OUTLOOK_SCOPES.join(" ") }) }));
  let email: string | null = null;
  // the id token comes straight from Microsoft's token endpoint over TLS, so its payload is read without re-checking the signature
  try { const p = JSON.parse(Buffer.from(String(body.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8")); email = p.email ?? p.preferred_username ?? null; } catch { email = null; }
  return { access: String(body.access_token ?? ""), refresh: body.refresh_token ? String(body.refresh_token) : null, scopes: String(body.scope ?? ""), email };
}

/** A fresh access token. Microsoft usually sends a new refresh token as well, which replaces the stored one. */
export async function outlookRefresh(refresh: string) {
  const c = microsoftConfig();
  const body = await json(await fetch(c.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refresh, grant_type: "refresh_token", scope: OUTLOOK_SCOPES.join(" ") }) }));
  return { access: String(body.access_token ?? ""), refresh: body.refresh_token ? String(body.refresh_token) : refresh };
}

const graph = (access: string, path: string, init: RequestInit = {}) =>
  fetch(path.startsWith("http") ? path : `${microsoftConfig().api}${path}`, { ...init, headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

// ---------- Velocity's own calendar ----------
export async function outlookCreateCalendar(access: string) {
  const res = await graph(access, "/me/calendars", { method: "POST", body: JSON.stringify({ name: CALENDAR_NAME }) });
  // a calendar with that name is already there (connected before): use it
  if (res.status === 409) {
    const list = await json(await graph(access, `/me/calendars?$select=id,name&$top=100`));
    const found = ((list.value as { id: string; name: string }[] | undefined) ?? []).find((c) => c.name === CALENDAR_NAME);
    if (found) return found.id;
  }
  return String((await json(res)).id);
}
export async function outlookCalendarExists(access: string, id: string) {
  const res = await graph(access, `/me/calendars/${encodeURIComponent(id)}?$select=id`);
  if (res.status === 404) return false;
  await json(res);
  return true;
}
export async function outlookDeleteCalendar(access: string, id: string) {
  const res = await graph(access, `/me/calendars/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.ok || res.status === 404) return;
  await json(res);
}

export function outlookWriter(access: string, calendarId: string, tz: string, appUrl: string): Writer {
  const create = async (s: CalSession) => {
    const res = await graph(access, `/me/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(outlookEvent(s, tz, appUrl)) });
    if (res.status === 404) throw new CalError(404, "calendar_gone", "The Velocity training calendar is gone.");
    return String((await json(res)).id);
  };
  return {
    async put(s, existing) {
      if (!existing) return create(s);
      const res = await graph(access, `/me/events/${encodeURIComponent(existing)}`, { method: "PATCH", body: JSON.stringify(outlookEvent(s, tz, appUrl)) });
      // deleted by hand in Outlook: add it again
      if (res.status === 404) return create(s);
      await json(res);
      return existing;
    },
    async del(eventId) {
      const res = await graph(access, `/me/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
      if (res.ok || res.status === 404) return;
      await json(res);
    },
  };
}

// ---------- the athlete's other calendars (read-only) ----------
export interface OCal { id: string; name: string; color: string | null; primary: boolean }
export async function outlookListCalendars(access: string, ownId: string | null): Promise<OCal[]> {
  const body = await json(await graph(access, "/me/calendars?$select=id,name,hexColor,isDefaultCalendar&$top=100"));
  return ((body.value as Record<string, unknown>[] | undefined) ?? [])
    .filter((c) => c.id !== ownId && c.name !== CALENDAR_NAME)
    .map((c) => ({ id: String(c.id), name: String(c.name ?? "Calendar"), color: typeof c.hexColor === "string" && c.hexColor ? c.hexColor : null, primary: !!c.isDefaultCalendar }));
}

/** Events between two instants, repeating ones as single occurrences, times in UTC. At most 750 (three pages). */
export async function outlookListEvents(access: string, calendarId: string, timeMin: string, timeMax: string): Promise<RawEvent[]> {
  const q = new URLSearchParams({ startDateTime: timeMin, endDateTime: timeMax, $select: "id,subject,start,end,isAllDay,isCancelled,showAs", $top: "250" });
  let url: string | null = `/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${q}`;
  const out: RawEvent[] = [];
  for (let page = 0; url && page < 3; page++) {
    const body = await json(await graph(access, url, { headers: { Prefer: 'outlook.timezone="UTC"' } }));
    for (const e of (body.value as Record<string, unknown>[] | undefined) ?? []) {
      if (e.isCancelled || e.showAs === "free" && !e.subject) continue;
      const st = e.start as { dateTime?: string } | undefined, en = e.end as { dateTime?: string } | undefined;
      if (!st?.dateTime || !en?.dateTime) continue;
      const utc = (s: string) => (/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s.replace(/\.\d+$/, "")}Z`);
      out.push(e.isAllDay
        ? { id: String(e.id), title: String(e.subject || "Busy"), start: { date: st.dateTime.slice(0, 10) }, end: { date: en.dateTime.slice(0, 10) } }
        : { id: String(e.id), title: String(e.subject || "Busy"), start: { dateTime: utc(st.dateTime) }, end: { dateTime: utc(en.dateTime) } });
    }
    url = typeof body["@odata.nextLink"] === "string" ? (body["@odata.nextLink"] as string) : null;
  }
  return out;
}
