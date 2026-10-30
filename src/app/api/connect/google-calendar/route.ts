// GET /api/connect/google-calendar?tz=Europe/Berlin&next=/profile[&read=1] — sends the signed-in athlete to Google
// to allow Velocity its own calendar; with read=1 also to read their other events ("Show my other events").
// Google sends them back to /api/connect/google-calendar/callback.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authLink, googleOn } from "@/lib/calendar/google";
import { STATE_COOKIE, athlete, cleanZone, safeNext } from "@/lib/calendar/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (flag: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}calendar=${flag}`, req.nextUrl.origin));
  if (!googleOn()) return back("off");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const state = randomBytes(18).toString("base64url");
  const tz = cleanZone(req.nextUrl.searchParams.get("tz"));
  const read = req.nextUrl.searchParams.get("read") === "1";
  const res = NextResponse.redirect(authLink(`${req.nextUrl.origin}/api/connect/google-calendar/callback`, state, me.email ?? undefined, read));
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, tz, next, read }), { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/connect/google-calendar" });
  return res;
}
