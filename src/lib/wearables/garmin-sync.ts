// Server only. Moves what Garmin pushes into athletes' accounts. One push can carry several athletes' data, so each
// list is split by Garmin's userId and matched to the connection rows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccessLost, freshToken, type TokenRow } from "./tokens";
import { activityId, markConnection, saveBodyDays, saveWorkouts, type BodyIn, type WorkoutIn } from "./import";
import { GarminError, activityToWorkout, bodyCompToBody, dailyToBody, garminRefresh, hrvToBody, metricsToBody, routeOfDetail, sleepToBody, type GarminPush } from "./garmin";

export interface GarminRow extends TokenRow { external_user_id: string | null; status: string; via: string }

export async function garminToken(sb: SupabaseClient, row: GarminRow) {
  try { return await freshToken(sb, row, async (r) => { const t = await garminRefresh(r); return { a: t.a, r: t.r, e: t.e }; }); }
  catch (e) {
    if (e instanceof GarminError && (e.status === 400 || e.status === 401)) throw new AccessLost("garmin", "Garmin access was removed. Connect again.");
    throw e;
  }
}

/** Finds the connection rows for the Garmin user ids in a push. */
export async function garminRows(sb: SupabaseClient, ids: string[]): Promise<Map<string, GarminRow>> {
  if (!ids.length) return new Map();
  const { data } = await sb.from("integrations").select("user_id, provider, via, secret, external_user_id, status, expires_at, refreshing_at").eq("provider", "garmin").eq("via", "direct").in("external_user_id", ids);
  return new Map(((data ?? []) as GarminRow[]).map((r) => [String(r.external_user_id), r]));
}

/** Applies one push. Returns notes per Garmin user id (for the log). */
export async function garminHandlePush(sb: SupabaseClient, push: GarminPush): Promise<{ userId: string; note: string; ok: boolean }[]> {
  const by = new Map<string, { workouts: WorkoutIn[]; routes: Map<string, [number, number][]>; body: BodyIn[]; notes: string[]; device?: string; deregister?: boolean; permissions?: string[] }>();
  const bucket = (id: string) => { let b = by.get(id); if (!b) { b = { workouts: [], routes: new Map(), body: [], notes: [] }; by.set(id, b); } return b; };

  for (const d of push.activityDetails ?? []) { const r = routeOfDetail(d); if (r && d.summaryId) bucket(d.userId).routes.set(activityId("ga", d.summaryId), r); }
  for (const list of [push.activities ?? [], push.manuallyUpdatedActivities ?? [], (push.activityDetails ?? []).map((d) => d.summary).filter(Boolean)]) {
    for (const a of list) { const b = bucket(a.userId); const w = activityToWorkout(a, b.routes.get(activityId("ga", a.summaryId))); if (w) b.workouts.push(w); if (a.deviceName) b.device = a.deviceName.slice(0, 60); }
  }
  for (const x of push.dailies ?? []) { const v = dailyToBody(x); if (v) bucket(x.userId).body.push(v); }
  for (const x of push.sleeps ?? []) { const v = sleepToBody(x); if (v) bucket(x.userId).body.push(v); }
  for (const x of push.hrv ?? []) { const v = hrvToBody(x); if (v) bucket(x.userId).body.push(v); }
  for (const x of push.userMetrics ?? []) { const v = metricsToBody(x); if (v) bucket(x.userId).body.push(v); }
  for (const x of push.bodyComps ?? []) { const v = bodyCompToBody(x); if (v) bucket(x.userId).body.push(v); }
  for (const x of push.deregistrations ?? []) bucket(x.userId).deregister = true;
  for (const x of push.userPermissionsChange ?? []) bucket(x.userId).permissions = x.permissions ?? [];

  const rows = await garminRows(sb, [...by.keys()]);
  const out: { userId: string; note: string; ok: boolean }[] = [];
  for (const [garminId, b] of by) {
    const row = rows.get(garminId);
    if (!row) { out.push({ userId: garminId, note: "unknown athlete", ok: true }); continue; }
    const uid = row.user_id;
    try {
      const now = new Date().toISOString();
      if (b.deregister) {
        await markConnection(sb, uid, "garmin", "direct", { status: "disconnected", secret: null, expires_at: null, error: "Access was removed in Garmin Connect." });
        out.push({ userId: garminId, note: "deregistered", ok: true });
        continue;
      }
      // routes that arrived without their summary (details pushed after the activity): add them to the saved row
      const withSummary = new Set(b.workouts.map((w) => w.id));
      for (const [id, route] of b.routes) if (!withSummary.has(id)) await sb.from("activities").update({ route }).eq("user_id", uid).eq("id", id);
      // the same activity may appear twice in one push (activities + activityDetails): the one with a route wins
      const uniq = new Map<string, WorkoutIn>();
      for (const w of b.workouts) { const had = uniq.get(w.id); if (!had || (w.route && !had.route)) uniq.set(w.id, w); }
      const n = await saveWorkouts(sb, uid, "garmin", [...uniq.values()]);
      const d = await saveBodyDays(sb, uid, "garmin", b.body);
      const patch: Record<string, unknown> = { last_event_at: now, status: "connected", error: null };
      if (b.permissions) patch.scopes = b.permissions.join(" ");
      if (b.device) patch.device = b.device;
      await markConnection(sb, uid, "garmin", "direct", patch);
      out.push({ userId: garminId, note: `${n} activities, ${d} body days${b.permissions ? ", permissions changed" : ""}`, ok: true });
    } catch (e) {
      out.push({ userId: garminId, note: String((e as Error).message ?? e), ok: false });
    }
  }
  return out;
}
