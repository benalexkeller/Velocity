// GET /api/calendar — what the calendar section shows: whether Google Calendar can be connected on this site,
// the athlete's connection, the calendar link, and the fingerprint of the last sync.
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { canRead, googleOn } from "@/lib/calendar/google";
import { athlete, feedUrl, loadRow, missingTable } from "@/lib/calendar/server";
import type { CalendarStatus } from "@/lib/calendar/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base: CalendarStatus = { accounts: ACCOUNTS_ON, google: googleOn(), ready: false, connection: null, link: null, sig: null, syncedAt: null };
  const me = await athlete();
  if (!me) return NextResponse.json(base);
  try {
    const row = await loadRow(me.sb, me.uid);
    return NextResponse.json({
      ...base, ready: true,
      connection: row?.google_token ? {
        email: row.google_email, status: row.google_status === "error" ? "error" : "connected", error: row.google_error,
        canRead: canRead(row.google_scopes), showEvents: canRead(row.google_scopes) && !!row.show_events,
      } : null,
      link: feedUrl(req.nextUrl.origin, row?.feed_token ?? null),
      sig: row?.sig ?? null, syncedAt: row?.synced_at ?? null,
    } satisfies CalendarStatus);
  } catch (e) {
    if (!missingTable(e)) console.error("[calendar]", e);
    return NextResponse.json(base);
  }
}
