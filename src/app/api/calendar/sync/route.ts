// POST /api/calendar/sync { tz, from, sig, sessions } — the app sends its sessions after every change. Saved as the
// list the calendar link serves; when Google Calendar is connected, the "Velocity training" calendar is made equal
// to it. A long first sync stops after ~40 s and reports `remaining`; the app calls again until it is 0.
import { NextResponse, type NextRequest } from "next/server";
import { GoogleError, accessFrom, createCalendar, syncEvents, unseal, type EventMap } from "@/lib/calendar/google";
import { athlete, cleanSessions, cleanZone, loadRow, missingTable, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tz = cleanZone(body.tz);
  const list = cleanSessions(body.sessions);
  const from = typeof body.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.from) ? body.from : "0000-00-00";
  const sig = typeof body.sig === "string" ? body.sig.slice(0, 40) : null;
  try {
    const row = await loadRow(me.sb, me.uid);
    if (!row || (!row.google_token && !row.feed_token)) return NextResponse.json({ linked: false });
    const now = new Date().toISOString();
    if (!row.google_token) {
      await saveRow(me.sb, me.uid, { sessions: list, tz, sig, synced_at: now });
      return NextResponse.json({ linked: true, added: 0, updated: 0, removed: 0, remaining: 0 });
    }
    // Google Calendar: a fresh access token from the stored refresh token
    let access: string;
    try { access = await accessFrom(unseal(row.google_token)); }
    catch (e) {
      // invalid_grant: the athlete removed Velocity's access in their Google account, or the token expired
      const why = e instanceof GoogleError && /invalid_grant/.test(e.reason) ? "Google access was removed. Connect again." : "Google did not answer. Try again later.";
      await saveRow(me.sb, me.uid, { sessions: list, tz, google_status: e instanceof GoogleError && /invalid_grant/.test(e.reason) ? "error" : row.google_status, google_error: why });
      return NextResponse.json({ linked: true, error: why, remaining: 0 }, { status: 200 });
    }
    let calendarId = row.google_calendar_id, map: EventMap = row.event_map ?? {};
    if (!calendarId) { calendarId = await createCalendar(access, tz); map = {}; }
    const r = await syncEvents({ access, calendarId, list, tz, from, map, appUrl: req.nextUrl.origin, full: body.full === true });
    if (r.calendarGone) {
      // the athlete deleted the calendar in Google: make a new one and fill it on the next call
      const fresh = await createCalendar(access, tz);
      await saveRow(me.sb, me.uid, { google_calendar_id: fresh, event_map: {}, sessions: list, tz, sig: null, google_status: "connected", google_error: null });
      return NextResponse.json({ linked: true, added: 0, updated: 0, removed: 0, remaining: list.length });
    }
    await saveRow(me.sb, me.uid, {
      google_calendar_id: calendarId, event_map: r.map, sessions: list, tz, google_status: "connected", google_error: null,
      // the fingerprint is kept only once everything is in Google, so an unfinished sync is picked up again
      sig: r.remaining ? null : sig, synced_at: r.remaining ? row.synced_at : now,
    });
    return NextResponse.json({ linked: true, added: r.added, updated: r.updated, removed: r.removed, remaining: r.remaining });
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ linked: false, error: "Calendar is not set up on this site yet." });
    console.error("[calendar/sync]", e);
    const lost = e instanceof GoogleError && (e.status === 401 || e.status === 403);
    if (lost) { try { await saveRow(me.sb, me.uid, { google_status: "error", google_error: "Google access was removed. Connect again." }); } catch { /* ignore */ } }
    return NextResponse.json({ linked: true, error: lost ? "Google access was removed. Connect again." : "The calendar did not update. It tries again on the next change.", remaining: 0 });
  }
}
