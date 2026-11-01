// POST /api/account/delete — "Delete my account" in Profile. In order: the Google Calendar connection (the Velocity
// training calendar is deleted from Google and Velocity's access withdrawn), the Garmin connection at Junction,
// then the account itself with everything in it (supabase/schema-account.sql), then sign-out.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { DELETE_REASONS, DELETE_TAB, deleteReasonLabel } from "@/lib/account/deleteReasons";
import { accessFrom, deleteCalendar, revoke, unseal } from "@/lib/calendar/google";
import { GARMIN_ON } from "@/lib/integrations/config";
import { disconnectGarmin } from "@/lib/integrations/junction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "Accounts are not on for this site." }, { status: 400 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const uid = u.user.id;

  // why they are leaving (optional): saved with no link to the person, so it survives the deletion
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; other?: unknown };
  const reason = typeof body.reason === "string" && DELETE_REASONS.some((r) => r.k === body.reason) ? body.reason : null;
  if (reason) {
    const other = typeof body.other === "string" ? body.other.trim().slice(0, 500) : "";
    const { error } = await sb.from("feedback").insert({ user_id: null, tab: DELETE_TAB, kind: reason, message: other ? `${deleteReasonLabel(reason)}: ${other}` : deleteReasonLabel(reason) });
    if (error) console.error("[account/delete] reason", error.message);
  }

  // outside services first, while the tokens and ids still exist; a failure here does not stop the deletion
  try {
    const { data: cal } = await sb.from("calendar_links").select("google_token, google_calendar_id").eq("user_id", uid).maybeSingle();
    if (cal?.google_token) {
      const refresh = unseal(String(cal.google_token));
      if (cal.google_calendar_id) { try { await deleteCalendar(await accessFrom(refresh), String(cal.google_calendar_id)); } catch (e) { console.error("[account/delete] calendar", e); } }
      await revoke(refresh);
    }
  } catch (e) { console.error("[account/delete] calendar", e); }
  try {
    const { data: g } = await sb.from("integrations").select("external_user_id").eq("user_id", uid).eq("provider", "garmin").maybeSingle();
    if (GARMIN_ON && g?.external_user_id) await disconnectGarmin(String(g.external_user_id));
  } catch (e) { console.error("[account/delete] garmin", e); }

  const { error } = await sb.rpc("delete_my_account");
  if (error) {
    console.error("[account/delete]", error.message);
    const missing = /delete_my_account|schema cache|does not exist/i.test(error.message);
    return NextResponse.json({ error: missing ? "Account deletion is not set up on this site yet. Write to us through the Help page." : "The account was not deleted. Try again, or write to us through the Help page." }, { status: 500 });
  }
  try { await sb.auth.signOut(); } catch { /* the login no longer exists */ }
  return NextResponse.json({ ok: true });
}
