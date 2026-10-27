// POST /api/webhooks/junction — Junction calls this whenever an athlete's Garmin has new data. The signature
// is checked, the athlete is found by Junction's user id, and workouts become activities in their account.
// Body-data events (resting HR, HRV, VO2max, stress, sleep) update body_metrics. Always answers 200 fast;
// anything odd is written to webhook_log.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { WEARABLE_WEBHOOK_SECRET } from "@/lib/integrations/config";
import { dailyValues, toActivity, verifySignature, workoutRoute, type JunctionWorkout } from "@/lib/integrations/junction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Event { event_type?: string; user_id?: string; client_user_id?: string; data?: unknown }

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const h = { id: req.headers.get("svix-id"), ts: req.headers.get("svix-timestamp"), sig: req.headers.get("svix-signature") };
  if (!verifySignature(WEARABLE_WEBHOOK_SECRET, raw, h)) {
    await admin.from("webhook_log").insert({ via: "junction", event_type: null, ok: false, note: "bad signature" });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  let ev: Event;
  try { ev = JSON.parse(raw) as Event; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const type = ev.event_type ?? "";
  const external = ev.user_id ?? "";
  const log = (ok: boolean, note: string) => admin.from("webhook_log").insert({ via: "junction", event_type: type, external_user_id: external, ok, note: note.slice(0, 500) });

  // which athlete: Junction's user id → our integrations row (client_user_id is our user id as well, as a fallback)
  const { data: row } = await admin.from("integrations").select("user_id").eq("via", "junction").eq("external_user_id", external).maybeSingle();
  const uid = (row?.user_id as string | undefined) ?? (ev.client_user_id && /^[0-9a-f-]{36}$/.test(ev.client_user_id) ? ev.client_user_id : undefined);
  if (!uid) { await log(false, "unknown user"); return NextResponse.json({ ok: true }); }
  const now = new Date().toISOString();

  try {
    if (type === "provider.connection.created") {
      await admin.from("integrations").update({ status: "connected", connected_at: now, last_event_at: now, error: null, updated_at: now }).eq("user_id", uid).eq("provider", "garmin");
      await log(true, "connected");
    } else if (/^daily\.data\.workouts\.(created|updated)$/.test(type)) {
      const list = (Array.isArray(ev.data) ? ev.data : [ev.data]) as JunctionWorkout[];
      let n = 0;
      for (const w of list) {
        const a = toActivity(w);
        if (!a) continue;
        if (w.id) a.route = await workoutRoute(w.id);
        const { error } = await admin.from("activities").upsert({
          user_id: uid, id: a.id, date: a.date, start: a.start ?? null, sport: a.sport, name: a.name, min: a.min,
          mi: a.mi ?? null, yd: a.yd ?? null, pace_s: a.pace_s ?? null, mph: a.mph ?? null, p100_s: a.p100_s ?? null, hr: a.hr ?? null, elev_ft: a.elev_ft ?? null,
          route: a.route ?? null, source: "garmin",
        }, { onConflict: "user_id,id" });
        if (error) throw new Error(error.message);
        n++;
      }
      await admin.from("integrations").update({ last_event_at: now, updated_at: now }).eq("user_id", uid).eq("provider", "garmin");
      await log(true, `${n} workouts`);
    } else if (/^daily\.data\.workout_stream\.(created|updated)$/.test(type)) {
      const d = ev.data as { workout_id?: string } | undefined;
      if (d?.workout_id) {
        const route = await workoutRoute(d.workout_id);
        if (route) await admin.from("activities").update({ route }).eq("user_id", uid).eq("id", `jn-${d.workout_id}`);
      }
      await log(true, "stream");
    } else if (/^daily\.data\.(resting_heart_rate|hrv|vo2_max|stress_level)\.(created|updated)$/.test(type)) {
      const col = ({ resting_heart_rate: "rhr", hrv: "hrv", vo2_max: "vo2", stress_level: "stress" } as Record<string, string>)[type.split(".")[2]];
      const rows = dailyValues(ev.data).map((v) => ({ user_id: uid, date: v.date, [col]: col === "vo2" ? v.value : Math.round(v.value) }));
      if (rows.length) { const { error } = await admin.from("body_metrics").upsert(rows, { onConflict: "user_id,date" }); if (error) throw new Error(error.message); }
      await log(true, `${rows.length} days of ${col}`);
    } else if (/^daily\.data\.sleep\.(created|updated)$/.test(type)) {
      const list = (Array.isArray(ev.data) ? ev.data : [ev.data]) as { calendar_date?: string; date?: string; duration?: number; score?: number | null; efficiency?: number | null; average_hrv?: number | null; hr_lowest?: number | null; hr_average?: number | null }[];
      const rows = list.filter((s) => s && (s.calendar_date || s.date)).map((s) => ({
        user_id: uid, date: String(s.calendar_date ?? s.date).slice(0, 10),
        ...(typeof s.duration === "number" ? { sleep_h: Math.round((s.duration / 3600) * 10) / 10 } : {}),
        ...(typeof s.score === "number" ? { sleep_score: Math.round(s.score) } : {}),
        ...(typeof s.average_hrv === "number" ? { hrv: Math.round(s.average_hrv) } : {}),
      }));
      if (rows.length) { const { error } = await admin.from("body_metrics").upsert(rows, { onConflict: "user_id,date" }); if (error) throw new Error(error.message); }
      await log(true, `${rows.length} nights`);
    } else {
      await log(true, "ignored");
    }
  } catch (e) {
    console.error("[webhooks/junction]", e);
    await log(false, String(e));
  }
  return NextResponse.json({ ok: true });
}
