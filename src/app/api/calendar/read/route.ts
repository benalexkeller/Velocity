// POST /api/calendar/read { show?, calendars? } — the "Show my other events" switch and which calendars it shows.
// Turning it off stops Velocity reading the events; Google's permission stays until the athlete disconnects.
import { NextResponse, type NextRequest } from "next/server";
import { athlete, loadRow, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { show?: unknown; calendars?: unknown };
  try {
    const row = await loadRow(me.sb, me.uid);
    if (!row?.google_token) return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 400 });
    const patch: { show_events?: boolean; read_calendars?: string[] } = {};
    if (typeof body.show === "boolean") patch.show_events = body.show;
    if (Array.isArray(body.calendars)) patch.read_calendars = body.calendars.filter((c): c is string => typeof c === "string").slice(0, 50).map((c) => c.slice(0, 200));
    await saveRow(me.sb, me.uid, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[calendar/read]", e);
    return NextResponse.json({ error: "Did not save. Try again." }, { status: 500 });
  }
}
