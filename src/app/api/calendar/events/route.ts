// GET /api/calendar/events?from=2026-11-02&to=2026-11-08&tz=Europe/Berlin — the athlete's other events for the Plan
// page, from every connected calendar (Google, Outlook, Apple) where "Show my events" is on. Read live and never
// stored. GET /api/calendar/events?list=1&provider=google|outlook|apple — that account's calendars, for choosing
// which ones to show.
import { NextResponse, type NextRequest } from "next/server";
import { GoogleError, accessFrom, canRead, listCalendars, listEvents, unseal } from "@/lib/calendar/google";
import { lostMessage, openAccount } from "@/lib/calendar/accounts";
import { PROVIDER_NAME, nextDay, piecesOf, zonedToUtc, type OtherCalendar, type OtherEvent, type RawEvent } from "@/lib/calendar/events";
import { athlete, cleanZone, isProvider, loadAccounts, loadRow, saveAccount, saveRow, type AccountRow, type CalendarRow } from "@/lib/calendar/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;
const noStore = { headers: { "Cache-Control": "no-store" } };

/** Outlook and Apple have no "shown in my calendar app" flag: everything except birthdays and holidays starts on. */
const startsOn = (name: string) => !/birthday|holiday|geburtstag|feiertag/i.test(name);

interface Source {
  name: string;
  calendars(): Promise<OtherCalendar[]>;
  events(cal: OtherCalendar, timeMin: string, timeMax: string): Promise<RawEvent[]>;
  /** called when the account stopped working: records it and returns what the athlete reads */
  lost(e: unknown): Promise<string | null>;
}
/** An error whose message is already written for the athlete. */
class Shown extends Error {}

async function googleSource(sb: SupabaseClient, uid: string, row: CalendarRow): Promise<Source> {
  const lost = async (e: unknown) => {
    if (e instanceof GoogleError && (/invalid_grant/.test(e.reason) || e.status === 401)) {
      try { await saveRow(sb, uid, { google_status: "error", google_error: "Google access was removed. Connect again." }); } catch { /* ignore */ }
      return "Google access was removed. Connect again.";
    }
    return null;
  };
  let access: string;
  try { access = await accessFrom(unseal(row.google_token!)); }
  catch (e) { throw new Shown((await lost(e)) ?? "Your Google events did not load."); }
  return {
    name: PROVIDER_NAME.google,
    calendars: async () => (await listCalendars(access, row.google_calendar_id)).map((c) => ({ id: c.id, name: c.name, color: c.color, primary: c.primary, on: row.read_calendars ? row.read_calendars.includes(c.id) : c.selected })),
    events: (c, a, b) => listEvents(access, c.id, a, b),
    lost,
  };
}

async function accountSource(sb: SupabaseClient, uid: string, a: AccountRow): Promise<Source> {
  const name = PROVIDER_NAME[a.provider];
  const lost = async (e: unknown) => {
    const m = lostMessage(a.provider, e);
    if (m) { try { await saveAccount(sb, uid, a.provider, { status: "error", error: m }); } catch { /* ignore */ } }
    return m;
  };
  let acc: Awaited<ReturnType<typeof openAccount>>;
  try { acc = await openAccount(a); }
  catch (e) { throw new Shown((await lost(e)) ?? `Your ${name} events did not load.`); }
  if (acc.newSecret) { try { await saveAccount(sb, uid, a.provider, { secret: acc.newSecret }); } catch { /* the old one still works */ } }
  return {
    name,
    calendars: async () => (await acc.listCalendars(a.calendar_id)).map((c) => ({ ...c, on: a.read_calendars ? a.read_calendars.includes(c.id) : startsOn(c.name) })),
    events: (c, x, y) => acc.listEvents(c.id, x, y),
    lost,
  };
}

export async function GET(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const listOnly = p.get("list") === "1";
  const from = p.get("from") ?? "", to = p.get("to") ?? "", tz = cleanZone(p.get("tz"));
  if (!listOnly && (!DATE.test(from) || !DATE.test(to) || to < from || Date.parse(to) - Date.parse(from) > 42 * DAY_MS)) return NextResponse.json({ error: "Bad dates" }, { status: 400 });

  // ---------- one account's calendars ----------
  if (listOnly) {
    const provider = p.get("provider") ?? "google";
    try {
      let src: Source | null = null;
      if (provider === "google") {
        const row = await loadRow(me.sb, me.uid);
        if (row?.google_token && canRead(row.google_scopes)) src = await googleSource(me.sb, me.uid, row);
      } else if (isProvider(provider)) {
        const a = (await loadAccounts(me.sb, me.uid)).find((x) => x.provider === provider);
        if (a?.secret) src = await accountSource(me.sb, me.uid, a);
      }
      if (!src) return NextResponse.json({ calendars: [] }, noStore);
      try { return NextResponse.json({ calendars: await src.calendars() }, noStore); }
      catch (e) { console.error("[calendar/events] list", provider, e); return NextResponse.json({ error: (await src.lost(e)) ?? `Your ${src.name} calendars did not load.` }, noStore); }
    } catch (e) {
      console.error("[calendar/events] list", provider, e);
      return NextResponse.json({ error: e instanceof Shown ? e.message : "Your calendars did not load." }, noStore);
    }
  }

  // ---------- every account's events for the dates asked ----------
  try {
    const [row, accounts] = await Promise.all([loadRow(me.sb, me.uid), loadAccounts(me.sb, me.uid)]);
    const opens: Promise<Source>[] = [];
    if (row?.google_token && canRead(row.google_scopes) && row.show_events && row.google_status !== "error") opens.push(googleSource(me.sb, me.uid, row));
    for (const a of accounts) if (a.show_events && a.status !== "error" && a.secret) opens.push(accountSource(me.sb, me.uid, a));
    if (!opens.length) return NextResponse.json({ events: [], off: true }, noStore);

    const timeMin = zonedToUtc(from, "00:00", tz).toISOString(), timeMax = zonedToUtc(nextDay(to), "00:00", tz).toISOString();
    const errors: string[] = [];
    const per = await Promise.all(opens.map(async (open) => {
      let src: Source;
      try { src = await open; }
      catch (e) { console.error("[calendar/events]", e); errors.push(e instanceof Shown ? e.message : "Some of your events did not load."); return []; }
      try {
        const shown = (await src.calendars()).filter((c) => c.on).slice(0, 12);
        const lists = await Promise.all(shown.map((c) => src.events(c, timeMin, timeMax).then((items) => items.map((e) => ({ ...e, cal: c.name, color: c.color }))).catch((e) => { console.error("[calendar/events]", src.name, e); return []; })));
        return lists.flat();
      } catch (e) {
        console.error("[calendar/events]", src.name, e);
        errors.push((await src.lost(e)) ?? `Your ${src.name} events did not load.`);
        return [];
      }
    }));
    const events: OtherEvent[] = per.flat().flatMap((e) => piecesOf(e, tz, from, to)).sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
    return NextResponse.json({ events, ...(errors.length ? { error: errors[0] } : {}) }, noStore);
  } catch (e) {
    console.error("[calendar/events]", e);
    return NextResponse.json({ error: "Your events did not load." }, noStore);
  }
}
