// The same Supabase project as the website: same accounts, same rows, same row rules (an athlete only reads their own).
// The sign-in is kept on the phone and refreshed while the app is open.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const CONFIGURED = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = CONFIGURED
  ? createClient(URL, KEY, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce", // Google sign-in comes back with a one-time code the app swaps for a session
        lock: processLock,
      },
    })
  : null;

if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Finishes a sign-in that came back to the app: a one-time code (PKCE), or tokens in the link (older flow). */
export async function finishSignIn(url: string) {
  if (!supabase) return false;
  // read the link by hand: app links (velocity://, exp://) are not web addresses
  const query = url.split("#")[0].split("?")[1] ?? "", hash = url.split("#")[1] ?? "";
  const get = (s: string, k: string) => { const m = s.match(new RegExp(`(?:^|&)${k}=([^&]+)`)); return m ? decodeURIComponent(m[1]) : null; };
  const code = get(query, "code");
  if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;
  const access_token = get(hash, "access_token"), refresh_token = get(hash, "refresh_token");
  if (access_token && refresh_token) return !(await supabase.auth.setSession({ access_token, refresh_token })).error;
  return false;
}
