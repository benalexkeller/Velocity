// GET /api/connect/garmin/done — Junction returns the athlete here: ?state=success&provider=garmin, or an error.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const ok = q.get("state") === "success";
  const sb = await supabaseServer();
  const { data: u } = sb ? await sb.auth.getUser() : { data: { user: null } };
  if (sb && u.user) {
    const now = new Date().toISOString();
    const err = ok ? null : (q.get("error") || q.get("error_type") || q.get("state") || "cancelled").slice(0, 200);
    await sb.from("integrations").update(ok ? { status: "connected", connected_at: now, error: null, updated_at: now } : { status: err === "user_cancelled" ? "disconnected" : "error", error: err, updated_at: now }).eq("user_id", u.user.id).eq("provider", "garmin");
  }
  return NextResponse.redirect(new URL(`/profile?garmin=${ok ? "connected" : "error"}`, req.nextUrl.origin));
}
