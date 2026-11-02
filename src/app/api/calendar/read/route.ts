// POST /api/calendar/read { provider?, show?, write?, calendars? } — one connected calendar's switches: "Show my
// events on Plan" and which of its calendars that shows, and (Outlook and Apple) "Add my training". Google's
// training switch is the connection itself. Turning a switch off stops Velocity reading or writing there; the
// permission stays until the athlete disconnects.
import { NextResponse, type NextRequest } from "next/server";
import { athlete, isProvider, loadAccounts, loadRow, saveAccount, saveRow, type AccountRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown; show?: unknown; write?: unknown; calendars?: unknown };
  const calendars = Array.isArray(body.calendars) ? body.calendars.filter((c): c is string => typeof c === "string").slice(0, 50).map((c) => c.slice(0, 500)) : undefined;
  try {
    if (isProvider(body.provider)) {
      const a = (await loadAccounts(me.sb, me.uid)).find((x) => x.provider === body.provider);
      if (!a) return NextResponse.json({ error: "That calendar is not connected." }, { status: 400 });
      const patch: Partial<AccountRow> = {};
      if (typeof body.show === "boolean") patch.show_events = body.show;
      // turned back on: forget the last fingerprint so the app sends the plan again right away
      if (typeof body.write === "boolean") { patch.write_training = body.write; if (body.write && !a.write_training) patch.sig = null; }
      if (calendars) patch.read_calendars = calendars;
      await saveAccount(me.sb, me.uid, a.provider, patch);
      return NextResponse.json({ ok: true });
    }
    const row = await loadRow(me.sb, me.uid);
    if (!row?.google_token) return NextResponse.json({ error: "Google Calendar is not connected." }, { status: 400 });
    const patch: { show_events?: boolean; read_calendars?: string[] } = {};
    if (typeof body.show === "boolean") patch.show_events = body.show;
    if (calendars) patch.read_calendars = calendars;
    await saveRow(me.sb, me.uid, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[calendar/read]", e);
    return NextResponse.json({ error: "Did not save. Try again." }, { status: 500 });
  }
}
