// POST /api/admin/delete { user, reason } — Admin → Users → Delete account. The same clean-up as Delete my account
// (Velocity's calendars in Google, Outlook and iCloud, its Google access, the Garmin connection), then the account with everything in it
// (admin_delete_user in supabase/schema-admin.sql, which refuses anyone but the admin and never deletes an admin).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanupOutside, type OutsideLinks } from "@/lib/account/cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!sb) return NextResponse.json({ error: "Accounts are not on for this site." }, { status: 400 });
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { data: admin } = await sb.rpc("is_admin");
  if (admin !== true) return NextResponse.json({ error: "Only the admin account can do this." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { user?: unknown; reason?: unknown };
  const user = typeof body.user === "string" && UUID.test(body.user) ? body.user : null;
  if (!user) return NextResponse.json({ error: "No account given." }, { status: 400 });
  if (user === u.user.id) return NextResponse.json({ error: "Use Delete my account in Profile for your own account." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  const { data: links } = await sb.rpc("admin_external_links", { p_user: user });
  const row = (links as { google_token: string | null; google_calendar_id: string | null; garmin_external_id: string | null }[] | null)?.[0];
  // missing function (schema-calendar-accounts.sql not run yet) comes back as an error and no rows
  const { data: other } = await sb.rpc("admin_calendar_accounts", { p_user: user });
  await cleanupOutside({ googleToken: row?.google_token, calendarId: row?.google_calendar_id, garminId: row?.garmin_external_id, accounts: other as OutsideLinks["accounts"] }, "admin/delete");

  const { error } = await sb.rpc("admin_delete_user", { p_user: user, p_reason: reason });
  if (error) {
    console.error("[admin/delete]", error.message);
    const setup = /schema cache|does not exist|Could not find the function/i.test(error.message);
    return NextResponse.json({ error: setup ? "Run supabase/schema-admin.sql in Supabase to turn this on." : error.message }, { status: setup ? 501 : 400 });
  }
  return NextResponse.json({ ok: true });
}
