// POST /api/connect/apple { appleId, password } — connects Apple Calendar (iCloud). Apple has no sign-in screen for
// apps: the athlete makes an app-specific password at account.apple.com and enters it here once with their Apple ID.
// The server checks it with iCloud, stores it encrypted, and makes or reuses the "Velocity training" calendar.
import { NextResponse, type NextRequest } from "next/server";
import { sealApple } from "@/lib/calendar/accounts";
import { appleCalendarExists, appleCreateCalendar, appleDiscover } from "@/lib/calendar/apple";
import { CalError } from "@/lib/calendar/engine";
import { athlete, loadAccounts, saveAccount } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const missing = (e: unknown) => /calendar_accounts|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));
const keyOn = () => Boolean(process.env.CALENDAR_TOKEN_KEY || process.env.GOOGLE_CLIENT_SECRET);

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!keyOn()) return NextResponse.json({ error: "Apple Calendar is not set up on this site yet." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { appleId?: unknown; password?: unknown };
  const user = typeof body.appleId === "string" ? body.appleId.trim().slice(0, 200) : "";
  // Apple shows app-specific passwords as xxxx-xxxx-xxxx-xxxx: typed with spaces or without dashes, it is put back
  // into that form; anything else is sent as it is
  const typed = typeof body.password === "string" ? body.password.trim().slice(0, 100) : "";
  const letters = typed.replace(/[\s-]+/g, "");
  const pass = /^[a-z]{16}$/i.test(letters) ? letters.toLowerCase().match(/.{4}/g)!.join("-") : typed;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return NextResponse.json({ error: "Enter the email address of your Apple ID." }, { status: 400 });
  if (pass.length < 8) return NextResponse.json({ error: "Enter the app-specific password from account.apple.com." }, { status: 400 });
  const login = { user, pass };
  try {
    const { home } = await appleDiscover(login);
    const old = (await loadAccounts(me.sb, me.uid)).find((a) => a.provider === "apple");
    let calendarId: string | null = null, keepMap = false;
    if (old?.calendar_id && (await appleCalendarExists(login, old.calendar_id).catch(() => false))) { calendarId = old.calendar_id; keepMap = true; }
    if (!calendarId) calendarId = await appleCreateCalendar(login, home);
    await saveAccount(me.sb, me.uid, "apple", {
      email: user, secret: sealApple(login), calendar_id: calendarId, home, status: "connected", error: null,
      write_training: old ? old.write_training : true, show_events: old ? old.show_events : true,
      ...(keepMap ? {} : { event_map: {}, read_calendars: null }), sig: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof CalError && e.status === 401) {
      const plain = !/^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i.test(pass);
      return NextResponse.json({ error: plain ? "Apple did not accept it. Use an app-specific password (four groups of four letters), not your normal Apple ID password." : "Apple did not accept that Apple ID and app-specific password. Check both and try again." }, { status: 400 });
    }
    if (missing(e)) return NextResponse.json({ error: "Calendar is not set up on this site yet." }, { status: 500 });
    console.error("[connect/apple]", e);
    return NextResponse.json({ error: "iCloud did not answer. Try again in a minute." }, { status: 502 });
  }
}
