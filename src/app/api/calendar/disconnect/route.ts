// POST /api/calendar/disconnect { provider?, remove } — ends one calendar connection. Google (the default): withdraws
// Velocity's access at Google and forgets the token. Outlook or Apple: forgets the stored sign-in. With `remove`, the
// "Velocity training" calendar is deleted from that account first.
import { NextResponse, type NextRequest } from "next/server";
import { accessFrom, deleteCalendar, revoke, unseal } from "@/lib/calendar/google";
import { openAccount } from "@/lib/calendar/accounts";
import { athlete, dropAccount, isProvider, loadAccounts, loadRow, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { remove, provider } = (await req.json().catch(() => ({}))) as { remove?: boolean; provider?: unknown };
  try {
    if (isProvider(provider)) {
      const a = (await loadAccounts(me.sb, me.uid)).find((x) => x.provider === provider);
      if (!a) return NextResponse.json({ ok: true });
      let removed = false;
      if (remove && a.calendar_id && a.secret) {
        try { await (await openAccount(a)).deleteCalendar(a.calendar_id); removed = true; }
        catch (e) { console.error("[calendar/disconnect]", provider, e); }
      }
      // Microsoft has no way for an app to withdraw its own access; the athlete can do it at account.microsoft.com.
      // Apple: the athlete can delete the app-specific password at account.apple.com.
      await dropAccount(me.sb, me.uid, provider);
      return NextResponse.json({ ok: true, removed });
    }
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
