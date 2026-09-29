"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNTS_ON, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;
/** The browser-side Supabase client (one per page). null in local mode. */
export function supabase(): SupabaseClient | null {
  if (!ACCOUNTS_ON) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
