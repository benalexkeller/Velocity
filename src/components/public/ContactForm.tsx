"use client";
// The contact form on /help: name, email, username (optional), message. With accounts on it posts to
// /api/contact; in local mode it keeps the message in this browser's feedback list (as in-app feedback does).
import { useState } from "react";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { submitFeedback } from "@/lib/feedback";

export function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", username: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setErr(null); };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      if (ACCOUNTS_ON) {
        const r = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) throw new Error(j.error || "The message could not be sent.");
      } else {
        if (!f.name.trim() || !f.email.trim() || f.message.trim().length < 5) throw new Error("Add your name, your email and a message.");
        await submitFeedback({ tab: "contact", kind: "contact", message: `From: ${f.name.trim()}\n\n${f.message.trim()}`, page: "/help", email: f.email.trim(), username: f.username.trim() || null });
      }
      setSent(true);
    } catch (x) { setErr(x instanceof Error ? x.message : "The message could not be sent."); }
    setBusy(false);
  }

  if (sent) return <div className="lg-sent" role="status"><b>Message sent</b><span>We answer at {f.email.trim()}, usually within two working days.</span></div>;
  return (
    <form className="lg-form" onSubmit={send} noValidate>
      <div className="two">
        <label><b>Name</b><input value={f.name} onChange={set("name")} autoComplete="name" required /></label>
        <label><b>Email</b><input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>
      </div>
      <label><b>Username <small>if you have an account</small></b><input value={f.username} onChange={set("username")} autoComplete="username" placeholder="@" /></label>
      <label><b>Message</b><textarea value={f.message} onChange={set("message")} required placeholder="What happened, or what you would like to know" /></label>
      <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row"><button type="submit" className="btn lp-big" disabled={busy}>{busy ? "Sending" : "Send message"}</button><span className="note">Your message goes to the Velocity team only.</span></div>
    </form>
  );
}
