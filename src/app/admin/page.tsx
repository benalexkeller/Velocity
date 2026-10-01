"use client";
import "../account.css";
import { useEffect, useState } from "react";
import { usePlan } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { FEEDBACK_KINDS, FEEDBACK_TABS, listFeedback, setFeedbackStatus, type FeedbackEntry } from "@/lib/feedback";

interface Row { id: string; email: string | null; username: string | null; name: string | null; created_at: string; last_seen: string | null; setup_done: boolean; race: string | null; race_date: string | null; activities: number }
const when = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

// Only the admin gets rows back; everyone else sees an empty table (the database enforces it).
export default function AdminPage() {
  const plan = usePlan();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fb, setFb] = useState<FeedbackEntry[] | null>(null);
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => { const sb = supabase(); if (!sb) return; sb.rpc("admin_users").then(({ data, error }) => { if (error) setErr(error.message); else setRows((data as Row[]) ?? []); }); }, []);
  useEffect(() => { listFeedback().then(setFb).catch((e) => setFbErr(e instanceof Error ? e.message : "Could not load feedback.")); }, []);
  const label = (list: { k: string; label: string }[], k: string) => list.find((x) => x.k === k)?.label ?? k;
  const flip = async (e: FeedbackEntry) => { const status = e.status === "done" ? "open" : "done"; setFb((cur) => (cur ?? []).map((x) => (x.id === e.id ? { ...x, status } : x))); try { await setFeedbackStatus(e.id, status); } catch (x) { setFbErr(x instanceof Error ? x.message : "Could not update."); } };
  const open = (fb ?? []).filter((e) => e.status !== "done");
  const shown = showDone ? fb ?? [] : open;
  if (!plan.accounts) return <main className="main"><div className="admin"><div className="page-head"><h1>Admin</h1></div><p className="muted">Accounts are off in this copy.</p></div></main>;
  if (!plan.athlete.isAdmin) return <main className="main"><div className="admin"><div className="page-head"><h1>Admin</h1></div><p className="muted">This page is for the admin account.</p></div></main>;
  return (
    <main className="main">
      <div className="admin">
        <div className="page-head"><div><h1>Users</h1><div className="muted sub">{rows ? `${rows.length} account${rows.length === 1 ? "" : "s"}` : "Loading…"}</div></div></div>
        {err && <div className="form"><div className="err">{err}</div></div>}
        <div className="card" style={{ overflow: "auto" }}>
          <table className="tbl small">
            <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Signed up</th><th>Last seen</th><th>Setup</th><th>Race</th><th>Activities</th></tr></thead>
            <tbody>
              {(rows ?? []).map((r) => <tr key={r.id}><td>{r.name ?? "—"}</td><td>{r.username ? `@${r.username}` : "—"}</td><td>{r.email ?? "—"}</td><td>{when(r.created_at)}</td><td>{when(r.last_seen)}</td><td>{r.setup_done ? "done" : "not yet"}</td><td>{r.race ? `${r.race}${r.race_date ? ` · ${r.race_date}` : ""}` : "—"}</td><td>{r.activities}</td></tr>)}
              {rows && !rows.length && <tr><td colSpan={8} className="muted" style={{ padding: 20 }}>No accounts yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="page-head" style={{ marginTop: 28 }}><div><h1>Feedback</h1><div className="muted sub">{fb ? `${open.length} open · ${(fb.length - open.length)} done` : fbErr ? "" : "Loading…"}</div></div><span className="grow" /><button type="button" className="btn ghost small" onClick={() => setShowDone((v) => !v)}>{showDone ? "Hide done" : "Show done"}</button></div>
        {fbErr && <div className="form"><div className="err">{fbErr}</div></div>}
        <div className="card" style={{ overflow: "auto" }}>
          <table className="tbl small fb-table">
            <thead><tr><th>When</th><th>Who</th><th>Part</th><th>Kind</th><th>Comment</th><th>Page · browser</th><th></th></tr></thead>
            <tbody>
              {shown.map((e) => <tr key={e.id} className={e.status === "done" ? "muted" : ""}><td style={{ whiteSpace: "nowrap" }}>{when(e.created_at)}</td><td>{e.username ? `@${e.username}` : e.email ?? "—"}</td><td>{label(FEEDBACK_TABS, e.tab)}</td><td>{label(FEEDBACK_KINDS, e.kind)}</td><td style={{ whiteSpace: "pre-wrap", minWidth: 260 }}>{e.message}</td><td className="muted" style={{ fontSize: 11.5 }}>{e.page ?? "—"}{e.viewport ? ` · ${e.viewport}` : ""}{e.ua ? ` · ${e.ua.replace(/^Mozilla\/5\.0 /, "").slice(0, 60)}` : ""}</td><td><button type="button" className="btn ghost small" onClick={() => flip(e)}>{e.status === "done" ? "Reopen" : "Mark done"}</button></td></tr>)}
              {fb && !shown.length && <tr><td colSpan={7} className="muted" style={{ padding: 20 }}>{showDone ? "No feedback yet." : "Nothing open."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
