// GET /api/calendar/feed/<secret>.ics — the calendar link. Calendar apps open it without a login, so it is public
// (proxy.ts); the long secret in the address is what keeps it private. Serves the sessions the app last sent.
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { icsCalendar, type CalSession } from "@/lib/calendar/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ file: string }> }) {
  const token = (await ctx.params).file.replace(/\.ics$/i, "");
  if (!ACCOUNTS_ON || token.length < 32) return new NextResponse("Not found", { status: 404 });
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("calendar_feed", { t: token });
  const row = (data as { sessions: CalSession[]; tz: string | null }[] | null)?.[0];
  if (error || !row) return new NextResponse("Not found", { status: 404 });
  const body = icsCalendar(row.sessions ?? [], row.tz || "UTC", req.nextUrl.origin, req.nextUrl.hostname);
  return new NextResponse(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="velocity-training.ics"', "Cache-Control": "private, max-age=300" } });
}
