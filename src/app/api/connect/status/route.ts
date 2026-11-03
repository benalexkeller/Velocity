// GET /api/connect/status — which wearables this site can connect right now (and through what), and the signed-in
// athlete's connections.
import { NextResponse } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { garminDirectOn } from "@/lib/wearables/garmin";
import { whoopOn } from "@/lib/wearables/whoop";
import type { ConnectStatus } from "@/lib/wearables/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { ConnectStatus } from "@/lib/wearables/providers";

export async function GET() {
  const live: ConnectStatus["live"] = {};
  if (ACCOUNTS_ON) {
    if (garminDirectOn()) live.garmin = "direct";
    else if (GARMIN_ON) live.garmin = "junction";
    if (whoopOn()) live.whoop = "direct";
    // other makers come through Junction when it is on
    if (GARMIN_ON) for (const k of ["coros", "polar", "suunto", "wahoo"] as const) live[k] = "junction";
  }
  const out: ConnectStatus = { live, via: live.garmin ?? "", garmin: !!live.garmin, connections: [] };
  if (!ACCOUNTS_ON) return NextResponse.json(out);
  const sb = await supabaseServer();
  const { data: u } = await sb!.auth.getUser();
  if (!u.user) return NextResponse.json(out);
  const { data, error } = await sb!.from("integrations").select("provider, via, status, connected_at, last_event_at, synced_at, error, device").eq("user_id", u.user.id);
  // before schema-wearables.sql has been run the new columns are missing: read the old ones
  const rows = error ? (await sb!.from("integrations").select("provider, via, status, connected_at, last_event_at, error").eq("user_id", u.user.id)).data : data;
  out.connections = ((rows ?? []) as Partial<ConnectStatus["connections"][number]>[]).map((r) => ({ provider: String(r.provider), via: String(r.via ?? ""), status: String(r.status ?? ""), connected_at: r.connected_at ?? null, last_event_at: r.last_event_at ?? null, synced_at: r.synced_at ?? null, error: r.error ?? null, device: r.device ?? null }));
  return NextResponse.json(out);
}
