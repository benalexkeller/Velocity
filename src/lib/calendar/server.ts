// Server only: the signed-in athlete and their calendar_links row (supabase/schema-calendar.sql).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { validZone, type CalSession } from "./events";
import type { EventMap } from "./google";

export interface CalendarRow {
  user_id: string;
  google_token: string | null;
  google_email: string | null;
  google_calendar_id: string | null;
  google_status: "connected" | "error" | null;
  google_error: string | null;
  event_map: EventMap;
  feed_token: string | null;
  sessions: CalSession[];
  tz: string | null;
  sig: string | null;
  synced_at: string | null;
}

/** The signed-in athlete with a database client acting as them, or null (signed out / accounts off). */
export async function athlete(): Promise<{ sb: SupabaseClient; uid: string; email: string | null } | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ? { sb, uid: data.user.id, email: data.user.email ?? null } : null;
}

export async function loadRow(sb: SupabaseClient, uid: string): Promise<CalendarRow | null> {
  const { data, error } = await sb.from("calendar_links").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CalendarRow | null) ?? null;
}

export async function saveRow(sb: SupabaseClient, uid: string, patch: Partial<CalendarRow>) {
  const { error } = await sb.from("calendar_links").upsert({ user_id: uid, ...patch, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** The table does not exist yet: supabase/schema-calendar.sql has not been run. */
export const missingTable = (e: unknown) => /calendar_links|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

/** Remembers the sign-in attempt (state, time zone, page to return to) between leaving for Google and coming back. */
export const STATE_COOKIE = "vel_gcal";
export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n.slice(0, 200) : "/profile");

export const feedUrl =(origin: string, token: string | null) => (token ? `${origin}/api/calendar/feed/${token}.ics` : null);

// ---------- input from the browser ----------
const DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^\d{2}:\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
/** Keeps only well-formed sessions; at most 800. */
export function cleanSessions(raw: unknown): CalSession[] {
  if (!Array.isArray(raw)) return [];
  const out: CalSession[] = [];
  for (const r of raw.slice(0, 800)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const id = str(x.id, 100), date = str(x.date, 10), start = str(x.start, 5), min = Number(x.min);
    if (!id || !DATE.test(date) || !Number.isFinite(min) || min < 0 || min > 1440) continue;
    out.push({
      id, date, ...(TIME.test(start) ? { start } : {}), min: Math.round(min),
      sport: str(x.sport, 20), title: str(x.title, 60) || "Session", detail: str(x.detail, 120),
      steps: Array.isArray(x.steps) ? x.steps.slice(0, 30).map((s) => str(s, 300)).filter(Boolean) : [],
    });
  }
  return out;
}
export const cleanZone = (tz: unknown) => (typeof tz === "string" && validZone(tz) ? tz : "UTC");
