// POST /api/connect/garmin/sync — pulls the athlete's Garmin workouts from Junction (last 90 days, or since the
// last sync) into their own activities. Runs with the athlete's session, so it needs no service-role key; it is
// also the way in before webhooks are set up. Body: { days?: number } (1–365, default 90).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { listWorkouts, toActivity } from "@/lib/integrations/junction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!sb || !GARMIN_ON) return NextResponse.json({ error: "off" }, { status: 503 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const uid = u.user.id;
  const { data: row } = await sb.from("integrations").select("external_user_id, status").eq("user_id", uid).eq("provider", "garmin").maybeSingle();
  if (!row?.external_user_id || row.status !== "connected") return NextResponse.json({ error: "not_connected" }, { status: 400 });
  let days = 90;
  try { const b = (await req.json()) as { days?: number }; if (b?.days) days = Math.min(365, Math.max(1, Math.round(b.days))); } catch { /* no body */ }
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const workouts = await listWorkouts(String(row.external_user_id), ymd(start), ymd(end));
    const rows = workouts.map(toActivity).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({
      user_id: uid, id: a.id, date: a.date, start: a.start ?? null, sport: a.sport, name: a.name, min: a.min,
      mi: a.mi ?? null, yd: a.yd ?? null, pace_s: a.pace_s ?? null, mph: a.mph ?? null, p100_s: a.p100_s ?? null, hr: a.hr ?? null, elev_ft: a.elev_ft ?? null,
      route: a.route ?? null, source: "garmin",
    }));
    if (rows.length) {
      const { error } = await sb.from("activities").upsert(rows, { onConflict: "user_id,id" });
      if (error) throw new Error(error.message);
    }
    const now = new Date().toISOString();
    await sb.from("integrations").update({ last_event_at: now, updated_at: now, error: null }).eq("user_id", uid).eq("provider", "garmin");
    return NextResponse.json({ ok: true, found: workouts.length, saved: rows.length, since: ymd(start) });
  } catch (e) {
    console.error("[connect/garmin/sync]", e);
    return NextResponse.json({ error: "upstream", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
