// GET /api/connect/garmin — sends the signed-in athlete to Junction's Garmin sign-in page. Junction brings
// them back to /api/connect/garmin/done. Nothing is stored about Garmin itself: only Junction's id for the athlete.
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { GARMIN_ON } from "@/lib/integrations/config";
import { ensureUser, garminLinkUrl } from "@/lib/integrations/junction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/profile?garmin=${q}`, req.nextUrl.origin));
  if (!GARMIN_ON || !ACCOUNTS_ON) return back("off");
  const sb = await supabaseServer();
  const { data: u } = await sb!.auth.getUser();
  if (!u.user) return NextResponse.redirect(new URL("/login?next=/profile", req.nextUrl.origin));
  const uid = u.user.id;
  try {
    const { data: row } = await sb!.from("integrations").select("external_user_id").eq("user_id", uid).eq("provider", "garmin").maybeSingle();
    const { data: prof } = await sb!.from("profiles").select("timezone").eq("id", uid).maybeSingle();
    const external = (row?.external_user_id as string | null) || (await ensureUser(uid, (prof?.timezone as string | undefined) || undefined));
    await sb!.from("integrations").upsert({ user_id: uid, provider: "garmin", via: "junction", external_user_id: external, status: "pending", error: null, updated_at: new Date().toISOString() });
    const url = await garminLinkUrl(external, `${req.nextUrl.origin}/api/connect/garmin/done`);
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[connect/garmin]", e);
    await sb!.from("integrations").upsert({ user_id: uid, provider: "garmin", via: "junction", status: "error", error: String(e).slice(0, 300), updated_at: new Date().toISOString() });
    return back("error");
  }
}
