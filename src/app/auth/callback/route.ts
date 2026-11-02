// Where Google, email confirmation links and password reset links send the browser back to. Turns the one-time code
// into a signed-in session, then continues to the app (a reset link continues to /auth/reset).
// Two link shapes: ?token_hash=…&type=… (Velocity's own email templates, supabase/email-templates; works in any browser
// and on any device), and ?code=… (Google sign-in, and Supabase's default emails, which only work in the browser where
// the link was asked for).
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = OTP_TYPES.find((t) => t === searchParams.get("type"));
  const asked = searchParams.get("next") ?? (type === "recovery" ? "/auth/reset" : "/dashboard");
  const next = asked.startsWith("/") && !asked.startsWith("//") ? asked : "/dashboard";
  const reset = next === "/auth/reset";
  const supabase = await supabaseServer();
  if (supabase) {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?${reset ? "error=reset&mode=forgot" : "error=link"}`);
}
