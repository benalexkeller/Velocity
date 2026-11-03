// Server only. One shape for every maker that connects through the shared routes (/api/connect/<maker>,
// /api/connect/<maker>/callback, /sync, /disconnect and /api/webhooks/<maker>): Fitbit (through Google Health),
// Polar, Wahoo, COROS and Suunto. Garmin and WHOOP keep their own routes (written first; same ideas). A maker is
// "on" when its keys are in Vercel; the routes answer "<maker>-off" until then, and the Connect sheet shows Junction
// for COROS, Polar, Suunto and Wahoo when that is on instead.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { DirectKey } from "./providers";
import type { TokenRow, Tokens } from "./tokens";

export interface ConnRow extends TokenRow { external_user_id: string | null; status: string; device?: string | null }

export interface DirectProvider {
  key: DirectKey;
  /** keys present on the server */
  on(): boolean;
  /** PKCE code challenge in the sign-in link (the verifier travels in the cookie) */
  pkce?: boolean;
  /** the maker's sign-in page */
  authLink(redirectUri: string, state: string, challenge?: string): string;
  /** the one-time code → tokens (and whatever the maker says about the athlete) */
  exchange(code: string, redirectUri: string, verifier?: string): Promise<Tokens & { scope?: string; externalUserId?: string }>;
  /** a fresh access token; missing when the maker's tokens do not expire (Polar) */
  refresh?(refreshToken: string): Promise<Tokens>;
  /** the maker's id for the athlete (and the device, when known) */
  identity(access: string, hint?: { externalUserId?: string }): Promise<{ id: string; device?: string }>;
  /** anything the maker needs once per athlete (Polar: register the athlete with Velocity's id as the member id) */
  afterConnect?(access: string, ids: { externalUserId: string; uid: string }): Promise<void>;
  /** ends Velocity's access at the maker */
  revoke?(access: string, externalUserId: string): Promise<void>;
  /** the last `days` days into the athlete's account */
  history(sb: SupabaseClient, uid: string, row: ConnRow, days: number): Promise<{ workouts: number; bodyDays: number; note?: string }>;
  /** how far back `history` can go (days); the Sync button offers up to this */
  maxDays: number;
  /** the maker's webhook: verify, find the athlete, save; always answer fast. Absent when the maker has no push. */
  webhook?(req: NextRequest, raw: string, admin: SupabaseClient): Promise<Response>;
  /** errors from the maker that mean "connect again" */
  accessLost(e: unknown): boolean;
}

/** The provider for a key, or null when the key is not a direct maker. Imported lazily so one maker's module
 *  does not load for another's request. */
export async function directProvider(key: string): Promise<DirectProvider | null> {
  switch (key) {
    case "fitbit": return (await import("./fitbit")).fitbit;
    case "polar": return (await import("./polar")).polar;
    case "wahoo": return (await import("./wahoo")).wahoo;
    case "coros": return (await import("./coros")).coros;
    case "suunto": return (await import("./suunto")).suunto;
    default: return null;
  }
}

/** Which direct makers are switched on (keys present). Cheap: only reads env. */
export async function directLive(): Promise<Partial<Record<DirectKey, true>>> {
  const out: Partial<Record<DirectKey, true>> = {};
  for (const k of ["fitbit", "polar", "wahoo", "coros", "suunto"] as const) { const p = await directProvider(k); if (p?.on()) out[k] = true; }
  return out;
}

// ---------- shared helpers for the maker modules ----------
export const env = (k: string) => process.env[k] ?? "";

/** The connected rows for a maker's user id (normally one; two when a person linked the same device account to
 *  two Velocity accounts, and both get the data). Service role: webhooks have no athlete session. */
export async function rowsFor(admin: SupabaseClient, provider: string, externalUserId: string): Promise<ConnRow[]> {
  if (!externalUserId) return [];
  const { data } = await admin.from("integrations").select("user_id, provider, secret, external_user_id, status, expires_at, refreshing_at, device").eq("provider", provider).eq("external_user_id", externalUserId);
  return ((data ?? []) as ConnRow[]).filter((r) => r.secret && r.status !== "disconnected");
}

export class MakerError extends Error {
  constructor(public maker: string, public status: number, message: string) { super(message); }
}

/** A JSON (or empty) call to a maker's API with a bearer token; throws MakerError with the status. */
export type Init = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };
export async function makerFetch<T>(maker: string, url: string, access: string | null, init: Init = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) throw new MakerError(maker, res.status, text.slice(0, 300) || String(res.status));
  try { return (text ? JSON.parse(text) : {}) as T; } catch { throw new MakerError(maker, res.status, "not JSON"); }
}

/** An OAuth 2.0 token call (form body). `basic` sends the client id and secret in the Authorization header. */
export async function tokenPost(maker: string, url: string, body: Record<string, string>, basic?: { id: string; secret: string }): Promise<Tokens & { scope?: string; raw: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...(basic ? { Authorization: `Basic ${Buffer.from(`${basic.id}:${basic.secret}`).toString("base64")}` } : {}) },
    body: new URLSearchParams(body), signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let j: Record<string, unknown> = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = {}; }
  if (!res.ok) throw new MakerError(maker, res.status, String(j.error_description ?? j.error ?? text.slice(0, 200)));
  const expiresIn = Number(j.expires_in ?? 3600);
  return { a: String(j.access_token ?? ""), r: String(j.refresh_token ?? ""), e: Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600), scope: typeof j.scope === "string" ? j.scope : undefined, raw: j };
}

/** "PT1H2M3.5S" (ISO 8601 duration) → seconds; also plain "3600s" and numbers. */
export function secondsOf(d: unknown): number {
  if (typeof d === "number") return d;
  if (typeof d !== "string") return 0;
  const plain = /^(\d+(?:\.\d+)?)s$/.exec(d);
  if (plain) return Number(plain[1]);
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(d);
  if (!m) return Number(d) || 0;
  return (Number(m[1] ?? 0) * 86400) + (Number(m[2] ?? 0) * 3600) + (Number(m[3] ?? 0) * 60) + Number(m[4] ?? 0);
}
