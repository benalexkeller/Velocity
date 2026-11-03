// POST /api/webhooks/whoop — WHOOP calls this when a sleep, recovery or workout is scored or deleted. The signature
// is checked, the athlete is found by WHOOP's user id, the record is fetched and saved. Always answers quickly;
// anything odd is written to webhook_log. Needs the service-role key (no athlete session here).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { whoopSignatureOk, type WhoopEvent } from "@/lib/wearables/whoop";
import { whoopHandleEvent, type WhoopRow } from "@/lib/wearables/whoop-sync";
import { AccessLost } from "@/lib/wearables/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const log = (fields: { event_type?: string | null; external_user_id?: string | null; ok: boolean; note: string }) => admin.from("webhook_log").insert({ via: "whoop", ...fields, note: fields.note.slice(0, 500) });
  if (!whoopSignatureOk(raw, req.headers.get("x-whoop-signature"), req.headers.get("x-whoop-signature-timestamp"))) {
    await log({ ok: false, note: "bad signature" });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }
  let ev: WhoopEvent;
  try { ev = JSON.parse(raw) as WhoopEvent; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  const external = String(ev.user_id ?? "");
  const { data } = await admin.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at").eq("provider", "whoop").eq("external_user_id", external).maybeSingle();
  const row = data as WhoopRow | null;
  if (!row?.secret || row.status === "disconnected") { await log({ event_type: ev.type, external_user_id: external, ok: true, note: "unknown or disconnected athlete" }); return NextResponse.json({ ok: true }); }
  try {
    const note = await whoopHandleEvent(admin, row.user_id, row, ev);
    await log({ event_type: ev.type, external_user_id: external, ok: true, note });
  } catch (e) {
    console.error("[webhooks/whoop]", e);
    if (e instanceof AccessLost) await admin.from("integrations").update({ status: "error", error: e.message, updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("provider", "whoop");
    await log({ event_type: ev.type, external_user_id: external, ok: false, note: String((e as Error).message ?? e) });
  }
  return NextResponse.json({ ok: true });
}
