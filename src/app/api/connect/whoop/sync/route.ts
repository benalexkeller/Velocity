// POST /api/connect/whoop/sync { days? } — pulls the athlete's WHOOP history (default 90 days, at most 365) into
// their account, with their own session.
import { NextResponse, type NextRequest } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { AccessLost } from "@/lib/wearables/tokens";
import { whoopOn } from "@/lib/wearables/whoop";
import { whoopSyncHistory, type WhoopRow } from "@/lib/wearables/whoop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!whoopOn()) return NextResponse.json({ error: "WHOOP is not switched on for this site yet." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { days?: unknown };
  const days = typeof body.days === "number" && Number.isFinite(body.days) ? Math.min(365, Math.max(1, Math.round(body.days))) : 90;
  const { data } = await me.sb.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", me.uid).eq("provider", "whoop").maybeSingle();
  const row = data as WhoopRow | null;
  if (!row?.secret || row.status !== "connected") return NextResponse.json({ error: "WHOOP is not connected." }, { status: 400 });
  try {
    const r = await whoopSyncHistory(me.sb, me.uid, row, days);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[connect/whoop/sync]", e);
    if (e instanceof AccessLost) {
      await me.sb.from("integrations").update({ status: "error", error: e.message, updated_at: new Date().toISOString() }).eq("user_id", me.uid).eq("provider", "whoop");
      return NextResponse.json({ error: e.message }, { status: 200 });
    }
    return NextResponse.json({ error: "WHOOP did not answer. Try again in a minute." }, { status: 502 });
  }
}
