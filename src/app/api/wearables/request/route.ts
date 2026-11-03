// POST /api/wearables/request { maker, on } — an athlete asks for a maker that is not open yet (Connect sheet →
// Request access). Kept as an integrations row with status "requested", so it shows as Pending on every device the
// athlete uses and Admin → System → Watch connections shows the demand. When the maker opens and the athlete
// connects, the same row becomes the connection. `on: false` withdraws the request (never touches a real connection).
import { NextResponse, type NextRequest } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { WEARABLES } from "@/lib/wearables/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { maker?: unknown; on?: unknown };
  const maker = typeof body.maker === "string" && WEARABLES.some((w) => w.k === body.maker) ? body.maker : null;
  if (!maker) return NextResponse.json({ error: "unknown maker" }, { status: 400 });
  const now = new Date().toISOString();
  if (body.on === false) {
    const { error } = await me.sb.from("integrations").delete().eq("user_id", me.uid).eq("provider", maker).eq("status", "requested");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, requested: false });
  }
  const { data: cur } = await me.sb.from("integrations").select("status").eq("user_id", me.uid).eq("provider", maker).maybeSingle();
  if (cur && cur.status !== "requested" && cur.status !== "disconnected") return NextResponse.json({ ok: true, requested: false, status: cur.status });
  const { error } = await me.sb.from("integrations").upsert({ user_id: me.uid, provider: maker, via: "requested", status: "requested", connected_at: null, error: null, updated_at: now }, { onConflict: "user_id,provider" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, requested: true });
}
