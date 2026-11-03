// GET /api/connect/garmin/callback — Garmin sends the athlete back here (Garmin's own program). Turns the one-time
// code into tokens (stored encrypted), asks Garmin for the athlete's id and permissions, and returns to the app.
// Starter tier has no history: activities arrive as the watch syncs from now on.
import { NextResponse, type NextRequest } from "next/server";
import { athlete, safeNext } from "@/lib/calendar/server";
import { markConnection } from "@/lib/wearables/import";
import { sealTokens } from "@/lib/wearables/tokens";
import { garminBackfill, garminConfig, garminDirectOn, garminExchange, garminPermissions, garminUserId } from "@/lib/wearables/garmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "vel_garmin";
const missing = (e: unknown) => /secret|dup_of|external_id|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

export async function GET(req: NextRequest) {
  let saved: { state?: string; verifier?: string; next?: string } = {};
  try { saved = JSON.parse(req.cookies.get(COOKIE)?.value ?? "{}"); } catch { saved = {}; }
  const next = safeNext(saved.next ?? null);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
    res.cookies.set(COOKIE, "", { maxAge: 0, path: "/api/connect/garmin" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (!garminDirectOn()) return back("garmin-off");
  if (q.get("error")) return back(q.get("error") === "access_denied" ? "garmin-denied" : "garmin-error");
  if (!saved.state || !saved.verifier || q.get("state") !== saved.state || !q.get("code")) return back("garmin-error");
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  try {
    const t = await garminExchange(q.get("code")!, saved.verifier, `${req.nextUrl.origin}/api/connect/garmin/callback`);
    if (!t.a || !t.r) return back("garmin-error");
    const [garminId, permissions] = await Promise.all([garminUserId(t.a), garminPermissions(t.a).catch(() => [] as string[])]);
    const now = new Date().toISOString();
    await markConnection(me.sb, me.uid, "garmin", "direct", {
      external_user_id: garminId, secret: sealTokens({ a: t.a, r: t.r, e: t.e }), expires_at: new Date(t.e * 1000).toISOString(),
      scopes: (permissions ?? []).join(" "), status: "connected", connected_at: now, error: null, refreshing_at: null,
    });
    // Enterprise tier: ask for the last 30 days now; it arrives through the push endpoint over the next minutes
    if (garminConfig().backfill) {
      const end = Date.now() / 1000, start = end - 30 * 86400;
      for (const kind of ["activities", "dailies", "sleeps", "hrv", "userMetrics"] as const) await garminBackfill(t.a, kind, start, end).catch((e) => console.error("[connect/garmin] backfill", kind, e));
    }
    return back("garmin-connected");
  } catch (e) {
    console.error("[connect/garmin/callback]", e);
    return back(missing(e) ? "setup" : "garmin-error");
  }
}
