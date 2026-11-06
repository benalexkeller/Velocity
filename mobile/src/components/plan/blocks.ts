// Calendar maths shared by the Schedule views: times, overlaps, clashes and the coach's suggested free time.
import type { Session } from "@shared/data";
import { classOf } from "@shared/nutrition/targets";
import type { OtherEvent } from "@/lib/calendar";

export const toMin = (hm: string | undefined, dflt = 6 * 60) => { const m = hm?.match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : dflt; };
export const toHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
/** Long or hard sessions: the ones a week is built around. */
export const isKey = (s: Session) => s.sport !== "rest" && s.sport !== "strength" && classOf(s) === "key";

export interface Slot { start: number; end: number; title: string }
/** What already fills a day: timed calendar events and other sessions (not the one being placed). */
export function busyOn(date: string, events: OtherEvent[], sessions: Session[], skipId?: string): Slot[] {
  const out: Slot[] = [];
  for (const e of events) if (e.date === date && !e.allDay && e.start) out.push({ start: toMin(e.start), end: toMin(e.end, toMin(e.start) + 60), title: e.title || "Busy" });
  for (const s of sessions) if (s.date === date && s.id !== skipId && s.sport !== "rest") { const a = toMin(s.actual?.start ?? s.start); out.push({ start: a, end: a + (s.actual?.min ?? s.min), title: s.title }); }
  return out;
}
export const clashOf = (start: number, min: number, busy: Slot[]) => busy.find((b) => start < b.end && start + min > b.start) ?? null;

/** The coach's pick: the free time closest to where the athlete wanted it, between 05:00 and 21:00, on 15-minute steps. */
export function suggestTime(want: number, min: number, busy: Slot[]): number | null {
  let best: number | null = null;
  for (let t = 5 * 60; t + min <= 21 * 60; t += 15) if (!clashOf(t, min, busy) && (best == null || Math.abs(t - want) < Math.abs(best - want))) best = t;
  return best;
}

/** Side-by-side lanes for items that overlap in one day column, as Google Calendar does. */
export function lanes<T extends { start: number; end: number }>(items: T[]): (T & { lane: number; of: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; of: number })[] = [];
  let group: (T & { lane: number; of: number })[] = [], groupEnd = -1;
  const close = () => { const n = Math.max(1, ...group.map((g) => g.lane + 1)); for (const g of group) g.of = n; out.push(...group); group = []; };
  for (const it of sorted) {
    if (group.length && it.start >= groupEnd) close();
    const used = new Set(group.filter((g) => g.end > it.start).map((g) => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ ...it, lane, of: 1 });
    groupEnd = Math.max(groupEnd, it.end);
  }
  if (group.length) close();
  return out;
}

export const fmtGap = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}` : `${min} min`);
