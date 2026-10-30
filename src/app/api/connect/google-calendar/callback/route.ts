// GET /api/connect/google-calendar/callback — Google sends the athlete back here. Turns the one-time code into a
// refresh token (stored encrypted), makes or reuses the "Velocity training" calendar, then returns to the app,
// which fills the calendar on its next sync.
import { NextResponse, type NextRequest } from "next/server";
import { CALENDAR_SCOPE, accessFrom, calendarExists, createCalendar, exchangeCode, googleOn, revoke, seal, unseal } from "@/lib/calendar/google";
import { STATE_COOKIE, athlete, loadRow, missingTable, safeNext, saveRow } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let saved: { state?: string; tz?: string; next?: string } = {};
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
    // Google lets people untick the calendar box on its consent screen: without it there is nothing to do
    if (!t.scopes.split(/\s+/).includes(CALENDAR_SCOPE)) { await revoke(t.refresh ?? t.access); return back("scope"); }
    if (!t.refresh) return back("error");
    const row = await loadRow(me.sb, me.uid).catch((e) => { if (missingTable(e)) throw e; return null; });
    // connecting again (another Google account, or after an error): keep the old calendar when this token can still
    // reach it, otherwise start a new one; the old token is withdrawn
    let calendarId: string | null = null, keepMap = false;
    if (row?.google_calendar_id && (await calendarExists(t.access, row.google_calendar_id).catch(() => false))) { calendarId = row.google_calendar_id; keepMap = true; }
    if (row?.google_token) { try { const old = unseal(row.google_token); if (old !== t.refresh) await revoke(old); } catch { /* old token unreadable */ } }
    if (!calendarId) calendarId = await createCalendar(t.access || (await accessFrom(t.refresh)), tz);
    await saveRow(me.sb, me.uid, {
      google_token: seal(t.refresh), google_email: t.email, google_calendar_id: calendarId, google_status: "connected", google_error: null,
      ...(keepMap ? {} : { event_map: {} }), sig: null, tz,
    });
    return back("connected");
  } catch (e) {
    console.error("[connect/google-calendar]", e);
    return back(missingTable(e) ? "setup" : "error");
  }
}
