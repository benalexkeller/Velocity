// GET /api/connect/<maker>?next=/profile — sends the signed-in athlete to the maker's sign-in page (Fitbit through
// Google, Polar, Wahoo, COROS, Suunto; src/lib/wearables/direct.ts). The maker sends them back to
// /api/connect/<maker>/callback. Garmin and WHOOP have their own routes next to this one.
import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { athlete, safeNext } from "@/lib/calendar/server";
import { directProvider } from "@/lib/wearables/direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const cookieName = (k: string) => `vel_${k}`;

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const back = (flag: string) => NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
  const p = await directProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown maker" }, { status: 404 });
  if (!p.on()) return back(`${p.key}-off`);
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  const state = randomBytes(18).toString("base64url");
  const verifier = p.pkce ? randomBytes(48).toString("base64url") : undefined;
  const challenge = verifier ? createHash("sha256").update(verifier).digest("base64url") : undefined;
  const res = NextResponse.redirect(p.authLink(`${req.nextUrl.origin}/api/connect/${p.key}/callback`, state, challenge));
  res.cookies.set(cookieName(p.key), JSON.stringify({ state, next, ...(verifier ? { verifier } : {}) }), { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: `/api/connect/${p.key}` });
  return res;
}
