// Training sessions as calendar events: the shape the app sends, the event text, the change fingerprint and the
// .ics file behind the calendar link. Pure functions, used by the browser (fingerprint) and the server (everything).
// Relative imports only, so the test script can load this file with plain Node.

/** One session as the app sends it to the server. `start` missing = an all-day event. */
export interface CalSession {
  id: string;
  date: string; // YYYY-MM-DD, the athlete's local date
  start?: string; // "06:30", local
  min: number;
  sport: string;
  title: string; // "Run"
  detail: string; // "Tempo, 70 min"
  steps: string[];
}

export const CALENDAR_NAME = "Velocity training";

/** GET /api/calendar */
export interface CalendarStatus {
  accounts: boolean;
  /** Google Calendar can be connected on this site (client id and secret are set). */
  google: boolean;
  /** The database has the calendar table (supabase/schema-calendar.sql has been run). */
  ready: boolean;
  connection: {
    email: string | null; status: "connected" | "error"; error: string | null;
    /** Google gave Velocity permission to read the athlete's events (the "Show my other events" switch). */
    canRead: boolean;
    /** The athlete's other events are shown on the Plan page. */
    showEvents: boolean;
  } | null;
  link: string | null;
  sig: string | null;
  syncedAt: string | null;
}

/** One of the athlete's own Google calendars, for the "which calendars to show" list. */
export interface OtherCalendar { id: string; name: string; color: string | null; on: boolean; primary: boolean }
/** One of the athlete's other events, cut into one piece per day, in the athlete's time zone. Read-only. */
export interface OtherEvent { id: string; cal: string; title: string; date: string; start?: string; end?: string; allDay: boolean; color: string | null }

/** A UTC instant as the local date and time in `tz`. */
export function utcToLocal(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Google event times → one piece per day between `from` and `to` (inclusive), times local to `tz`. */
export function piecesOf(e: { id: string; cal: string; title: string; color: string | null; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }, tz: string, from: string, to: string): OtherEvent[] {
  const out: OtherEvent[] = [];
  if (e.start.date) {
    // all-day: the end date is the day after the last day
    const last = e.end.date ? addMinutes(e.end.date, "00:00", -1440).date : e.start.date;
    for (let d = e.start.date; d <= last; d = nextDay(d)) if (d >= from && d <= to) out.push({ id: `${e.id}:${d}`, cal: e.cal, title: e.title, date: d, allDay: true, color: e.color });
    return out;
  }
  if (!e.start.dateTime || !e.end.dateTime) return out;
  const a = utcToLocal(new Date(e.start.dateTime), tz), b = utcToLocal(new Date(e.end.dateTime), tz);
  for (let d = a.date; d <= b.date; d = nextDay(d)) {
    const start = d === a.date ? a.time : "00:00";
    const end = d === b.date ? b.time : "24:00";
    if (end === "00:00" && d !== a.date) break; // ends exactly at midnight: nothing on the next day
    if (d >= from && d <= to) out.push({ id: `${e.id}:${d}`, cal: e.cal, title: e.title, date: d, start, end, allDay: false, color: e.color });
  }
  return out;
}

/** Event title: "Run: Tempo, 70 min". */
export const summaryOf = (s: CalSession) => `${s.title}: ${s.detail}`;

/** Event description: the numbered steps, then a link back to the session in the app. */
export function descriptionOf(s: CalSession, appUrl: string) {
  const steps = s.steps.map((x, i) => `${i + 1}. ${x}`).join("\n");
  return `${steps}${steps ? "\n\n" : ""}Open in Velocity: ${appUrl}/plan?session=${encodeURIComponent(s.id)}`;
}

// ---------- local date and time arithmetic (no time zone involved) ----------
const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-11-02" + "23:30" + 90 min → { date: "2026-11-03", time: "01:00" } */
export function addMinutes(date: string, time: string, min: number) {
  const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi) + min * 60000);
  return { date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}` };
}
export function nextDay(date: string) { return addMinutes(date, "00:00", 1440).date; }

/** Milliseconds the zone is ahead of UTC at this instant. */
function zoneOffset(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(utcMs / 1000) * 1000;
}
/** A local wall-clock time in `tz` as a UTC instant (handles summer-time changes). */
export function zonedToUtc(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let utc = naive - zoneOffset(naive, tz);
  const again = naive - zoneOffset(utc, tz);
  if (again !== utc) utc = again;
  return new Date(utc);
}
export function validZone(tz: string | null | undefined) {
  if (!tz) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

// ---------- fingerprint ----------
/** Short, stable fingerprint (FNV-1a, two seeds). Changes whenever anything shown in the event changes. */
export function fingerprint(text: string) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
export const sessionPrint = (s: CalSession, tz: string) => fingerprint(JSON.stringify([tz, s.date, s.start ?? "", s.min, s.title, s.detail, s.steps]));
/** The whole list: lets the browser skip a sync when nothing changed since the last one. */
export const listPrint = (list: CalSession[], tz: string) => fingerprint(JSON.stringify([tz, list.map((s) => [s.id, sessionPrint(s, tz)])]));

// ---------- Google Calendar event body ----------
export function googleEvent(s: CalSession, tz: string, appUrl: string) {
  const timed = !!s.start;
  const end = timed ? addMinutes(s.date, s.start!, Math.max(5, s.min)) : null;
  return {
    summary: summaryOf(s),
    description: descriptionOf(s, appUrl),
    start: timed ? { dateTime: `${s.date}T${s.start}:00`, timeZone: tz } : { date: s.date },
    end: timed ? { dateTime: `${end!.date}T${end!.time}:00`, timeZone: tz } : { date: nextDay(s.date) },
    transparency: "opaque",
    status: "confirmed",
    source: { title: "Velocity", url: `${appUrl}/plan?session=${encodeURIComponent(s.id)}` },
    extendedProperties: { private: { velocitySession: s.id } },
  };
}

// ---------- .ics (calendar link for Apple Calendar, Outlook and others) ----------
const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsUtc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsDate = (ymd: string) => ymd.replace(/-/g, "");
/** Lines longer than 75 bytes continue on the next line after a space (RFC 5545 §3.1). */
function fold(line: string) {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function icsCalendar(list: CalSession[], tz: string, appUrl: string, host: string, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Velocity//Training plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(CALENDAR_NAME)}`, `X-WR-TIMEZONE:${tz}`, "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const s of list) {
    const url = `${appUrl}/plan?session=${encodeURIComponent(s.id)}`;
    lines.push("BEGIN:VEVENT", `UID:${s.id.replace(/[^\w.-]/g, "_")}@${host}`, `DTSTAMP:${icsUtc(now)}`);
    if (s.start) {
      const start = zonedToUtc(s.date, s.start, tz), end = new Date(start.getTime() + Math.max(5, s.min) * 60000);
      lines.push(`DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(end)}`);
    } else lines.push(`DTSTART;VALUE=DATE:${icsDate(s.date)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(s.date))}`);
    lines.push(`SUMMARY:${icsText(summaryOf(s))}`, `DESCRIPTION:${icsText(descriptionOf(s, appUrl))}`, `URL:${url}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
