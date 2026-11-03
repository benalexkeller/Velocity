// POST /api/connect/garmin/disconnect — ends the Garmin connection: at Garmin (deregistration) or at Junction,
// whichever way it was made. Activities already in Velocity stay.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { disconnectGarmin } from "@/lib/integrations/junction";
import { garminDeregister } from "@/lib/wearables/garmin";
import { garminToken, type GarminRow } from "@/lib/wearables/garmin-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "local" }, { status: 400 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { data } = await sb.from("integrations").select("user_id, provider, via, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", u.user.id).eq("provider", "garmin").maybeSingle();
  const row = data as GarminRow | null;
  if (row?.via === "direct" && row.secret) {
    try { await garminDeregister(await garminToken(sb, row)); } catch (e) { console.error("[connect/garmin/disconnect]", e); }
  } else if (row?.via === "junction" && GARMIN_ON && row.external_user_id) {
    try { await disconnectGarmin(String(row.external_user_id)); } catch (e) { console.error("[connect/garmin/disconnect]", e); }
  }
  await sb.from("integrations").update({ status: "disconnected", secret: null, expires_at: null, refreshing_at: null, error: null, updated_at: new Date().toISOString() }).eq("user_id", u.user.id).eq("provider", "garmin");
  return NextResponse.json({ ok: true });
}
