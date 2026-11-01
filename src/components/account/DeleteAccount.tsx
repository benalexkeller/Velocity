"use client";
// Profile → Delete account. First click opens the confirmation with an optional "why are you leaving" question
// (common reasons, plus Other with a text box); then the account and everything in it is deleted
// (POST /api/account/delete) and the browser goes back to the front page, signed out. The answer never blocks
// the deletion.
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DELETE_REASONS } from "@/lib/account/deleteReasons";

export function DeleteAccount() {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, other: reason === "other" ? other.trim() : "" }) });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "The account was not deleted. Try again.");
      try { await supabase()?.auth.signOut({ scope: "local" }); } catch { /* already signed out */ }
      try { localStorage.removeItem("velocity.store.v1"); } catch { /* storage unavailable */ }
      window.location.replace("/");
    } catch (e) { setErr(e instanceof Error ? e.message : "The account was not deleted. Try again."); setBusy(false); }
  };
  return (
    <div className="cal-card">
      <p className="muted small" style={{ margin: "0 0 12px" }}>Deletes your account and everything in it: profile, plan, activities, body data, nutrition, coach messages and feedback. Your Velocity training calendar is removed from Google Calendar and your watch connection is ended. This cannot be undone.</p>
      {!asking ? (
        <button type="button" className="btn danger small" onClick={() => setAsking(true)}>Delete my account</button>
      ) : (
        <div className="cal-ask del-ask">
          <fieldset className="del-reasons">
            <legend>Why are you deleting your account? <span className="muted">Optional, and not linked to you.</span></legend>
            {DELETE_REASONS.map((r) => (
              <label key={r.k}>
                <input type="radio" name="delete-reason" value={r.k} checked={reason === r.k} onChange={() => setReason(r.k)} />
                <span>{r.label}</span>
              </label>
            ))}
            {reason === "other" && <textarea value={other} onChange={(e) => setOther(e.target.value.slice(0, 500))} placeholder="Tell us what happened" rows={3} aria-label="Other reason" />}
          </fieldset>
          <span>Delete your account and all your data now?</span>
          <div className="row">
            <button type="button" className="btn danger small" disabled={busy} onClick={go}>{busy ? "Deleting" : "Yes, delete everything"}</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => { setAsking(false); setReason(null); setOther(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {err && <p className="small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}
