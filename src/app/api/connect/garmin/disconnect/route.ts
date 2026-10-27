// POST /api/connect/garmin/disconnect — removes the Garmin connection at Junction. Activities already in Velocity stay.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { disconnectGarmin } from "@/lib/integrations/junction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "local" }, { status: 400 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const { data: row } = await sb.from("integrations").select("external_user_id").eq("user_id", u.user.id).eq("provider", "garmin").maybeSingle();
  if (GARMIN_ON && row?.external_user_id) { try { await disconnectGarmin(String(row.external_user_id)); } catch (e) { console.error("[disconnect]", e); } }
  await sb.from("integrations").update({ status: "disconnected", updated_at: new Date().toISOString() }).eq("user_id", u.user.id).eq("provider", "garmin");
  return NextResponse.json({ ok: true });
}
