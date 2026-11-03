// POST /api/webhooks/<maker> — the maker calls this when data changes (Fitbit through Google, Polar, Wahoo, COROS,
// Suunto). Each maker checks its own signature or secret, finds the athlete by the maker's id, saves the data after
// answering, and writes a line to webhook_log. Needs the service-role key (no athlete session here). Garmin and
// WHOOP have their own routes next to this one.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { directProvider } from "@/lib/wearables/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = await directProvider(provider);
  if (!p?.webhook) return NextResponse.json({ error: "unknown maker" }, { status: 404 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await req.text();
  return p.webhook(req, raw, admin);
}
/** Some makers probe the address first. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = await directProvider(provider);
  return p?.webhook ? NextResponse.json({ ok: true, maker: p.key }) : NextResponse.json({ error: "unknown maker" }, { status: 404 });
}
