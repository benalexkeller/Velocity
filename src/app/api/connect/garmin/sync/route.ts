// POST /api/connect/garmin/sync { days? } — history. Through Junction: pulls the athlete's Garmin workouts (last 90
// days by default) with their own session. Through Garmin's own program: Starter tier has no history (Garmin only
// pushes new data), Enterprise tier asks Garmin to send it (GARMIN_BACKFILL=1).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { listWorkouts, toActivity } from "@/lib/integrations/junction";
import { garminBackfill, garminConfig, garminDirectOn } from "@/lib/wearables/garmin";
import { garminToken, type GarminRow } from "@/lib/wearables/garmin-sync";
import { saveWorkouts } from "@/lib/wearables/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!sb || (!GARMIN_ON && !garminDirectOn())) return NextResponse.json({ error: "off" }, { status: 503 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const uid = u.user.id;
  const { data } = await sb.from("integrations").select("user_id, provider, via, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", uid).eq("provider", "garmin").maybeSingle();
  const row = data as GarminRow | null;
  if (!row?.external_user_id || row.status !== "connected") return NextResponse.json({ error: "not_connected" }, { status: 400 });
  let days = 90;
  try { const b = (await req.json()) as { days?: number }; if (b?.days) days = Math.min(365, Math.max(1, Math.round(b.days))); } catch { /* no body */ }
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  try {
    if (row.via === "direct") {
      if (!garminConfig().backfill) return NextResponse.json({ ok: true, found: 0, saved: 0, since: ymd(start), note: "Garmin sends new activities on its own as your watch syncs; older ones are not available on this plan." });
      const access = await garminToken(sb, row);
      // at most 90 days per request, oldest window first; the data arrives through the push endpoint
      for (let from = start.getTime() / 1000; from < end.getTime() / 1000; from += 90 * 86400) {
        const to = Math.min(from + 90 * 86400, end.getTime() / 1000);
        for (const kind of ["activities", "dailies", "sleeps", "hrv", "userMetrics"] as const) await garminBackfill(access, kind, from, to);
      }
      await sb.from("integrations").update({ synced_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null }).eq("user_id", uid).eq("provider", "garmin");
      return NextResponse.json({ ok: true, found: 0, saved: 0, since: ymd(start), note: "Garmin is sending the history; it appears over the next minutes." });
    }
    const workouts = await listWorkouts(String(row.external_user_id), ymd(start), ymd(end));
    const list = workouts.map(toActivity).filter((a): a is NonNullable<typeof a> => !!a).map(({ source: _s, ...a }) => ({ ...a, externalId: a.id.replace(/^jn-/, "") }));
    const saved = await saveWorkouts(sb, uid, "garmin", list);
    const now = new Date().toISOString();
    await sb.from("integrations").update({ last_event_at: now, synced_at: now, updated_at: now, error: null }).eq("user_id", uid).eq("provider", "garmin");
    return NextResponse.json({ ok: true, found: workouts.length, saved, since: ymd(start) });
  } catch (e) {
    console.error("[connect/garmin/sync]", e);
    return NextResponse.json({ error: "upstream", detail: String(e).slice(0, 200) }, { status: 502 });
  }
}
