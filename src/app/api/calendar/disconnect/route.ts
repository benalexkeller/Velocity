// POST /api/calendar/disconnect { remove } — ends the Google Calendar connection: withdraws Velocity's access at
// Google and forgets the token. With `remove`, the "Velocity training" calendar is deleted from Google first.
import { NextResponse, type NextRequest } from "next/server";
import { accessFrom, deleteCalendar, revoke, unseal } from "@/lib/calendar/google";
import { athlete, loadRow, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { remove } = (await req.json().catch(() => ({}))) as { remove?: boolean };
  try {
    const row = await loadRow(me.sb, me.uid);
    if (!row?.google_token) return NextResponse.json({ ok: true });
    let removed = false;
    try {
      const refresh = unseal(row.google_token);
      if (remove && row.google_calendar_id) { await deleteCalendar(await accessFrom(refresh), row.google_calendar_id); removed = true; }
      await revoke(refresh);
    } catch (e) { console.error("[calendar/disconnect]", e); }
    if (row.feed_token) await saveRow(me.sb, me.uid, { google_token: null, google_email: null, google_calendar_id: null, google_status: null, google_error: null, google_scopes: null, show_events: false, read_calendars: null, event_map: {} });
    else await me.sb.from("calendar_links").delete().eq("user_id", me.uid);
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    console.error("[calendar/disconnect]", e);
    return NextResponse.json({ error: "Did not disconnect. Try again." }, { status: 500 });
  }
}
