// POST /api/connect/whoop/disconnect — ends Velocity's access at WHOOP and forgets the tokens. Activities and body
// values already in Velocity stay.
import { NextResponse } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { whoopRevoke } from "@/lib/wearables/whoop";
import { whoopToken, type WhoopRow } from "@/lib/wearables/whoop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { data } = await me.sb.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", me.uid).eq("provider", "whoop").maybeSingle();
  const row = data as WhoopRow | null;
  if (row?.secret) {
    try { await whoopRevoke(await whoopToken(me.sb, row)); } catch (e) { console.error("[connect/whoop/disconnect]", e); }
  }
  await me.sb.from("integrations").update({ status: "disconnected", secret: null, expires_at: null, refreshing_at: null, error: null, updated_at: new Date().toISOString() }).eq("user_id", me.uid).eq("provider", "whoop");
  return NextResponse.json({ ok: true });
}
