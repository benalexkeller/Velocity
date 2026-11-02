// POST /api/calendar/sync { tz, from, sig, sessions } — the app sends its sessions after every change. Saved as the
// list the calendar link serves; Google Calendar's "Velocity training" calendar, and the one in each Outlook or Apple
// account that receives the training, are made equal to it. A long first sync stops after ~40 s in total and reports
// `remaining`; the app calls again until it is 0.
import { NextResponse, type NextRequest } from "next/server";
import { GoogleError, accessFrom, createCalendar, syncEvents, unseal, type EventMap } from "@/lib/calendar/google";
import { syncAccount } from "@/lib/calendar/engine";
import { lostMessage, openAccount } from "@/lib/calendar/accounts";
import { athlete, cleanSessions, cleanZone, loadAccounts, loadRow, missingTable, saveAccount, saveRow, type AccountRow, type CalendarRow } from "@/lib/calendar/server";
import type { CalSession } from "@/lib/calendar/events";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Part { remaining: number; added: number; updated: number; removed: number; error?: string }
const ZERO: Part = { remaining: 0, added: 0, updated: 0, removed: 0 };

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tz = cleanZone(body.tz);
  const list = cleanSessions(body.sessions);
  const from = typeof body.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.from) ? body.from : "0000-00-00";
  const sig = typeof body.sig === "string" ? body.sig.slice(0, 40) : null;
  const full = body.full === true;
  const appUrl = req.nextUrl.origin;
  const deadline = Date.now() + 40000;
  try {
    const [row, accounts] = await Promise.all([loadRow(me.sb, me.uid), loadAccounts(me.sb, me.uid)]);
    const targets = accounts.filter((a) => a.write_training && a.status !== "error" && a.secret);
    if ((!row || (!row.google_token && !row.feed_token)) && !targets.length) return NextResponse.json({ linked: false });

    const parts: Part[] = [];
    if (row && (row.google_token || row.feed_token)) parts.push(await syncGoogle(me.sb, me.uid, row, { list, tz, from, sig, full, appUrl, budgetMs: Math.max(5000, deadline - Date.now()) }));
    for (const a of targets) {
      if (Date.now() > deadline - 3000) { parts.push({ ...ZERO, remaining: list.length }); continue; }
      parts.push(await syncOne(me.sb, me.uid, a, { list, tz, from, sig, full, appUrl, budgetMs: deadline - Date.now() }));
    }
    const sum = (k: keyof Omit<Part, "error">) => parts.reduce((n, p) => n + p[k], 0);
    const error = parts.find((p) => p.error)?.error;
    return NextResponse.json({ linked: true, added: sum("added"), updated: sum("updated"), removed: sum("removed"), remaining: sum("remaining"), ...(error ? { error } : {}) });
  } catch (e) {
    if (missingTable(e)) return NextResponse.json({ linked: false, error: "Calendar is not set up on this site yet." });
    console.error("[calendar/sync]", e);
    return NextResponse.json({ linked: true, error: "The calendar did not update. It tries again on the next change.", remaining: 0 });
  }
}

interface Opts { list: CalSession[]; tz: string; from: string; sig: string | null; full: boolean; appUrl: string; budgetMs: number }

/** Google Calendar and the calendar link (both live in calendar_links). */
async function syncGoogle(sb: SupabaseClient, uid: string, row: CalendarRow, o: Opts): Promise<Part> {
  const now = new Date().toISOString();
  if (!row.google_token) {
    await saveRow(sb, uid, { sessions: o.list, tz: o.tz, sig: o.sig, synced_at: now });
    return ZERO;
  }
  try {
    // a fresh access token from the stored refresh token
    let access: string;
    try { access = await accessFrom(unseal(row.google_token)); }
    catch (e) {
      // invalid_grant: the athlete removed Velocity's access in their Google account, or the token expired
      const gone = e instanceof GoogleError && /invalid_grant/.test(e.reason);
      const why = gone ? "Google access was removed. Connect again." : "Google did not answer. Try again later.";
      await saveRow(sb, uid, { sessions: o.list, tz: o.tz, google_status: gone ? "error" : row.google_status, google_error: why });
      return { ...ZERO, error: why };
    }
    let calendarId = row.google_calendar_id, map: EventMap = row.event_map ?? {};
    if (!calendarId) { calendarId = await createCalendar(access, o.tz); map = {}; }
    const r = await syncEvents({ access, calendarId, list: o.list, tz: o.tz, from: o.from, map, appUrl: o.appUrl, full: o.full, budgetMs: o.budgetMs });
    if (r.calendarGone) {
      // the athlete deleted the calendar in Google: make a new one and fill it on the next call
      const fresh = await createCalendar(access, o.tz);
      await saveRow(sb, uid, { google_calendar_id: fresh, event_map: {}, sessions: o.list, tz: o.tz, sig: null, google_status: "connected", google_error: null });
      return { ...ZERO, remaining: o.list.length };
    }
    await saveRow(sb, uid, {
      google_calendar_id: calendarId, event_map: r.map, sessions: o.list, tz: o.tz, google_status: "connected", google_error: null,
      // the fingerprint is kept only once everything is in Google, so an unfinished sync is picked up again
      sig: r.remaining ? null : o.sig, synced_at: r.remaining ? row.synced_at : now,
    });
    return { remaining: r.remaining, added: r.added, updated: r.updated, removed: r.removed };
  } catch (e) {
    console.error("[calendar/sync] google", e);
    const lost = e instanceof GoogleError && (e.status === 401 || e.status === 403);
    if (lost) { try { await saveRow(sb, uid, { google_status: "error", google_error: "Google access was removed. Connect again." }); } catch { /* ignore */ } }
    return { ...ZERO, error: lost ? "Google access was removed. Connect again." : "The calendar did not update. It tries again on the next change." };
  }
}

/** One Outlook or Apple account that receives the training. */
async function syncOne(sb: SupabaseClient, uid: string, a: AccountRow, o: Opts): Promise<Part> {
  const name = a.provider === "outlook" ? "Outlook" : "Apple Calendar";
  try {
    const acc = await openAccount(a);
    if (acc.newSecret) await saveAccount(sb, uid, a.provider, { secret: acc.newSecret });
    let calendarId = a.calendar_id, map = a.event_map ?? {};
    if (!calendarId) { calendarId = await acc.createCalendar(); map = {}; }
    const r = await syncAccount(acc.writer(calendarId, o.tz, o.appUrl), { list: o.list, tz: o.tz, from: o.from, map, full: o.full, budgetMs: o.budgetMs });
    if (r.calendarGone) {
      // deleted by hand in Outlook or iCloud: make a new one and fill it on the next call
      const fresh = await acc.createCalendar();
      await saveAccount(sb, uid, a.provider, { calendar_id: fresh, event_map: {}, sig: null, status: "connected", error: null });
      return { ...ZERO, remaining: o.list.length };
    }
    const now = new Date().toISOString();
    await saveAccount(sb, uid, a.provider, { calendar_id: calendarId, event_map: r.map, status: "connected", error: null, sig: r.remaining ? null : o.sig, synced_at: r.remaining ? a.synced_at : now });
    return { remaining: r.remaining, added: r.added, updated: r.updated, removed: r.removed };
  } catch (e) {
    console.error(`[calendar/sync] ${a.provider}`, e);
    const lost = lostMessage(a.provider, e);
    if (lost) { try { await saveAccount(sb, uid, a.provider, { status: "error", error: lost }); } catch { /* ignore */ } }
    return { ...ZERO, error: lost ?? `${name} did not update. It tries again on the next change.` };
  }
}
