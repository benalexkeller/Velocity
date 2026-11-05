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
