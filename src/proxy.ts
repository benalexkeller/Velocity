// Runs before every page: keeps the login session fresh and sends signed-out visitors to /login.
// In local mode (no Supabase values) it does nothing.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/auth"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  let user: unknown = null;
  try { user = (await supabase.auth.getUser()).data.user; } catch { user = null; }
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = path && path !== "/" ? `?next=${encodeURIComponent(path)}` : "";
    return NextResponse.redirect(to);
  }
  if (user && path === "/login") {
    const to = request.nextUrl.clone();
    to.pathname = "/dashboard";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml)$).*)"],
};
