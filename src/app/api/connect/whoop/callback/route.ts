// GET /api/connect/whoop/callback — WHOOP sends the athlete back here. Turns the one-time code into tokens (stored
// encrypted), notes WHOOP's id for the athlete, pulls the last 30 days, and returns to the app. From then on
// WHOOP's webhook keeps the account up to date.
import { NextResponse, type NextRequest } from "next/server";
import { athlete, safeNext } from "@/lib/calendar/server";
import { markConnection } from "@/lib/wearables/import";
import { sealTokens } from "@/lib/wearables/tokens";
import { whoopExchange, whoopOn, whoopProfile } from "@/lib/wearables/whoop";
import { whoopSyncHistory } from "@/lib/wearables/whoop-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const COOKIE = "vel_whoop";
const missing = (e: unknown) => /secret|dup_of|external_id|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

export async function GET(req: NextRequest) {
  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(req.cookies.get(COOKIE)?.value ?? "{}"); } catch { saved = {}; }
  const next = safeNext(saved.next ?? null);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
    res.cookies.set(COOKIE, "", { maxAge: 0, path: "/api/connect/whoop" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (!whoopOn()) return back("whoop-off");
  if (q.get("error")) return back(q.get("error") === "access_denied" ? "whoop-denied" : "whoop-error");
  if (!saved.state || q.get("state") !== saved.state || !q.get("code")) return back("whoop-error");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  try {
    const t = await whoopExchange(q.get("code")!, `${req.nextUrl.origin}/api/connect/whoop/callback`);
    if (!t.a || !t.r) return back("whoop-error");
    const profile = await whoopProfile(t.a);
    const now = new Date().toISOString();
    await markConnection(me.sb, me.uid, "whoop", "direct", {
      external_user_id: String(profile.user_id), secret: sealTokens({ a: t.a, r: t.r, e: t.e }), expires_at: new Date(t.e * 1000).toISOString(),
      scopes: t.scope, status: "connected", connected_at: now, error: null, refreshing_at: null,
    });
    // the recent past straight away; a longer pull is one click in Profile
    try { await whoopSyncHistory(me.sb, me.uid, { user_id: me.uid, provider: "whoop", secret: sealTokens({ a: t.a, r: t.r, e: t.e }), external_user_id: String(profile.user_id), status: "connected" }, 30); }
    catch (e) { console.error("[connect/whoop] first sync", e); }
    return back("whoop-connected");
  } catch (e) {
    console.error("[connect/whoop]", e);
    return back(missing(e) ? "setup" : "whoop-error");
  }
}
