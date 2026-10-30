// GET /api/calendar/events?from=2026-11-02&to=2026-11-08&tz=Europe/Berlin — the athlete's other Google Calendar
// events for the Plan page, read live from Google and never stored. Only when "Show my other events" is on.
// GET /api/calendar/events?list=1 — the athlete's calendars, for choosing which ones to show.
import { NextResponse, type NextRequest } from "next/server";
import { GoogleError, accessFrom, canRead, listCalendars, listEvents, unseal } from "@/lib/calendar/google";
import { nextDay, piecesOf, zonedToUtc, type OtherCalendar, type OtherEvent } from "@/lib/calendar/events";
import { athlete, cleanZone, loadRow, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

export async function GET(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const listOnly = p.get("list") === "1";
  const from = p.get("from") ?? "", to = p.get("to") ?? "", tz = cleanZone(p.get("tz"));
  if (!listOnly && (!DATE.test(from) || !DATE.test(to) || to < from || Date.parse(to) - Date.parse(from) > 42 * DAY_MS)) return NextResponse.json({ error: "Bad dates" }, { status: 400 });
  const noStore = { headers: { "Cache-Control": "no-store" } };
  try {
    const row = await loadRow(me.sb, me.uid);
    if (!row?.google_token || !canRead(row.google_scopes) || (!listOnly && !row.show_events)) return NextResponse.json({ calendars: [], events: [], off: true }, noStore);
    const access = await accessFrom(unseal(row.google_token));
    const all = await listCalendars(access, row.google_calendar_id);
    const chosen = row.read_calendars;
    const calendars: OtherCalendar[] = all.map((c) => ({ id: c.id, name: c.name, color: c.color, primary: c.primary, on: chosen ? chosen.includes(c.id) : c.selected }));
    if (listOnly) return NextResponse.json({ calendars }, noStore);
    const timeMin = zonedToUtc(from, "00:00", tz).toISOString(), timeMax = zonedToUtc(nextDay(to), "00:00", tz).toISOString();
    const shown = calendars.filter((c) => c.on).slice(0, 12);
    const lists = await Promise.all(shown.map((c) => listEvents(access, c.id, timeMin, timeMax).then((items) => items.map((e) => ({ ...e, cal: c.name, color: c.color }))).catch((e) => { console.error("[calendar/events]", c.id, e); return []; })));
    const events: OtherEvent[] = lists.flat().flatMap((e) => piecesOf(e, tz, from, to)).sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
    return NextResponse.json({ calendars, events }, noStore);
  } catch (e) {
    console.error("[calendar/events]", e);
    if (e instanceof GoogleError && (/invalid_grant/.test(e.reason) || e.status === 401)) {
      try { await saveRow(me.sb, me.uid, { google_status: "error", google_error: "Google access was removed. Connect again." }); } catch { /* ignore */ }
      return NextResponse.json({ error: "Google access was removed. Connect again." }, { status: 200 });
    }
    return NextResponse.json({ error: "Your Google events did not load." }, { status: 200 });
  }
}
