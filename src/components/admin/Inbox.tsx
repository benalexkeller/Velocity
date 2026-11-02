"use client";
// Admin → Inbox: feedback from the app, messages from the Help page's contact form, and why people deleted their
// account. Each can be marked done.
import { useEffect, useState } from "react";
import { FEEDBACK_KINDS, FEEDBACK_TABS, listFeedback, setFeedbackStatus, type FeedbackEntry } from "@/lib/feedback";
import { DELETE_TAB } from "@/lib/account/deleteReasons";
import { when } from "./parts";

const label = (list: { k: string; label: string }[], k: string) => list.find((x) => x.k === k)?.label ?? k;

export function Inbox() {
  const [fb, setFb] = useState<FeedbackEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { listFeedback().then(setFb).catch((e) => setErr(e instanceof Error ? e.message : "Could not load feedback.")); }, []);
  const open = (fb ?? []).filter((e) => e.status !== "done");
  const shown = showDone ? fb ?? [] : open;
  const flip = async (e: FeedbackEntry) => {
    const status = e.status === "done" ? "open" : "done";
    setFb((cur) => (cur ?? []).map((x) => (x.id === e.id ? { ...x, status } : x)));
    try { await setFeedbackStatus(e.id, status); } catch (x) { setErr(x instanceof Error ? x.message : "Not saved."); }
  };
  return (
    <>
      <div className="tabs-row">
        <span className="note">{fb ? `${open.length} open, ${fb.length - open.length} done` : err ? "" : "Loading…"}</span>
        <button type="button" className="btn ghost small" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide done" : "Show done"}</button>
      </div>
      {err && <div className="err">{err}</div>}
      <section className="card" style={{ padding: "6px 10px", overflow: "auto" }}>
        <table className="tbl small">
          <thead><tr><th>When</th><th>Who</th><th>Where</th><th>Kind</th><th>Message</th><th>Page, browser</th><th></th></tr></thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className={e.status === "done" ? "muted" : ""}>
                <td>{when(e.created_at)}</td>
                <td>{e.tab === "contact" ? <>{e.email ?? "-"}{e.username ? <span className="sub">@{e.username}</span> : null}</> : e.username ? `@${e.username}` : e.email ?? "-"}</td>
                <td>{e.tab === "contact" ? "Contact form" : e.tab === DELETE_TAB ? "Account deleted" : label(FEEDBACK_TABS, e.tab)}</td>
                <td>{e.kind === "contact" ? "Message" : e.tab === DELETE_TAB ? "Reason" : label(FEEDBACK_KINDS, e.kind)}</td>
                <td className="wrap">{e.message}</td>
                <td className="muted" style={{ fontSize: 11.5 }}>{e.page ?? "-"}{e.viewport ? `, ${e.viewport}` : ""}{e.ua ? `, ${e.ua.replace(/^Mozilla\/5\.0 /, "").slice(0, 60)}` : ""}</td>
                <td><button type="button" className="btn ghost small" onClick={() => flip(e)}>{e.status === "done" ? "Reopen" : "Mark done"}</button></td>
              </tr>
            ))}
            {fb && !shown.length && <tr><td colSpan={7} className="muted" style={{ padding: 20 }}>{showDone ? "No feedback yet." : "Nothing open."}</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}
