// Server-only Supabase client with the service-role key: it can write any athlete's rows, so it is used only
// by webhooks (which carry no athlete session). Never import this from a component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";
import { SERVICE_ROLE_KEY } from "@/lib/integrations/config";

let client: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!client) client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
