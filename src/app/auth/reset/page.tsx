"use client";
// Set a new password. Reached from the reset email: /auth/callback has already turned the link into a signed-in
// session, so this page only needs the new password. Without a session the link has expired or was used.
import "../../account.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/config";
import { supabase } from "@/lib/supabase/client";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { PasswordInput } from "@/components/account/PasswordInput";

export default function ResetPassword() {
  const router = useRouter();
  // undefined while checking, null when nobody is signed in
  const [email, setEmail] = useState<string | null | undefined>(() => (ACCOUNTS_ON ? undefined : null));
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null), () => setEmail(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return;
    setBusy(true); setErr(null);
    const { error } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (!error) { setDone(true); setPassword(""); return; }
    if (/session/i.test(error.message)) { setEmail(null); return; }
    setErr(error.message);
  }

  return (
    <main className="auth">
      <section className="card box">
        <span className="wordmark">{BRAND.name}</span>
        {email === undefined ? <p className="sub">Checking your link…</p>
          : email === null ? <>
            <h1>Link expired</h1>
            <p className="sub">This reset link has expired or was already used. A link works once, for one hour.</p>
            <Link className="btn wide" href="/login?mode=forgot">Ask for a new link</Link>
          </>
          : done ? <>
            <h1>Password changed</h1>
            <p className="sub">You&apos;re signed in as {email}. Next time, sign in with the new password.</p>
            <button type="button" className="btn wide" onClick={() => { router.replace("/dashboard"); router.refresh(); }}>Open {BRAND.name}</button>
          </>
          : <>
            <h1>Set a new password</h1>
            <p className="sub">For {email}.</p>
            <form className="form" onSubmit={submit}>
              <label><b>New password</b><PasswordInput required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" autoFocus /></label>
              {err && <div className="err">{err}</div>}
              <button type="submit" className="btn wide" disabled={busy}>{busy ? "…" : "Save new password"}</button>
            </form>
          </>}
      </section>
    </main>
  );
}
