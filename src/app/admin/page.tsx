"use client";
import "../account.css";
import { useEffect, useState } from "react";
import { usePlan } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";

interface Row { id: string; email: string | null; username: string | null; name: string | null; created_at: string; last_seen: string | null; setup_done: boolean; race: string | null; race_date: string | null; activities: number }
const when = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

// Only the admin gets rows back; everyone else sees an empty table (the database enforces it).
export default function AdminPage() {
  const plan = usePlan();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const sb = supabase(); if (!sb) return; sb.rpc("admin_users").then(({ data, error }) => { if (error) setErr(error.message); else setRows((data as Row[]) ?? []); }); }, []);
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
      </div>
    </main>
  );
}
