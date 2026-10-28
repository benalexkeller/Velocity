import { ACCOUNTS_ON } from "@/lib/supabase/env";
/** The main button on the public pages: create an account, or open the app in local mode. */
export const START = ACCOUNTS_ON ? { href: "/login?mode=up", label: "Create account" } : { href: "/dashboard", label: "Open the app" };
