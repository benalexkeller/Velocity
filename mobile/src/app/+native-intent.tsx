// Links that open the app. Google sign-in comes back on velocity://auth (exp://.../--/auth in Expo Go) with a
// one-time code: finish the sign-in and go to Today instead of looking for an "auth" page.
import { finishSignIn, isSignInReturn } from "@/lib/supabase";

export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (isSignInReturn(path)) { await finishSignIn(path); return "/"; }
    return path;
  } catch {
    return "/";
  }
}
