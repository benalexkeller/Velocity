// GET /api/connect/whoop?next=/profile — sends the signed-in athlete to WHOOP to allow Velocity to read their data.
// WHOOP sends them back to /api/connect/whoop/callback.
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { athlete, safeNext } from "@/lib/calendar/server";
import { whoopAuthLink, whoopOn } from "@/lib/wearables/whoop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vel_whoop";

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (flag: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
  if (!whoopOn()) return back("whoop-off");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(whoopAuthLink(`${req.nextUrl.origin}/api/connect/whoop/callback`, state));
  res.cookies.set(COOKIE, JSON.stringify({ state, next }), { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/api/connect/whoop" });
  return res;
}
