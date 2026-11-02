// GET /api/calendar — what the Calendars section shows: which calendars can be connected on this site, the athlete's
// Google, Outlook and Apple connections, the calendar link, and the fingerprint of the last complete sync.
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { canRead, googleOn } from "@/lib/calendar/google";
import { outlookOn } from "@/lib/calendar/outlook";
import { athlete, feedUrl, loadAccounts, loadRow, missingTable } from "@/lib/calendar/server";
import type { AccountStatus, CalendarStatus } from "@/lib/calendar/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apple needs nothing from Apple on the server, only the key that encrypts the app password. */
const appleOn = () => Boolean(process.env.CALENDAR_TOKEN_KEY || process.env.GOOGLE_CLIENT_SECRET);

export async function GET(req: NextRequest) {
  const base: CalendarStatus = { accounts: ACCOUNTS_ON, google: googleOn(), outlookOn: outlookOn(), appleOn: appleOn(), other: { outlook: null, apple: null }, ready: false, connection: null, link: null, appleFeed: null, linkSeenAt: null, sig: null, syncedAt: null };
  const me = await athlete();
  if (!me) return NextResponse.json(base);
  try {
    const [row, accounts] = await Promise.all([loadRow(me.sb, me.uid), loadAccounts(me.sb, me.uid)]);
    const other: CalendarStatus["other"] = { outlook: null, apple: null };
    for (const a of accounts) {
      other[a.provider] = { email: a.email, status: a.status === "error" ? "error" : "connected", error: a.error, write: a.write_training, show: a.show_events, syncedAt: a.synced_at } satisfies AccountStatus;
    }
    // every place the plan goes must have the same list for the app to skip a sync: Google and the calendar link
    // share calendar_links.sig, each Outlook or Apple account that receives the training has its own
    const sigs: (string | null)[] = [];
    if (row?.google_token || row?.feed_token) sigs.push(row.sig);
    for (const a of accounts) if (a.write_training && a.status !== "error") sigs.push(a.sig);
    const sig = sigs.length && sigs.every((x) => x && x === sigs[0]) ? sigs[0] : null;
    const times = [row?.google_token || row?.feed_token ? row.synced_at : null, ...accounts.filter((a) => a.write_training).map((a) => a.synced_at)].filter((t): t is string => !!t).sort();
    return NextResponse.json({
      ...base, ready: true, other,
      connection: row?.google_token ? {
        email: row.google_email, status: row.google_status === "error" ? "error" : "connected", error: row.google_error,
        canRead: canRead(row.google_scopes), showEvents: canRead(row.google_scopes) && !!row.show_events,
      } : null,
      link: feedUrl(req.nextUrl.origin, row?.feed_token ?? null),
      appleFeed: row?.feed_token && row.apple_feed ? { seenAt: row.feed_seen_at ?? null } : null,
      linkSeenAt: row?.feed_token ? row.feed_seen_at ?? null : null,
      sig, syncedAt: times.length ? times[times.length - 1] : null,
    } satisfies CalendarStatus);
  } catch (e) {
    if (!missingTable(e)) console.error("[calendar]", e);
    return NextResponse.json(base);
  }
}
