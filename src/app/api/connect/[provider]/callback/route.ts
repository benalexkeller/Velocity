// GET /api/connect/<maker>/callback — the maker sends the athlete back here. Turns the one-time code into tokens
// (stored encrypted), notes the maker's id for the athlete, pulls the recent past, and returns to the app with
// ?wearable=<maker>-connected (or -denied / -error / -off / setup).
import { NextResponse, type NextRequest } from "next/server";
import { athlete, safeNext } from "@/lib/calendar/server";
import { directProvider } from "@/lib/wearables/direct";
import { markConnection } from "@/lib/wearables/import";
import { sealTokens } from "@/lib/wearables/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const missing = (e: unknown) => /secret|dup_of|external_id|schema cache|does not exist/i.test(String((e as Error)?.message ?? e));

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = await directProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown maker" }, { status: 404 });
  const cookie = `vel_${p.key}`;
  let saved: { state?: string; next?: string; verifier?: string } = {};
  try { saved = JSON.parse(req.cookies.get(cookie)?.value ?? "{}"); } catch { saved = {}; }
  const next = safeNext(saved.next ?? null);
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}wearable=${flag}`, req.nextUrl.origin));
    res.cookies.set(cookie, "", { maxAge: 0, path: `/api/connect/${p.key}` });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (!p.on()) return back(`${p.key}-off`);
  if (q.get("error")) return back(q.get("error") === "access_denied" ? `${p.key}-denied` : `${p.key}-error`);
  if (!saved.state || q.get("state") !== saved.state || !q.get("code")) return back(`${p.key}-error`);
  const me = await athlete();
  if (!me) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(next)}`, req.nextUrl.origin));
  try {
    const t = await p.exchange(q.get("code")!, `${req.nextUrl.origin}/api/connect/${p.key}/callback`, saved.verifier);
    if (!t.a) return back(`${p.key}-error`);
    const who = await p.identity(t.a, { externalUserId: t.externalUserId });
    if (p.afterConnect) await p.afterConnect(t.a, { externalUserId: who.id, uid: me.uid });
    const tokens = { a: t.a, r: t.r, e: t.e };
    const now = new Date().toISOString();
    await markConnection(me.sb, me.uid, p.key, "direct", {
      external_user_id: who.id, secret: sealTokens(tokens), expires_at: new Date(t.e * 1000).toISOString(), scopes: t.scope ?? null,
      ...(who.device ? { device: who.device } : {}), status: "connected", connected_at: now, error: null, refreshing_at: null,
    });
    // the recent past straight away; a longer pull is one click in Profile
    try { await p.history(me.sb, me.uid, { user_id: me.uid, provider: p.key, secret: sealTokens(tokens), external_user_id: who.id, status: "connected" }, Math.min(30, p.maxDays)); }
    catch (e) { console.error(`[connect/${p.key}] first sync`, e); }
    return back(`${p.key}-connected`);
  } catch (e) {
    console.error(`[connect/${p.key}]`, e);
    if (missing(e)) return back("setup");
    // a reason the athlete can act on (Google Health profile not set up) travels in the flag's note
    const msg = String((e as Error)?.message ?? "");
    const res = back(`${p.key}-error`);
    if (/Google Health app/i.test(msg)) res.cookies.set("vel_connect_note", msg.slice(0, 200), { maxAge: 120, path: "/", sameSite: "lax" });
    return res;
  }
}
