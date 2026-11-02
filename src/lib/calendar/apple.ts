// Server only. Apple Calendar (iCloud) through CalDAV, the standard calendar protocol iCloud speaks. Apple has no
// sign-in page for apps, so the athlete makes an app-specific password at account.apple.com and enters it once with
// their Apple ID; the server keeps it encrypted and the athlete can withdraw it there at any time. Velocity makes its
// own "Velocity training" calendar and writes the sessions there; with "Show my events" on it also reads the
// athlete's other calendars, which it never changes and never stores. Relative imports only, so tests can load it.
import { randomBytes } from "node:crypto";
import { CALENDAR_NAME, icsSingle, validZone, zonedToUtc, type RawEvent } from "./events";
import { CalError, type Writer } from "./engine";

const env = (k: string) => process.env[k] ?? "";
/** iCloud's CalDAV address; overridable for the stand-in CalDAV server used in tests. */
export const appleBase = () => env("APPLE_CALDAV_URL") || "https://caldav.icloud.com";

export interface AppleLogin { user: string; pass: string }

// ---------- requests ----------
async function dav(login: AppleLogin, url: string, method: string, body?: string, headers: Record<string, string> = {}) {
  let res: Response;
  try {
    res = await fetch(url, {
      method, body,
      headers: { Authorization: `Basic ${Buffer.from(`${login.user}:${login.pass}`).toString("base64")}`, ...(body ? { "Content-Type": body.startsWith("BEGIN:") ? "text/calendar; charset=utf-8" : "application/xml; charset=utf-8" } : {}), ...headers },
      redirect: "follow",
    });
  } catch (e) { throw new CalError(503, "network", `iCloud did not answer: ${(e as Error).message}`); }
  if (res.status === 401) throw new CalError(401, "auth", "Apple ID or app-specific password not accepted.");
  if (res.status === 403) throw new CalError(403, "forbidden", "iCloud refused the request.");
  if (res.status === 429 || res.status === 503) throw new CalError(429, "rate", "iCloud is busy. Try again later.");
  return res;
}
const xml = async (res: Response) => { if (!res.ok && res.status !== 207) throw new CalError(res.status, String(res.status), (await res.text()).slice(0, 200)); return res.text(); };

// ---------- reading WebDAV answers (namespace prefixes differ between servers, so tags are matched by local name) ----------
const tagRe = (name: string) => new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>)`, "i");
const inner = (src: string, name: string) => { const m = tagRe(name).exec(src); return m ? (m[1] ?? "") : null; };
const all = (src: string, name: string) => { const re = new RegExp(tagRe(name).source, "gi"); const out: string[] = []; let m; while ((m = re.exec(src))) out.push(m[1] ?? ""); return out; };
const unxml = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&");
const xmlText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Each <response>: its address and the properties that came back with status 200. */
function responses(body: string) {
  return all(body, "response").map((r) => {
    const ok = all(r, "propstat").filter((p) => /\s200\s/.test(inner(p, "status") ?? " 200 ")).map((p) => inner(p, "prop") ?? "").join("");
    return { href: unxml((inner(r, "href") ?? "").trim()), props: ok };
  });
}

const PROPFIND = (props: string) => `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop>${props}</d:prop></d:propfind>`;

/** Signs in and finds the account's calendar list. Throws CalError 401 "auth" when the login is wrong. */
export async function appleDiscover(login: AppleLogin): Promise<{ home: string }> {
  const base = appleBase().replace(/\/?$/, "/");
  const r1 = await dav(login, base, "PROPFIND", PROPFIND("<d:current-user-principal/>"), { Depth: "0" });
  const principalHref = inner(inner(await xml(r1), "current-user-principal") ?? "", "href");
  if (!principalHref) throw new CalError(502, "discovery", "iCloud did not say where the calendars are.");
  const principal = new URL(unxml(principalHref.trim()), r1.url || base).toString();
  const r2 = await dav(login, principal, "PROPFIND", PROPFIND("<c:calendar-home-set/>"), { Depth: "0" });
  const homeHref = inner(inner(await xml(r2), "calendar-home-set") ?? "", "href");
  if (!homeHref) throw new CalError(502, "discovery", "iCloud did not say where the calendars are.");
  return { home: new URL(unxml(homeHref.trim()), r2.url || principal).toString().replace(/\/?$/, "/") };
}

export interface ACal { id: string; name: string; color: string | null; primary: boolean }
/** The account's event calendars (not reminders, not the inbox), without Velocity's own. */
export async function appleListCalendars(login: AppleLogin, home: string, ownUrl: string | null): Promise<ACal[]> {
  const res = await dav(login, home, "PROPFIND", PROPFIND("<d:displayname/><d:resourcetype/><a:calendar-color/><c:supported-calendar-component-set/>"), { Depth: "1" });
  const own = ownUrl ? new URL(ownUrl).pathname : null;
  return responses(await xml(res))
    .filter((r) => /<(?:[\w-]+:)?calendar\b/i.test(inner(r.props, "resourcetype") ?? ""))
    .filter((r) => { const set = inner(r.props, "supported-calendar-component-set"); return set === null || /VEVENT/i.test(set); })
    .map((r) => ({ url: new URL(r.href, home).toString(), name: unxml((inner(r.props, "displayname") ?? "").trim()), color: (inner(r.props, "calendar-color") ?? "").trim() }))
    .filter((c) => new URL(c.url).pathname !== own && c.name !== CALENDAR_NAME)
    .map((c) => ({ id: c.url, name: c.name || "Calendar", color: /^#[0-9a-f]{6}/i.test(c.color) ? c.color.slice(0, 7) : null, primary: false }));
}

export async function appleCreateCalendar(login: AppleLogin, home: string) {
  const url = `${home.replace(/\/?$/, "/")}velocity-training-${randomBytes(4).toString("hex")}/`;
  const body = `<?xml version="1.0" encoding="utf-8"?><c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:set><d:prop><d:displayname>${xmlText(CALENDAR_NAME)}</d:displayname><a:calendar-color>#2459FEFF</a:calendar-color><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`;
  const res = await dav(login, url, "MKCALENDAR", body);
  if (res.status !== 201 && !res.ok) throw new CalError(res.status, "mkcalendar", (await res.text()).slice(0, 200));
  return url;
}
export async function appleCalendarExists(login: AppleLogin, url: string) {
  const res = await dav(login, url, "PROPFIND", PROPFIND("<d:resourcetype/>"), { Depth: "0" });
  if (res.status === 404) return false;
  await xml(res);
  return true;
}
export async function appleDeleteCalendar(login: AppleLogin, url: string) {
  const res = await dav(login, url, "DELETE");
  if (res.ok || res.status === 404) return;
  throw new CalError(res.status, String(res.status), (await res.text()).slice(0, 200));
}

/** Each session is one .ics file in the calendar; its file name comes from the session id, so it is never doubled. */
export function appleWriter(login: AppleLogin, calendarUrl: string, tz: string, appUrl: string): Writer {
  const host = (() => { try { return new URL(appUrl).host; } catch { return "velocityathletes.com"; } })();
  const fileOf = (id: string) => `${calendarUrl.replace(/\/?$/, "/")}vel-${id.replace(/[^\w.-]/g, "_")}.ics`;
  return {
    async put(s, existing) {
      const url = existing || fileOf(s.id);
      const res = await dav(login, url, "PUT", icsSingle(s, tz, appUrl, host));
      // the calendar itself is gone (deleted in iCloud): CalDAV answers 404 or 409 for a file in a missing folder
      if (res.status === 404 || res.status === 409) throw new CalError(404, "calendar_gone", "The Velocity training calendar is gone.");
      if (!res.ok) throw new CalError(res.status, String(res.status), (await res.text()).slice(0, 200));
      return url;
    },
    async del(eventId) {
      const res = await dav(login, eventId, "DELETE");
      if (res.ok || res.status === 404) return;
      throw new CalError(res.status, String(res.status), (await res.text()).slice(0, 200));
    },
  };
}

// ---------- reading events ----------
const icsUtcBasic = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** "20261103T083000Z" / "20261103T083000" with TZID / "20261103" (all-day) → RawEvent times. */
function icsTime(value: string, params: string): { dateTime?: string; date?: string } {
  const v = value.trim();
  if (/VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return {};
  const date = `${m[1]}-${m[2]}-${m[3]}`, time = `${m[4]}:${m[5]}`;
  if (m[7]) return { dateTime: `${date}T${time}:${m[6]}Z` };
  const tzid = /TZID=("?)([^;:"]+)\1/i.exec(params)?.[2];
  return { dateTime: (tzid && validZone(tzid) ? zonedToUtc(date, time, tzid) : new Date(`${date}T${time}:${m[6]}Z`)).toISOString() };
}
/** "PT1H30M" / "P1D" → milliseconds */
function durationMs(d: string) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(d.trim());
  if (!m) return 0;
  return (((Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * 24 + Number(m[4] ?? 0)) * 60 + Number(m[5] ?? 0)) * 60000 + Number(m[6] ?? 0) * 1000;
}
/** The VEVENTs of an .ics text as RawEvents (cancelled ones left out). */
export function parseIcsEvents(ics: string, fallbackId: string): RawEvent[] {
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: RawEvent[] = [];
  let cur: Record<string, { v: string; p: string }> | null = null;
  // an alarm inside an event has its own SUMMARY and DESCRIPTION: skip it
  let alarm = false;
  for (const line of lines) {
    if (/^BEGIN:VALARM/i.test(line)) { alarm = true; continue; }
    if (/^END:VALARM/i.test(line)) { alarm = false; continue; }
    if (alarm) continue;
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line) && cur) {
      const st = cur.DTSTART, title = cur.SUMMARY?.v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1") || "Busy";
      if (st && !/CANCELLED/i.test(cur.STATUS?.v ?? "")) {
        const start = icsTime(st.v, st.p);
        let end = cur.DTEND ? icsTime(cur.DTEND.v, cur.DTEND.p) : {};
        if (!end.dateTime && !end.date && cur.DURATION && start.dateTime) end = { dateTime: new Date(Date.parse(start.dateTime) + durationMs(cur.DURATION.v)).toISOString() };
        if (!end.dateTime && !end.date) end = start.date ? { date: start.date } : start;
        const id = `${cur.UID?.v ?? fallbackId}${cur["RECURRENCE-ID"] ? `:${cur["RECURRENCE-ID"].v}` : `:${st.v}`}`;
        if (start.dateTime || start.date) out.push({ id, title, start, end: end.date && start.date && end.date === start.date ? { date: end.date } : end });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/i.exec(line);
    if (m) cur[m[1].toUpperCase()] = { p: m[2], v: m[3] };
  }
  // an all-day event whose end equals its start lasts one day: end is the next day (exclusive), like Google's
  return out.map((e) => (e.start.date && e.end.date === e.start.date ? { ...e, end: { date: nextDate(e.start.date) } } : e));
}
const nextDate = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Events between two instants. iCloud expands repeating events into single occurrences (CalDAV "expand"). */
export async function appleListEvents(login: AppleLogin, calendarUrl: string, timeMin: string, timeMax: string): Promise<RawEvent[]> {
  const a = icsUtcBasic(timeMin), b = icsUtcBasic(timeMax);
  const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-data><c:expand start="${a}" end="${b}"/></c:calendar-data></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${a}" end="${b}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
  const res = await dav(login, calendarUrl, "REPORT", body, { Depth: "1" });
  return responses(await xml(res)).flatMap((r) => { const data = inner(r.props, "calendar-data"); return data ? parseIcsEvents(unxml(data), r.href) : []; });
}
