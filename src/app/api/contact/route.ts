// POST /api/contact: the contact form on /help. Anyone can send it, signed in or not. The message goes into the
// same `feedback` table the in-app feedback uses (tab "contact"), so it shows up on the admin page.
// Writes with the service-role client when SUPABASE_SERVICE_ROLE_KEY is set; otherwise with the visitor's own
// client, which needs the "contact form" insert policy from supabase/schema.sql.
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!ACCOUNTS_ON) return NextResponse.json({ error: "local" }, { status: 503 });
  let b: { name?: string; email?: string; username?: string; message?: string; website?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Could not read the form." }, { status: 400 }); }
  // the hidden "website" field is only ever filled in by bots
  if (b.website) return NextResponse.json({ ok: true });
  const name = String(b.name ?? "").trim().slice(0, 120);
  const email = String(b.email ?? "").trim().slice(0, 200);
  const username = String(b.username ?? "").trim().replace(/^@/, "").slice(0, 60);
  const message = String(b.message ?? "").trim().slice(0, 5000);
  if (!name) return NextResponse.json({ error: "Add your name." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Add an email address we can answer." }, { status: 400 });
  if (message.length < 5) return NextResponse.json({ error: "Write your message." }, { status: 400 });

  const sb = await supabaseServer();
  const { data: u } = sb ? await sb.auth.getUser() : { data: { user: null } };
  const row = {
    user_id: u.user?.id ?? null, email, username: username || null, tab: "contact", kind: "contact",
    message: `From: ${name}\n\n${message}`, page: "/help",
    ua: req.headers.get("user-agent")?.slice(0, 200) ?? null, viewport: null,
  };
  const db = supabaseAdmin() ?? sb;
  if (!db) return NextResponse.json({ error: "local" }, { status: 503 });
  const { error } = await db.from("feedback").insert(row);
  if (error) {
    console.error("[contact]", error.message);
    return NextResponse.json({ error: "The message could not be saved. Try again in a minute." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
