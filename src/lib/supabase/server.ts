import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ACCOUNTS_ON, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Server-side Supabase client bound to the request's cookies (route handlers, server components). */
export async function supabaseServer() {
  if (!ACCOUNTS_ON) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return store.getAll(); },
      setAll(list) { try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ } },
    },
  });
}
