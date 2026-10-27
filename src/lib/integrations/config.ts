// Which wearable connections are switched on. A connection is on when the middleman's values exist on the
// server (Vercel → Environment Variables). Server-side only; the browser asks /api/connect/status.
export type ProviderKey = "garmin";

/** The middleman that holds Garmin's partner access for us: "junction" once chosen and paid for, "" before. */
export const WEARABLE_PROVIDER = process.env.WEARABLE_PROVIDER ?? "";
export const WEARABLE_API_KEY = process.env.WEARABLE_API_KEY ?? "";
export const WEARABLE_REGION = process.env.WEARABLE_REGION || "sandbox-us";
export const WEARABLE_WEBHOOK_SECRET = process.env.WEARABLE_WEBHOOK_SECRET ?? "";
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** True when "Connect Garmin" can actually connect. */
export const GARMIN_ON = WEARABLE_PROVIDER === "junction" && Boolean(WEARABLE_API_KEY);
