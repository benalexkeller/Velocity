// Server only. Moves WHOOP data into an athlete's account: the history at connect time and on "Sync now", and
// single records when WHOOP's webhook says one was scored or deleted.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessLost, freshToken, type TokenRow } from "./tokens";
import { activityId, deleteWorkout, markConnection, saveBodyDays, saveWorkouts, type BodyIn } from "./import";
import { WhoopError, cycleToBody, recoveryToBody, sleepToBody, whoopCycle, whoopList, whoopRecoveryOfCycle, whoopRefresh, whoopSleep, whoopWorkout, workoutToActivity, type WhoopCycle, type WhoopEvent, type WhoopRecovery, type WhoopSleep, type WhoopWorkout } from "./whoop";

export interface WhoopRow extends TokenRow { external_user_id: string | null; status: string }

/** A working access token, or AccessLost when WHOOP no longer accepts the refresh token. */
export async function whoopToken(sb: SupabaseClient, row: WhoopRow) {
  try { return await freshToken(sb, row, async (r) => { const t = await whoopRefresh(r); return { a: t.a, r: t.r, e: t.e }; }); }
  catch (e) {
    if (e instanceof WhoopError && (e.status === 400 || e.status === 401)) throw new AccessLost("whoop", "WHOOP access was removed. Connect again.");
    throw e;
  }
}

/** Last `days` days of workouts, sleeps, recoveries and day strain. */
export async function whoopSyncHistory(sb: SupabaseClient, uid: string, row: WhoopRow, days: number) {
  const access = await whoopToken(sb, row);
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const [workouts, sleeps, recoveries, cycles] = await Promise.all([
    whoopList<WhoopWorkout>(access, "workout", start.toISOString(), end.toISOString()),
    whoopList<WhoopSleep>(access, "sleep", start.toISOString(), end.toISOString()),
    whoopList<WhoopRecovery>(access, "recovery", start.toISOString(), end.toISOString()),
    whoopList<WhoopCycle>(access, "cycle", start.toISOString(), end.toISOString()),
  ]);
  const acts = workouts.map(workoutToActivity).filter((a): a is NonNullable<typeof a> => !!a);
  const bySleep = new Map(sleeps.map((s) => [s.id, s]));
  const body: BodyIn[] = [
    ...sleeps.map(sleepToBody),
    ...recoveries.map((r) => { const s = bySleep.get(r.sleep_id); return s ? recoveryToBody(r, s) : null; }),
    ...cycles.map(cycleToBody),
  ].filter((b): b is BodyIn => !!b);
  const saved = await saveWorkouts(sb, uid, "whoop", acts);
  const bodyDays = await saveBodyDays(sb, uid, "whoop", body);
  const now = new Date().toISOString();
  await markConnection(sb, uid, "whoop", "direct", { synced_at: now, last_event_at: now, status: "connected", error: null });
  return { workouts: saved, bodyDays, since: start.toISOString().slice(0, 10) };
}

/** One webhook event. Returns a short note for the log. */
export async function whoopHandleEvent(sb: SupabaseClient, uid: string, row: WhoopRow, ev: WhoopEvent): Promise<string> {
  const id = String(ev.id);
  if (ev.type === "workout.deleted") { await deleteWorkout(sb, uid, activityId("wh", id)); return "workout deleted"; }
  if (ev.type === "sleep.deleted" || ev.type === "recovery.deleted") return "ignored (body values stay)";
  const access = await whoopToken(sb, row);
  let note = "ignored";
  if (ev.type === "workout.updated") {
    const a = workoutToActivity(await whoopWorkout(access, id));
    if (a) { await saveWorkouts(sb, uid, "whoop", [a]); note = `workout ${a.sport} ${a.min} min`; }
  } else if (ev.type === "sleep.updated") {
    const s = await whoopSleep(access, id);
    const b = sleepToBody(s);
    if (b) { await saveBodyDays(sb, uid, "whoop", [b]); note = `sleep ${b.date}`; } else note = s.nap ? "nap" : "sleep not scored yet";
  } else if (ev.type === "recovery.updated") {
    // v2 recovery events carry the sleep's id; the recovery itself is read through its cycle
    const s = await whoopSleep(access, id);
    const rows: BodyIn[] = [];
    if (s.cycle_id != null) {
      const r = await whoopRecoveryOfCycle(access, s.cycle_id);
      const b = recoveryToBody(r, s);
      if (b) rows.push(b);
      const c = cycleToBody(await whoopCycle(access, s.cycle_id).catch(() => null as unknown as WhoopCycle));
      if (c) rows.push(c);
    }
    if (rows.length) { await saveBodyDays(sb, uid, "whoop", rows); note = `recovery ${rows[0].date}`; } else note = "recovery not scored yet";
  }
  const now = new Date().toISOString();
  await markConnection(sb, uid, "whoop", "direct", { last_event_at: now, status: "connected", error: null });
  return note;
}
