// Server only. Keeps one calendar equal to the plan, for any calendar that can write and delete single events
// (Outlook, Apple). Same rules as Google's syncEvents in google.ts: only new or changed sessions are written, events
// of sessions that are gone are deleted from `from` on (past weeks stay), a time budget, and errors that end the run.
// Relative imports only, so test scripts can load it with plain Node.
import { sessionPrint, type CalSession } from "./events";

/** An answer from Outlook or Apple that is not a success. `reason` is short and stable ("calendar_gone", "auth"…). */
export class CalError extends Error {
  constructor(public status: number, public reason: string, message: string) { super(message); }
}

/** What is in the calendar, per session id: fingerprint, the session's date, and the event's id in that calendar. */
export type AccountMap = Record<string, { h: string; d: string; e?: string }>;

export interface Writer {
  /** Writes one session. `existing` is its event id from an earlier run (rewrite it, or add it again if it is gone).
   *  Returns the event id now in the calendar. Throws CalError 404 "calendar_gone" when the calendar itself is gone. */
  put(s: CalSession, existing: string | undefined): Promise<string>;
  /** Deletes one event; an event that is already gone counts as deleted. */
  del(eventId: string): Promise<void>;
}

export interface AccountSync { map: AccountMap; added: number; updated: number; removed: number; remaining: number; calendarGone?: boolean }

export async function syncAccount(w: Writer, opts: { list: CalSession[]; tz: string; from: string; map: AccountMap; full?: boolean; budgetMs?: number; parallel?: number }): Promise<AccountSync> {
  const map: AccountMap = { ...opts.map };
  const deadline = Date.now() + (opts.budgetMs ?? 40000);
  const ids = new Set(opts.list.map((s) => s.id));
  type Job = { kind: "put"; s: CalSession; h: string } | { kind: "del"; id: string };
  const jobs: Job[] = [];
  for (const s of opts.list) { const h = sessionPrint(s, opts.tz); if (opts.full || map[s.id]?.h !== h) jobs.push({ kind: "put", s, h }); }
  for (const [id, v] of Object.entries(map)) if (!ids.has(id) && v.d >= opts.from) jobs.push({ kind: "del", id });

  const out: AccountSync = { map, added: 0, updated: 0, removed: 0, remaining: 0 };
  let stop: CalError | null = null;
  let left = jobs.length;
  const run = async (j: Job) => {
    if (j.kind === "del") {
      const e = map[j.id]?.e;
      if (e) await w.del(e);
      delete map[j.id]; out.removed++;
      return;
    }
    const had = map[j.s.id];
    const e = await w.put(j.s, had?.e);
    if (had) out.updated++; else out.added++;
    map[j.s.id] = { h: j.h, d: j.s.date, e };
  };
  let next = 0;
  const worker = async () => {
    while (!stop && next < jobs.length && Date.now() < deadline) {
      const j = jobs[next++];
      try { await run(j); left--; }
      catch (e) {
        if (e instanceof CalError && e.reason === "calendar_gone") { out.calendarGone = true; stop = e; return; }
        if (e instanceof CalError && (e.status === 401 || e.status === 403 || e.status === 429 || e.status >= 500)) { stop = e; return; }
        // one bad event must not stop the rest; it is tried again next time because its fingerprint was not saved
        console.error("[calendar] event", e);
        left--;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.parallel ?? 4) }, worker));
  out.remaining = left;
  const s = stop as CalError | null;
  // signed out, or the permission was taken away: the athlete has to connect again
  if (s && !out.calendarGone && (s.status === 401 || (s.status === 403 && !/rate|quota|limit|throttl/i.test(s.reason)))) throw s;
  return out;
}
