"use client";
import "../account.css";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/config";
import { supabase } from "@/lib/supabase/client";
import { ACCOUNTS_ON } from "@/lib/supabase/env";

export default function LoginPage() {
  return <Suspense fallback={null}><Login /></Suspense>;
}

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" /><path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" /></svg>;
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const linkError = params.get("error");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(linkError ? "That sign-in link didn't work. Try again." : null);
  const [note, setNote] = useState<string | null>(null);

  if (!ACCOUNTS_ON) {
    return (
      <main className="auth"><section className="card box"><span className="wordmark">{BRAND.name}</span><h1>Sign in</h1><p className="sub">Sign-in is not available yet. Your data is kept on this device.</p><button type="button" className="btn" onClick={() => router.push("/dashboard")}>Open the app</button></section></main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabase(); if (!sb) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      if (mode === "up") {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/setup` } });
        if (error) throw error;
        if (data.session) { router.replace("/setup"); router.refresh(); return; }
        setNote("Check your email for a confirmation link, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace(next); router.refresh();
      }
    } catch (x) { setErr(x instanceof Error ? x.message : "Something went wrong."); }
    setBusy(false);
  }
  async function google() {
    const sb = supabase(); if (!sb) return;
    setErr(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
    if (error) setErr(error.message.includes("not enabled") ? "Google sign-in isn't switched on yet. Use email and password." : error.message);
  }

  return (
    <main className="auth">
      <section className="card box">
        <span className="wordmark">{BRAND.name}</span>
        <h1>{mode === "in" ? "Sign in" : "Create your account"}</h1>
        {mode === "up" && <p className="sub">Free during testing. Only you can see your data.</p>}
        <button type="button" className="btn google" onClick={google}><GoogleMark />Continue with Google</button>
        <div className="or">or with email</div>
        <form className="form" onSubmit={submit}>
          {mode === "up" && <label><b>Name</b><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last name" /></label>}
          <label><b>Email</b><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label><b>Password</b><input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder={mode === "up" ? "At least 8 characters" : ""} /></label>
          {err && <div className="err">{err}</div>}
          {note && <div className="ok-note">{note}</div>}
          <button type="submit" className="btn wide" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="switch">{mode === "in" ? <>No account yet? <button type="button" onClick={() => { setMode("up"); setErr(null); }}>Create one</button></> : <>Already have one? <button type="button" onClick={() => { setMode("in"); setErr(null); }}>Sign in</button></>}</div>
      </section>
    </main>
  );
}
