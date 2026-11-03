// Server only. Writes what a maker sent into the athlete's own tables, the same way for every maker:
//  - activities: one row per workout; when two makers recorded the same workout (a run on a Garmin watch that WHOOP
//    also logged), the maker earlier in ACTIVITY_PRIORITY counts and the other row is kept but excluded (dup_of).
//    An athlete who un-excludes a row keeps both from then on (dup_of = 'keep').
//  - body_metrics: one row per day; each value remembers which maker set it (src), and a maker lower in
//    BODY_PRIORITY for that value never overwrites a higher one.
// Works with the athlete's own session (RLS) or the service role (webhooks).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sport } from "@/lib/data";
import { ACTIVITY_PRIORITY, BODY_PRIORITY, type Source } from "./providers";

/** A workout as a maker's adapter hands it over: Velocity's activity without the bookkeeping fields. */
export interface WorkoutIn {
  id: string; externalId?: string; date: string; start?: string; sport: Sport; name: string; min: number;
  mi?: number; yd?: number; pace_s?: number; mph?: number; p100_s?: number; hr?: number; elev_ft?: number;
  route?: [number, number][]; kcal?: number; strain?: number; note?: string;
}
/** One day's body values from a maker; only the values it measured. */
export interface BodyIn { date: string; rhr?: number; hrv?: number; sleep_h?: number; sleep_score?: number; stress?: number; vo2?: number; recovery?: number; strain?: number; weight_kg?: number }
type BodyKey = keyof Omit<BodyIn, "date">;

const M_PER_MI = 1609.344, M_PER_YD = 0.9144, FT_PER_M = 3.28084;

/** Distance and pace fields from metres and seconds, the way Velocity stores them (miles, yards, s/mi, mph, s/100 yd). */
export function paceFields(sport: Sport, metres: number | null | undefined, secs: number): Partial<WorkoutIn> {
  if (!metres || metres <= 0) return {};
  if (sport === "swim") { const yd = Math.round(metres / M_PER_YD); return { yd, ...(secs > 0 && yd > 0 ? { p100_s: Math.round(secs / (yd / 100)) } : {}) }; }
  const mi = Math.round((metres / M_PER_MI) * 100) / 100;
  if (secs <= 0 || mi <= 0) return { mi };
  return sport === "bike" ? { mi, mph: Math.round((mi / (secs / 3600)) * 10) / 10 } : { mi, pace_s: Math.round(secs / mi) };
}
export const feetOf = (metres: number | null | undefined) => (typeof metres === "number" && metres > 0 ? Math.round(metres * FT_PER_M) : undefined);

/** Local date and clock time of an instant, given the offset from UTC in seconds. */
export function localClock(epochSeconds: number, offsetSeconds: number) {
  const d = new Date((epochSeconds + offsetSeconds) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, start: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}
/** "-05:00" → -18000 */
export const offsetSeconds = (tz: string | null | undefined) => { const m = /^([+-])(\d{2}):(\d{2})$/.exec(tz ?? ""); return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 3600 + Number(m[3]) * 60) : 0; };

/** Thins a track to about `keep` points for the route map. */
export function thinRoute(pts: [number, number][], keep = 120): [number, number][] | undefined {
  const ok = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
  if (ok.length < 2) return undefined;
  const step = Math.max(1, Math.floor(ok.length / keep));
  return ok.filter((_, k) => k % step === 0 || k === ok.length - 1);
}

const rank = (s: string) => { const i = ACTIVITY_PRIORITY.indexOf(s as Source); return i < 0 ? ACTIVITY_PRIORITY.length : i; };
const mins = (start?: string | null) => { const m = /^(\d{2}):(\d{2})/.exec(start ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

interface ActRow { id: string; date: string; start: string | null; sport: string; min: number; source: string; excluded: boolean; dup_of: string | null }

/** Two workouts from different makers that are the same session: start within 20 minutes, lengths within a factor of 2. */
export function sameSession(a: ActRow, b: ActRow) {
  if (a.source === b.source || a.source === "manual" || b.source === "manual") return false;
  const sa = mins(a.start), sb = mins(b.start);
  if (sa == null || sb == null) return false;
  if (Math.abs(sa - sb) > 20) return false;
  const lo = Math.min(a.min, b.min), hi = Math.max(a.min, b.min);
  return lo >= 1 && hi / lo <= 2;
}

/** Saves a maker's workouts into the athlete's activities, then settles duplicates on the days touched.
 *  Returns how many rows were written. */
export async function saveWorkouts(sb: SupabaseClient, uid: string, source: Source, list: WorkoutIn[]): Promise<number> {
  if (!list.length) return 0;
  // what the athlete already has for these ids: their own notes and choices must survive a re-import
  const ids = list.map((w) => w.id);
  const { data: had } = await sb.from("activities").select("id, note, exertion, coach_note, excluded, dup_of, route").eq("user_id", uid).in("id", ids);
  const old = new Map(((had ?? []) as { id: string; note: string | null; exertion: number | null; coach_note: string | null; excluded: boolean; dup_of: string | null; route: [number, number][] | null }[]).map((r) => [r.id, r]));
  const rows = list.map((w) => {
    const o = old.get(w.id);
    return {
      user_id: uid, id: w.id, external_id: w.externalId ?? null, date: w.date, start: w.start ?? null, sport: w.sport, name: w.name.slice(0, 80), min: Math.max(1, Math.round(w.min)),
      mi: w.mi ?? null, yd: w.yd ?? null, pace_s: w.pace_s ?? null, mph: w.mph ?? null, p100_s: w.p100_s ?? null, hr: w.hr ?? null, elev_ft: w.elev_ft ?? null,
      // a route that arrived earlier (activity details) stays when a later copy of the summary has none
      route: w.route ?? o?.route ?? null, kcal: w.kcal ?? null, strain: w.strain ?? null, source,
      // the maker's note only when the athlete has not written their own
      note: o?.note ?? w.note ?? null, exertion: o?.exertion ?? null, coach_note: o?.coach_note ?? null,
      excluded: o?.excluded ?? false, dup_of: o?.dup_of ?? null,
    };
  });
  const { error } = await sb.from("activities").upsert(rows, { onConflict: "user_id,id" });
  if (error) throw new Error(error.message);
  for (const date of new Set(rows.map((r) => r.date))) await settleDay(sb, uid, date);
  return rows.length;
}

/** Marks duplicates between makers on one day. Idempotent. */
export async function settleDay(sb: SupabaseClient, uid: string, date: string) {
  const { data } = await sb.from("activities").select("id, date, start, sport, min, source, excluded, dup_of").eq("user_id", uid).eq("date", date);
  const rows = ((data ?? []) as ActRow[]).filter((r) => r.source !== "manual");
  if (rows.length < 2) return;
  // group overlapping sessions; within a group the best-ranked (then longest) counts
  const groups: ActRow[][] = [];
  for (const r of rows) {
    const g = groups.find((grp) => grp.some((x) => sameSession(x, r)));
    if (g) g.push(r); else groups.push([r]);
  }
  for (const g of groups) {
    if (g.length < 2) continue;
    const winner = [...g].sort((a, b) => rank(a.source) - rank(b.source) || b.min - a.min)[0];
    for (const r of g) {
      const shouldExclude = r.id !== winner.id;
      if (r.dup_of === "keep") continue; // the athlete decided
      if (shouldExclude && (!r.excluded || r.dup_of !== winner.id)) await sb.from("activities").update({ excluded: true, dup_of: winner.id }).eq("user_id", uid).eq("id", r.id);
      // a former loser that now counts (a better maker's copy was deleted, or it is the winner now)
      if (!shouldExclude && r.dup_of && r.excluded) await sb.from("activities").update({ excluded: false, dup_of: null }).eq("user_id", uid).eq("id", r.id);
    }
  }
}

/** Deletes a maker's workout (the maker said it was deleted), and lets a duplicate count again. */
export async function deleteWorkout(sb: SupabaseClient, uid: string, id: string) {
  const { data } = await sb.from("activities").select("date").eq("user_id", uid).eq("id", id).maybeSingle();
  if (!data) return;
  await sb.from("activities").delete().eq("user_id", uid).eq("id", id);
  // rows that were excluded because of this one
  await sb.from("activities").update({ excluded: false, dup_of: null }).eq("user_id", uid).eq("dup_of", id);
  await settleDay(sb, uid, String(data.date));
}

/** Saves a maker's daily body values, keeping values from makers that measure them better. */
export async function saveBodyDays(sb: SupabaseClient, uid: string, source: Source, days: BodyIn[]): Promise<number> {
  // one entry per date: a maker's sleep, recovery and strain for the same morning arrive as separate entries
  const byDate = new Map<string, BodyIn>();
  for (const d of days) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue; byDate.set(d.date, { ...(byDate.get(d.date) ?? { date: d.date }), ...d }); }
  const clean = [...byDate.values()];
  if (!clean.length) return 0;
  const { data } = await sb.from("body_metrics").select("*").eq("user_id", uid).in("date", clean.map((d) => d.date));
  const cur = new Map(((data ?? []) as (Record<string, unknown> & { date: string })[]).map((r) => [String(r.date), r]));
  const rows: Record<string, unknown>[] = [];
  for (const d of clean) {
    const have = cur.get(d.date);
    const src: Record<string, string> = { ...((have?.src as Record<string, string> | undefined) ?? {}) };
    const row: Record<string, unknown> = { user_id: uid, date: d.date };
    let changed = false;
    for (const k of Object.keys(d) as (keyof BodyIn)[]) {
      if (k === "date") continue;
      const v = d[k as BodyKey];
      if (v == null || !Number.isFinite(v)) continue;
      const order = BODY_PRIORITY[k as BodyKey] ?? [];
      const mine = order.indexOf(source);
      if (mine < 0) continue; // this maker does not write this value
      const owner = src[k];
      const theirs = owner ? order.indexOf(owner as Source) : Number.MAX_SAFE_INTEGER;
      if (have && have[k] != null && owner && theirs < mine) continue; // a better maker set it
      row[k] = k === "sleep_h" || k === "vo2" || k === "strain" || k === "weight_kg" ? Math.round(v * 10) / 10 : Math.round(v);
      src[k] = source;
      changed = true;
    }
    if (!changed) continue;
    row.src = src;
    rows.push(row);
  }
  if (!rows.length) return 0;
  // one row at a time: each carries only the columns it changes, and upsert would null the rest
  for (const row of rows) {
    const { user_id, date, ...patch } = row;
    const { error } = cur.has(String(date))
      ? await sb.from("body_metrics").update(patch).eq("user_id", user_id).eq("date", date)
      : await sb.from("body_metrics").upsert(row, { onConflict: "user_id,date" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/** Keeps an activity id stable and safe: "wh-<uuid>", "ga-<summaryId>", "ap-<uuid>". */
export const activityId = (prefix: string, external: string) => `${prefix}-${String(external).replace(/[^\w.-]/g, "_").slice(0, 80)}`;

/** The activity a session is: text from any maker → Velocity's sports. */
export function sportOfText(text: string): Sport {
  const s = text.toLowerCase();
  if (/swim|pool|open.?water/.test(s)) return "swim";
  if (/bik|cycl|ride|spin|velo|mtb|gravel|peloton/.test(s)) return "bike";
  if (/run|jog|treadmill|track|trail/.test(s)) return "run";
  if (/strength|weight|gym|crossfit|lift|functional|hiit|pilates|yoga|core/.test(s)) return "strength";
  if (/hik|walk|mountain|climb/.test(s)) return "hike";
  return "other";
}

/** A row for the maker's connection; `patch` is merged over the existing row. */
export async function markConnection(sb: SupabaseClient, uid: string, provider: string, via: string, patch: Record<string, unknown>) {
  const { error } = await sb.from("integrations").upsert({ user_id: uid, provider, via, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}
