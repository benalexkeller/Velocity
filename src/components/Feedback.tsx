"use client";
// The red "Give feedback" button in the top bar and the form it opens: which part of the app, what kind of
// feedback, the comment. The page you were on is attached automatically.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { usePlan } from "@/lib/store";
import { FEEDBACK_KINDS, FEEDBACK_TABS, submitFeedback, tabForPath } from "@/lib/feedback";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="fb-top">
        <button type="button" className="fb-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><Icon name="note" /><span>Give feedback</span></button>
        <span className="fb-beta" title="Velocity is in beta: things change weekly and some parts are unfinished.">Beta</span>
      </span>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const path = usePathname();
  const plan = usePlan();
  const [tab, setTab] = useState(tabForPath(path));
  const [kind, setKind] = useState("bug");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  const hint = FEEDBACK_KINDS.find((k) => k.k === kind)?.hint ?? "";
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (msg.trim().length < 3) { setErr("Write what you want us to know."); return; }
    setBusy(true); setErr(null);
    try {
      await submitFeedback({ tab, kind, message: msg.trim(), page: path, email: plan.athlete.email ?? null, username: plan.athlete.username ?? null });
      setDone(true);
    } catch (x) { setErr(x instanceof Error ? x.message : "Could not send."); }
    setBusy(false);
  }
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fb-modal" role="dialog" aria-label="Give feedback" onClick={onClose}>
      <form className="box form" onClick={(e) => e.stopPropagation()} onSubmit={send}>
        <div className="hd"><div><div className="eyebrow fb-red">Beta feedback</div><h2>What should we know?</h2></div><button type="button" className="close" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        {done ? (
          <div className="fb-done">
            <b>Sent.</b>
            <span>Every entry is read. Fixes and changes show up on the site; there is no reply by email unless we need a detail.</span>
            <div className="row"><button type="button" className="btn" onClick={onClose}>Close</button><button type="button" className="btn ghost" onClick={() => { setDone(false); setMsg(""); }}>Send another</button></div>
          </div>
        ) : (
          <>
            <label><b>Which part of the app?</b><div className="days">{FEEDBACK_TABS.map((t) => <button key={t.k} type="button" className={tab === t.k ? "on" : ""} onClick={() => setTab(t.k)}>{t.label}</button>)}</div></label>
            <label><b>What kind of feedback?</b><div className="days">{FEEDBACK_KINDS.map((k) => <button key={k.k} type="button" className={kind === k.k ? "on" : ""} onClick={() => setKind(k.k)}>{k.label}</button>)}</div></label>
            <label><b>Your comment</b><textarea value={msg} onChange={(e) => { setMsg(e.target.value); setErr(null); }} rows={5} placeholder={hint || "Anything."} autoFocus /></label>
            <span className="hint">Attached automatically: this page ({path}), your account{plan.athlete.email ? ` (${plan.athlete.email})` : ""}, browser and screen size. Nothing else.</span>
            {err && <div className="err">{err}</div>}
            <div className="row"><button type="submit" className="btn fb-send" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
          </>
        )}
      </form>
    </div>,
    document.body,
  );
}
