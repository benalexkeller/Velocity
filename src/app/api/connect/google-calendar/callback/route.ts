// GET /api/connect/google-calendar/callback — Google sends the athlete back here. Turns the one-time code into a
// refresh token (stored encrypted), makes or reuses the "Velocity training" calendar, then returns to the app,
// which fills the calendar on its next sync. When the athlete asked to see their other events and Google allowed
// it, the Plan page starts showing them.
import { NextResponse, type NextRequest } from "next/server";
import { CALENDAR_SCOPE, accessFrom, calendarExists, canRead, createCalendar, exchangeCode, googleOn, revoke, seal } from "@/lib/calendar/google";
import { STATE_COOKIE, athlete, loadRow, missingTable, safeNext, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let saved: { state?: string; tz?: string; next?: string; read?: boolean } = {};
  try { saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}"); } catch { saved = {}; }
  const next = safeNext(saved.next ?? null);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}calendar=${flag}`, req.nextUrl.origin));
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/api/connect/google-calendar" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (!googleOn()) return back("off");
  if (q.get("error")) return back("denied");
  if (!saved.state || q.get("state") !== saved.state || !q.get("code")) return back("error");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const tz = saved.tz || "UTC";
  try {
    const t = await exchangeCode(q.get("code")!, `${req.nextUrl.origin}/api/connect/google-calendar/callback`);
    // Google lets people untick boxes on its consent screen: without the calendar box there is nothing to do
    if (!t.scopes.split(/\s+/).includes(CALENDAR_SCOPE)) { if (!t.refresh) return back("scope"); await revoke(t.refresh); return back("scope"); }
    if (!t.refresh) return back("error");
    const row = await loadRow(me.sb, me.uid).catch((e) => { if (missingTable(e)) throw e; return null; });
    // connecting again (to allow reading events, another Google account, or after an error): keep the old calendar
    // when this token can still reach it, otherwise start a new one. The old token is not withdrawn here: at
    // Google that would withdraw the new permission too, because both belong to the same grant.
    let calendarId: string | null = null, keepMap = false;
    if (row?.google_calendar_id && (await calendarExists(t.access, row.google_calendar_id).catch(() => false))) { calendarId = row.google_calendar_id; keepMap = true; }
    if (!calendarId) calendarId = await createCalendar(t.access || (await accessFrom(t.refresh)), tz);
    const read = canRead(t.scopes);
    await saveRow(me.sb, me.uid, {
      google_token: seal(t.refresh), google_email: t.email, google_calendar_id: calendarId, google_status: "connected", google_error: null,
      google_scopes: t.scopes, ...(saved.read ? { show_events: read } : {}),
      ...(keepMap ? {} : { event_map: {} }), sig: null, tz,
    });
    return back(saved.read && !read ? "readscope" : saved.read ? "reading" : "connected");
  } catch (e) {
    console.error("[connect/google-calendar]", e);
    return back(missingTable(e) ? "setup" : "error");
  }
}
