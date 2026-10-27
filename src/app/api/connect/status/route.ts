// GET /api/connect/status — what the signed-in athlete can connect and what is connected already.
import { NextResponse } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON, WEARABLE_PROVIDER } from "@/lib/integrations/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ConnectStatus { garmin: boolean; via: string; connections: { provider: string; status: string; connected_at: string | null; last_event_at: string | null; error: string | null }[] }

export async function GET() {
  const out: ConnectStatus = { garmin: GARMIN_ON && ACCOUNTS_ON, via: WEARABLE_PROVIDER, connections: [] };
  if (!ACCOUNTS_ON) return NextResponse.json(out);
  const sb = await supabaseServer();
  const { data: u } = await sb!.auth.getUser();
  if (!u.user) return NextResponse.json(out);
  const { data } = await sb!.from("integrations").select("provider, status, connected_at, last_event_at, error").eq("user_id", u.user.id);
  out.connections = (data ?? []) as ConnectStatus["connections"];
  return NextResponse.json(out);
}
