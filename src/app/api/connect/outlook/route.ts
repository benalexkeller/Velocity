// GET /api/connect/outlook?next=/profile — sends the signed-in athlete to Microsoft to allow Velocity its own
// calendar in their Outlook (personal or work account). Microsoft sends them back to /api/connect/outlook/callback.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { outlookAuthLink, outlookOn } from "@/lib/calendar/outlook";
import { athlete, safeNext } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTLOOK_COOKIE = "vel_ocal";

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (flag: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}calendar=${flag}`, req.nextUrl.origin));
  if (!outlookOn()) return back("outlook-off");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(outlookAuthLink(`${req.nextUrl.origin}/api/connect/outlook/callback`, state));
  res.cookies.set(OUTLOOK_COOKIE, JSON.stringify({ state, next }), { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/connect/outlook" });
  return res;
}
