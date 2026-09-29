// Accounts are on when the two public Supabase values are set (Vercel → Environment Variables).
// Without them the app runs in local mode: no login, everything saved in this browser (development).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const ACCOUNTS_ON = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
