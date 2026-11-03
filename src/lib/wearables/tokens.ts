// Server only. The maker's sign-in tokens for one connection, stored sealed in integrations.secret, and a fresh
// access token when one is needed. Refresh tokens rotate at WHOOP and Garmin, and WHOOP invalidates the old one
// at once, so two refreshes at the same moment (two webhooks for one athlete) would lock the athlete out: a short
// lock in the row lets only one refresh run; the others wait for its result.
import type { SupabaseClient } from "@supabase/supabase-js";
import { seal, unseal } from "@/lib/calendar/google";

export interface Tokens { a: string; r: string; /** access token expiry, seconds since epoch */ e: number }
export const sealTokens = (t: Tokens) => seal(JSON.stringify(t));
export const unsealTokens = (s: string): Tokens => JSON.parse(unseal(s)) as Tokens;

export interface TokenRow { user_id: string; provider: string; secret: string | null; expires_at?: string | null; refreshing_at?: string | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A working access token for this connection, refreshing (and saving the rotated tokens) when needed. */
export async function freshToken(sb: SupabaseClient, row: TokenRow, refresh: (refreshToken: string) => Promise<Tokens>): Promise<string> {
  if (!row.secret) throw new Error("not connected");
  let t = unsealTokens(row.secret);
  if (t.e - 90 > Date.now() / 1000) return t.a;
  // try to take the lock: only one refresh at a time per connection
  const { data: got } = await sb.rpc("wearable_refresh_lock", { p_user: row.user_id, p_provider: row.provider });
  if (got === true) {
    try {
      // the row may have changed while we waited for the lock: read the secret again
      const { data: cur } = await sb.from("integrations").select("secret").eq("user_id", row.user_id).eq("provider", row.provider).maybeSingle();
      if (cur?.secret) t = unsealTokens(String(cur.secret));
      if (t.e - 90 > Date.now() / 1000) return t.a;
      const next = await refresh(t.r);
      await sb.from("integrations").update({ secret: sealTokens(next), expires_at: new Date(next.e * 1000).toISOString(), refreshing_at: null, updated_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("provider", row.provider);
      return next.a;
    } catch (e) {
      await sb.from("integrations").update({ refreshing_at: null }).eq("user_id", row.user_id).eq("provider", row.provider);
      throw e;
    }
  }
  // someone else is refreshing: wait for the new secret
  for (let i = 0; i < 10; i++) {
    await wait(700);
    const { data: cur } = await sb.from("integrations").select("secret, refreshing_at").eq("user_id", row.user_id).eq("provider", row.provider).maybeSingle();
    if (cur?.secret) { const n = unsealTokens(String(cur.secret)); if (n.e - 90 > Date.now() / 1000) return n.a; }
    if (!cur?.refreshing_at) break;
  }
  throw new Error("token refresh did not finish");
}

/** Access lost for good (the athlete removed Velocity at the maker, or the refresh token expired). */
export class AccessLost extends Error {
  constructor(public provider: string, message = "Access was removed. Connect again.") { super(message); }
}
