// POST /api/connect/<maker>/disconnect — ends Velocity's access at the maker and forgets the tokens. Activities and
// body values already in Velocity stay.
import { NextResponse, type NextRequest } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { directProvider, type ConnRow } from "@/lib/wearables/direct";
import { freshToken, unsealTokens } from "@/lib/wearables/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const p = await directProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown maker" }, { status: 404 });
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const { data } = await me.sb.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at").eq("user_id", me.uid).eq("provider", p.key).maybeSingle();
  const row = data as ConnRow | null;
  if (row?.secret && p.revoke) {
    try {
      const access = p.refresh ? await freshToken(me.sb, row, p.refresh) : unsealTokens(row.secret).a;
      await p.revoke(access, row.external_user_id ?? "");
    } catch (e) { console.error(`[connect/${p.key}/disconnect]`, e); }
  }
  await me.sb.from("integrations").update({ status: "disconnected", secret: null, expires_at: null, refreshing_at: null, error: null, updated_at: new Date().toISOString() }).eq("user_id", me.uid).eq("provider", p.key);
  return NextResponse.json({ ok: true });
}
