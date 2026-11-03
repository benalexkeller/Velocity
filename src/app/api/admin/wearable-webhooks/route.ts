// Admin only. Registers Velocity's webhook endpoints with the makers that take a registration call instead of a
// portal setting: Google Health (Fitbit) wants a "subscriber" per project, Polar one webhook per client.
//   GET  → what each maker has registered now
//   POST { maker: "fitbit" | "polar" } → registers (Polar answers with the signature key once: it goes to Vercel as
//         POLAR_WEBHOOK_SECRET; Google verifies the endpoint with two calls before saving, so GOOGLE_HEALTH_WEBHOOK_SECRET
//         must already be in Vercel). Google's call needs a Google Health token: the admin's own Fitbit connection.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { fitbitCreateSubscriber, fitbitListSubscribers, fitbitOn, fitbitToken } from "@/lib/wearables/fitbit";
import { polarCreateWebhook, polarListWebhooks, polarOn } from "@/lib/wearables/polar";
import type { ConnRow } from "@/lib/wearables/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminSession() {
  const sb = await supabaseServer();
  if (!sb) return { error: NextResponse.json({ error: "Accounts are not on for this site." }, { status: 400 }) };
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { error: NextResponse.json({ error: "Signed out" }, { status: 401 }) };
  const { data: admin } = await sb.rpc("is_admin");
  if (admin !== true) return { error: NextResponse.json({ error: "Only the admin account can do this." }, { status: 403 }) };
  return { sb, uid: u.user.id };
}
async function fitbitAccess(sb: NonNullable<Awaited<ReturnType<typeof supabaseServer>>>, uid: string) {
  const { data } = await sb.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", uid).eq("provider", "fitbit").maybeSingle();
  const row = data as ConnRow | null;
  if (!row?.secret || row.status !== "connected") return null;
  return fitbitToken(sb, row);
}

export async function GET() {
  const s = await adminSession(); if ("error" in s) return s.error;
  const out: Record<string, unknown> = { fitbit: { on: fitbitOn() }, polar: { on: polarOn() } };
  if (fitbitOn()) { try { const access = await fitbitAccess(s.sb, s.uid); out.fitbit = { on: true, registered: access ? await fitbitListSubscribers(access) : "connect your own Fitbit first" }; } catch (e) { out.fitbit = { on: true, error: String((e as Error).message) }; } }
  if (polarOn()) { try { out.polar = { on: true, registered: await polarListWebhooks() }; } catch (e) { out.polar = { on: true, error: String((e as Error).message) }; } }
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const s = await adminSession(); if ("error" in s) return s.error;
  const body = (await req.json().catch(() => ({}))) as { maker?: unknown };
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  try {
    if (body.maker === "fitbit") {
      if (!fitbitOn()) return NextResponse.json({ error: "Fitbit keys are not in Vercel yet." }, { status: 400 });
      const access = await fitbitAccess(s.sb, s.uid);
      if (!access) return NextResponse.json({ error: "Connect your own Fitbit (Google Health) first; its token makes the call." }, { status: 400 });
      return NextResponse.json({ ok: true, result: await fitbitCreateSubscriber(access, `${origin}/api/webhooks/fitbit`) });
    }
    if (body.maker === "polar") {
      if (!polarOn()) return NextResponse.json({ error: "Polar keys are not in Vercel yet." }, { status: 400 });
      const r = await polarCreateWebhook(`${origin}/api/webhooks/polar`);
      return NextResponse.json({ ok: true, result: r, note: "Put signature_secret_key in Vercel as POLAR_WEBHOOK_SECRET. It is shown only now." });
    }
    return NextResponse.json({ error: "maker must be fitbit or polar" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
