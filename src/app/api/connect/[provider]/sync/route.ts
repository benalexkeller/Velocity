// POST /api/connect/<maker>/sync { days? } — pulls the athlete's history from the maker into their account, with
// their own session (default 90 days, capped at what the maker allows).
import { NextResponse, type NextRequest } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { directProvider, type ConnRow } from "@/lib/wearables/direct";
import { AccessLost } from "@/lib/wearables/tokens";
import { WEARABLE_NAME } from "@/lib/wearables/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = await directProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown maker" }, { status: 404 });
  const name = WEARABLE_NAME(p.key);
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  if (!p.on()) return NextResponse.json({ error: `${name} is not switched on for this site yet.` }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { days?: unknown };
  const asked = typeof body.days === "number" && Number.isFinite(body.days) ? Math.max(1, Math.round(body.days)) : 90;
  const days = Math.min(p.maxDays, asked);
  const { data } = await me.sb.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at, device").eq("user_id", me.uid).eq("provider", p.key).maybeSingle();
  const row = data as ConnRow | null;
  if (!row?.secret || row.status !== "connected") return NextResponse.json({ error: `${name} is not connected.` }, { status: 400 });
  try {
    const r = await p.history(me.sb, me.uid, row, days);
    // a maker that shares less history than asked says so (the Connect sheet shows `note` as is)
    const note = r.note ?? (asked > p.maxDays ? `${r.workouts} activit${r.workouts === 1 ? "y" : "ies"}${r.bodyDays ? ` and ${r.bodyDays} days of body data` : ""} saved. ${name} shares the last ${p.maxDays} days only.` : undefined);
    return NextResponse.json({ ok: true, ...r, ...(note ? { note } : {}) });
  } catch (e) {
    console.error(`[connect/${p.key}/sync]`, e);
    if (e instanceof AccessLost || p.accessLost(e)) {
      const msg = e instanceof AccessLost ? e.message : `${name} removed Velocity's access. Connect again.`;
      await me.sb.from("integrations").update({ status: "error", error: msg, updated_at: new Date().toISOString() }).eq("user_id", me.uid).eq("provider", p.key);
      return NextResponse.json({ error: msg }, { status: 200 });
    }
    return NextResponse.json({ error: `${name} did not answer. Try again in a minute.` }, { status: 502 });
  }
}
