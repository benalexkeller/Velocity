// GET /api/connect/garmin?next=/profile — sends the signed-in athlete to Garmin. Two ways, decided by what is set
// on the server: Garmin's own program (GARMIN_* values: the athlete signs in at Garmin, comes back to
// /api/connect/garmin/callback, and Garmin pushes data from then on) or Junction, the middleman (WEARABLE_*
// values: Junction's Garmin page, back to /api/connect/garmin/done).
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/calendar/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { ensureUser, garminLinkUrl } from "@/lib/integrations/junction";
import { garminAuthLink, garminDirectOn, pkcePair } from "@/lib/wearables/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GARMIN_COOKIE = "vel_garmin";

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (flag: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
  if (!ACCOUNTS_ON || (!garminDirectOn() && !GARMIN_ON)) return back("garmin-off");
  const sb = await supabaseServer();
  const { data: u } = await sb!.auth.getUser();
  if (!u.user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const uid = u.user.id;

  if (garminDirectOn()) {
    const state = randomBytes(18).toString("base64url");
    const { verifier, challenge } = pkcePair();
    const res = NextResponse.redirect(garminAuthLink(`${req.nextUrl.origin}/api/connect/garmin/callback`, state, challenge));
    res.cookies.set(GARMIN_COOKIE, JSON.stringify({ state, verifier, next }), { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/connect/garmin" });
    return res;
  }

  // ---------- Junction ----------
  try {
    const { data: row } = await sb!.from("integrations").select("external_user_id, via").eq("user_id", uid).eq("provider", "garmin").maybeSingle();
    const { data: prof } = await sb!.from("profiles").select("timezone").eq("id", uid).maybeSingle();
    const external = (row?.via === "junction" && (row?.external_user_id as string | null)) || (await ensureUser(uid, (prof?.timezone as string | undefined) || undefined));
    await sb!.from("integrations").upsert({ user_id: uid, provider: "garmin", via: "junction", external_user_id: external, status: "pending", error: null, secret: null, updated_at: new Date().toISOString() });
    const url = await garminLinkUrl(external, `${req.nextUrl.origin}/api/connect/garmin/done`);
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[connect/garmin]", e);
    await sb!.from("integrations").upsert({ user_id: uid, provider: "garmin", via: "junction", status: "error", error: String(e).slice(0, 300), updated_at: new Date().toISOString() });
    return back("garmin-error");
  }
}
