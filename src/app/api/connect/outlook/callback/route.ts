// GET /api/connect/outlook/callback — Microsoft sends the athlete back here. Turns the one-time code into a refresh
// token (stored encrypted), makes or reuses the "Velocity training" calendar in their Outlook, then returns to the
// app, which fills the calendar on its next sync.
import { NextResponse, type NextRequest } from "next/server";
import { seal } from "@/lib/calendar/google";
import { outlookCalendarExists, outlookCreateCalendar, outlookExchange, outlookOn } from "@/lib/calendar/outlook";
import { athlete, loadAccounts, safeNext, saveAccount } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vel_ocal";
const missing = (e: unknown) => /calendar_accounts|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

export async function GET(req: NextRequest) {
  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(req.cookies.get(COOKIE)?.value ?? "{}"); } catch { saved = {}; }
  const next = safeNext(saved.next ?? null);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}calendar=${flag}`, req.nextUrl.origin));
    res.cookies.set(COOKIE, "", { maxAge: 0, path: "/api/connect/outlook" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (!outlookOn()) return back("outlook-off");
  // the athlete pressed Cancel or No on Microsoft's screen
  if (q.get("error")) return back(q.get("error") === "access_denied" ? "outlook-denied" : "outlook-error");
  if (!saved.state || q.get("state") !== saved.state || !q.get("code")) return back("outlook-error");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  try {
    const t = await outlookExchange(q.get("code")!, `${req.nextUrl.origin}/api/connect/outlook/callback`);
    if (!t.refresh || !t.access) return back("outlook-error");
    if (!/Calendars\.ReadWrite/i.test(t.scopes)) return back("outlook-scope");
    const old = (await loadAccounts(me.sb, me.uid)).find((a) => a.provider === "outlook");
    // connecting again (another Microsoft account, or after an error): keep the old calendar when it is still there
    let calendarId: string | null = null, keepMap = false;
    if (old?.calendar_id && (await outlookCalendarExists(t.access, old.calendar_id).catch(() => false))) { calendarId = old.calendar_id; keepMap = true; }
    if (!calendarId) calendarId = await outlookCreateCalendar(t.access);
    await saveAccount(me.sb, me.uid, "outlook", {
      email: t.email, secret: seal(t.refresh), calendar_id: calendarId, home: null, status: "connected", error: null,
      write_training: old ? old.write_training : true, show_events: old ? old.show_events : true,
      ...(keepMap ? {} : { event_map: {}, read_calendars: null }), sig: null,
    });
    return back("outlook-connected");
  } catch (e) {
    console.error("[connect/outlook]", e);
    return back(missing(e) ? "setup" : "outlook-error");
  }
}
