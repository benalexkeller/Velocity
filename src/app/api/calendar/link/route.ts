// POST /api/calendar/link { on } — creates the calendar link (a private .ics address for Apple Calendar, Outlook
// and others) or turns it off. A new link always gets a new secret, so turning it off and on again stops anyone
// who had the old address.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { athlete, feedUrl, loadRow, missingTable, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
  try {
    const row = await loadRow(me.sb, me.uid);
    if (on) {
      const token = randomBytes(24).toString("base64url");
      await saveRow(me.sb, me.uid, { feed_token: token, sig: null });
      return NextResponse.json({ link: feedUrl(req.nextUrl.origin, token) });
    }
    if (row?.google_token) await saveRow(me.sb, me.uid, { feed_token: null });
    else if (row) await me.sb.from("calendar_links").delete().eq("user_id", me.uid);
    return NextResponse.json({ link: null });
  } catch (e) {
    console.error("[calendar/link]", e);
    return NextResponse.json({ error: missingTable(e) ? "Calendar is not set up on this site yet." : "Did not save. Try again." }, { status: 500 });
  }
}
