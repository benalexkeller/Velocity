// Where Google (and email confirmation links) send the browser back to. Turns the one-time code
// into a signed-in session, then continues to the app.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const supabase = await supabaseServer();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/dashboard"}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
