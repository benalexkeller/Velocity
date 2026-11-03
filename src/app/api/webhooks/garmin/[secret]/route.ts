// POST /api/webhooks/garmin/<secret> — Garmin pushes summaries here the moment an athlete's watch syncs (Garmin's own
// program). The address, with its secret, is set once in Garmin's developer portal for every summary type; nobody
// else knows it. Each athlete in the push is found by Garmin's user id. Always answers 200 quickly (Garmin retries
// otherwise); anything odd is written to webhook_log. Needs the service-role key.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { garminConfig, type GarminPush } from "@/lib/wearables/garmin";
import { garminHandlePush } from "@/lib/wearables/garmin-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const same = (a: string, b: string) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const expected = garminConfig().webhookSecret;
  if (!expected || !same(secret, expected)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  let push: GarminPush;
  try { push = (await req.json()) as GarminPush; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const kinds = Object.keys(push).filter((k) => Array.isArray((push as Record<string, unknown>)[k]) && ((push as Record<string, unknown[]>)[k]).length).join(",");
  try {
    const results = await garminHandlePush(admin, push);
    for (const r of results) await admin.from("webhook_log").insert({ via: "garmin", event_type: kinds, external_user_id: r.userId, ok: r.ok, note: r.note.slice(0, 500) });
    if (!results.length) await admin.from("webhook_log").insert({ via: "garmin", event_type: kinds || "empty", ok: true, note: "nothing to do" });
  } catch (e) {
    console.error("[webhooks/garmin]", e);
    await admin.from("webhook_log").insert({ via: "garmin", event_type: kinds, ok: false, note: String((e as Error).message ?? e).slice(0, 500) });
  }
  return NextResponse.json({ ok: true });
}
