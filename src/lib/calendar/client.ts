"use client";
// The calendar in the browser: one shared status (GET /api/calendar) for every component that shows it, the
// actions behind the buttons, and the queue that sends the plan to /api/calendar/sync after a change.
import { useSyncExternalStore } from "react";
import { listPrint, type CalSession, type CalendarStatus } from "./events";
import { workoutFor, type Zones } from "../workout";
import type { Week } from "../data";
import { addDays, today, ymd } from "../format";

export interface CalendarState {
  status: CalendarStatus | null;
  syncing: boolean;
  /** Last sync result or error, for the Profile card. */
  note: string | null;
}
let state: CalendarState = { status: null, syncing: false, note: null };
const subs = new Set<() => void>();
const set = (p: Partial<CalendarState>) => { state = { ...state, ...p }; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useCalendar = () => useSyncExternalStore(subscribe, () => state, () => state);

export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
export const isLinked = (s: CalendarStatus | null) => Boolean(s && (s.connection || s.link));

export async function refreshCalendar() {
  try {
    const res = await fetch("/api/calendar", { cache: "no-store" });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) set({ status: (await res.json()) as CalendarStatus });
  } catch { /* offline: keep what we had */ }
}

/** Leaves the app for Google's permission screen; Google brings the athlete back to `next`. */
export function connectGoogle(next?: string) {
  const back = next ?? window.location.pathname;
  // a full page load on purpose: the route answers with a redirect to Google, which the client router cannot follow
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href =`/api/connect/google-calendar?tz=${encodeURIComponent(browserZone())}&next=${encodeURIComponent(back)}`;
}

export async function disconnectGoogle(remove: boolean) {
  const res = await fetch("/api/calendar/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ remove }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Did not disconnect");
  set({ note: remove ? "Disconnected. The Velocity training calendar was deleted from Google." : "Disconnected. The Velocity training calendar stays in Google with the sessions it has." });
  await refreshCalendar();
}

export async function setCalendarLink(on: boolean) {
  const res = await fetch("/api/calendar/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }) });
  const body = (await res.json().catch(() => ({}))) as { link?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Did not save");
  await refreshCalendar();
  return body.link ?? null;
}

// ---------- what goes into the calendar ----------
export interface SyncPayload { tz: string; from: string; sessions: CalSession[]; sig: string; /** rewrite every event, not only changed ones */ full?: boolean }

/** Every session from two weeks ago to the end of the plan (rest days left out), with its steps. */
export function calendarPayload(weeks: Week[], zones: Zones): SyncPayload {
  const tz = browserZone();
  const from = ymd(addDays(today(), -14));
  const sessions: CalSession[] = [];
  for (const w of weeks) for (const s of w.sessions) {
    if (s.sport === "rest" || s.date < from || !(s.min > 0)) continue;
    let steps: string[] = [];
    try { steps = workoutFor(s, zones).steps; } catch { steps = []; }
    sessions.push({ id: s.id, date: s.date, ...(s.start ? { start: s.start } : {}), min: s.min, sport: s.sport, title: s.title, detail: s.detail, steps });
  }
  return { tz, from, sessions, sig: listPrint(sessions, tz) };
}

// ---------- sending it: one request at a time, always the newest list ----------
let pending: SyncPayload | null = null;
let running = false;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function queueSync(p: SyncPayload) {
  pending = p;
  if (!running) void drain();
}

async function drain() {
  running = true;
  set({ syncing: true });
  try {
    while (pending) {
      const p = pending; pending = null;
      // a long first sync comes back with `remaining`; call again with the same list until it is done
      for (let round = 0; round < 12; round++) {
        let r: { linked?: boolean; remaining?: number; error?: string; added?: number; updated?: number; removed?: number } = {};
        try {
          const res = await fetch("/api/calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
          r = await res.json();
        } catch { r = { error: "The calendar did not update. It tries again on the next change." }; }
        if (r.error) { set({ note: r.error }); break; }
        if (!r.linked) break;
        if (!r.remaining) {
          set({ note: null, status: state.status ? { ...state.status, sig: p.sig, syncedAt: new Date().toISOString() } : state.status });
          break;
        }
        if (pending) break; // a newer list is waiting: send that instead
        // the events already rewritten are now up to date; the next round only does what is left
        if (p.full) p.full = false;
        await wait(1500);
      }
    }
  } finally {
    running = false;
    set({ syncing: false });
    await refreshCalendar();
  }
}
