// POST /api/calendar/link { on, apple?, tz?, sessions? } — creates the calendar link (a private .ics address for
// any calendar app) or turns it off. A new link always gets a new secret, so turning it off and on again stops anyone
// who had the old address. `apple`: "Apple Calendar with one tap" — the existing link is kept (an iPhone may already
// be subscribed to it), the row is marked as set up from the Apple row, and the sessions sent along are saved at once
// so the calendar is full the moment Apple first opens the link.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { athlete, cleanSessions, cleanZone, feedUrl, loadRow, missingTable, saveRow, type CalendarRow } from "@/lib/calendar/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saves the row; before supabase/schema-calendar-accounts.sql has run, the Apple columns are left out. */
async function save(sb: SupabaseClient, uid: string, patch: Partial<CalendarRow>) {
  try { await saveRow(sb, uid, patch); }
  catch (e) {
    if (!/apple_feed|feed_seen_at/.test(String((e as Error).message))) throw e;
    const rest = { ...patch };
    delete rest.apple_feed; delete rest.feed_seen_at;
    await saveRow(sb, uid, rest);
  }
}

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { on?: boolean; apple?: boolean; tz?: unknown; sessions?: unknown; sig?: unknown };
  try {
    const row = await loadRow(me.sb, me.uid);
    if (body.on) {
      const keep = body.apple === true && row?.feed_token;
      const token = keep ? row!.feed_token! : randomBytes(24).toString("base64url");
      // the plan goes in at once; with its fingerprint the app knows the link is up to date (Google and others,
      // if connected, are already synced or catch up on the next change)
      const fill = body.apple === true && Array.isArray(body.sessions) ? { sessions: cleanSessions(body.sessions), tz: cleanZone(body.tz), synced_at: new Date().toISOString() } : {};
      const sig = body.apple === true && typeof body.sig === "string" && row?.sig === body.sig ? body.sig : null;
      await save(me.sb, me.uid, { feed_token: token, sig, ...fill, apple_feed: body.apple === true, ...(keep ? {} : { feed_seen_at: null }) });
      return NextResponse.json({ link: feedUrl(req.nextUrl.origin, token) });
    }
    if (row?.google_token) await save(me.sb, me.uid, { feed_token: null, apple_feed: false, feed_seen_at: null });
    else if (row) await me.sb.from("calendar_links").delete().eq("user_id", me.uid);
    return NextResponse.json({ link: null });
  } catch (e) {
    console.error("[calendar/link]", e);
    return NextResponse.json({ error: missingTable(e) ? "Calendar is not set up on this site yet." : "Did not save. Try again." }, { status: 500 });
  }
}
