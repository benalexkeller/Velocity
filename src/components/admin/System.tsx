"use client";
// Admin → System: quick links to the services Velocity runs on, the log of admin actions, watch connections and the
// last Garmin webhook calls.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { adminApi, type AuditEntry } from "@/lib/admin/api";
import { when } from "./parts";

interface Conn { user_id: string; email: string | null; username: string | null; provider: string; via: string; status: string; connected_at: string | null; last_event_at: string | null; error: string | null }
interface Hook { id: number; via: string; event_type: string | null; external_user_id: string | null; ok: boolean; note: string | null; created_at: string }

const LINKS = [
  { label: "Supabase: database and logins", href: "https://supabase.com/dashboard/project/hngrtoufmjauqdkhncbp" },
  { label: "Supabase: logs", href: "https://supabase.com/dashboard/project/hngrtoufmjauqdkhncbp/logs/explorer" },
  { label: "Vercel: website", href: "https://vercel.com/dashboard" },
  { label: "OpenRouter: coach spend", href: "https://openrouter.ai/activity" },
  { label: "Google Cloud: verification", href: "https://console.cloud.google.com/auth/verification?project=velocity-510714" },
  { label: "GitHub: code", href: "https://github.com/benalexkeller/Velocity" },
];
const ACTION: Record<string, string> = { access: "Membership", disabled: "Disabled", enabled: "Enabled", deleted: "Deleted account" };

export function System() {
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [auditErr, setAuditErr] = useState<string | null>(null);
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [connErr, setConnErr] = useState<string | null>(null);
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  useEffect(() => {
    adminApi.audit(200).then(setAudit, (e: Error) => setAuditErr(e.message));
    const sb = supabase(); if (!sb) return;
    sb.rpc("admin_integrations").then(({ data, error }) => { if (error) setConnErr(error.message.includes("admin_integrations") ? "Run supabase/schema-integrations.sql to see connections." : error.message); else setConns((data as Conn[]) ?? []); });
    sb.rpc("admin_webhook_log", { n: 50 }).then(({ data, error }) => { if (!error) setHooks((data as Hook[]) ?? []); });
  }, []);
  return (
    <>
      <section className="card">
        <h2>Services</h2>
        <div className="adm-links">{LINKS.map((l) => <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
      </section>
      <section className="card" style={{ overflow: "auto" }}>
        <h2>Admin log <small>every membership change, disable, enable and deletion</small></h2>
        {auditErr && <div className="err">{auditErr}</div>}
        <table className="tbl small">
          <thead><tr><th>When</th><th>By</th><th>Athlete</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {(audit ?? []).map((a) => <tr key={a.id}><td>{when(a.created_at)}</td><td>{a.admin ?? "-"}</td><td>{a.athlete ?? <span className="muted">deleted account</span>}</td><td>{ACTION[a.action] ?? a.action}</td><td className="wrap">{a.detail ?? ""}</td></tr>)}
            {audit && !audit.length && <tr><td colSpan={5} className="muted" style={{ padding: 16 }}>Nothing yet.</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="card" style={{ overflow: "auto" }}>
        <h2>Watch connections <small>{conns ? `${conns.filter((c) => c.status === "connected").length} connected, ${conns.length} total` : ""}</small></h2>
        {connErr && <div className="err">{connErr}</div>}
        <table className="tbl small">
          <thead><tr><th>Who</th><th>Device</th><th>Through</th><th>Status</th><th>Connected</th><th>Last data</th><th>Error</th></tr></thead>
          <tbody>
            {(conns ?? []).map((c) => <tr key={`${c.user_id}-${c.provider}`}><td>{c.username ? `@${c.username}` : c.email ?? c.user_id.slice(0, 8)}</td><td>{c.provider}</td><td>{c.via}</td><td>{c.status}</td><td>{when(c.connected_at)}</td><td>{when(c.last_event_at)}</td><td className="muted" style={{ fontSize: 11.5 }}>{c.error ?? ""}</td></tr>)}
            {conns && !conns.length && <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>No connections yet.</td></tr>}
          </tbody>
        </table>
      </section>
      <WebhookSetup />
      {hooks && hooks.length > 0 && (
        <section className="card" style={{ overflow: "auto" }}>
          <h2>Webhook calls <small>last {hooks.length}</small></h2>
          <table className="tbl small">
            <thead><tr><th>When</th><th>Event</th><th>Athlete id</th><th>Result</th></tr></thead>
            <tbody>{hooks.map((h) => <tr key={h.id} className={h.ok ? "" : "muted"}><td>{when(h.created_at)}</td><td>{h.event_type ?? "-"}</td><td className="muted" style={{ fontSize: 11.5 }}>{h.external_user_id?.slice(0, 8) ?? "-"}</td><td>{h.ok ? "ok" : "failed"}{h.note ? `, ${h.note}` : ""}</td></tr>)}</tbody>
          </table>
        </section>
      )}
    </>
  );
}

/** Google Health (Fitbit) and Polar take their webhook address by an API call, not a portal setting: one click each,
 *  once the maker's keys are in Vercel. The others (WHOOP, Garmin, Wahoo, COROS, Suunto) are set in their portals. */
function WebhookSetup() {
  const [state, setState] = useState<Record<string, { on?: boolean; registered?: unknown; error?: string }> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const load = () => fetch("/api/admin/wearable-webhooks", { cache: "no-store" }).then((r) => r.json()).then(setState).catch(() => setState({}));
  useEffect(() => { void load(); }, []);
  const register = async (maker: "fitbit" | "polar") => {
    setBusy(maker); setOut(null);
    try { const r = await fetch("/api/admin/wearable-webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maker }) }); const j = await r.json(); setOut(JSON.stringify(j, null, 1).slice(0, 1500)); await load(); }
    catch (e) { setOut(String((e as Error).message)); }
    setBusy(null);
  };
  const line = (k: "fitbit" | "polar", label: string) => {
    const st = state?.[k];
    const text = !state ? "…" : !st?.on ? "keys not in Vercel yet" : st.error ? `error: ${st.error}` : typeof st.registered === "string" ? st.registered : st.registered && JSON.stringify(st.registered) !== "{}" ? "registered" : "not registered";
    return <tr key={k}><td>{label}</td><td>{text}</td><td>{st?.on && <button type="button" className="btn small ghost" disabled={busy === k} onClick={() => register(k)}>{busy === k ? "…" : "Register webhook"}</button>}</td></tr>;
  };
  return (
    <section className="card" style={{ overflow: "auto" }}>
      <h2>Webhook set-up <small>Google Health (Fitbit) and Polar register by a call; the rest in their portals</small></h2>
      <table className="tbl small"><thead><tr><th>Maker</th><th>State</th><th /></tr></thead><tbody>{line("fitbit", "Fitbit, through Google Health")}{line("polar", "Polar")}</tbody></table>
      {out && <pre className="muted" style={{ fontSize: 11.5, whiteSpace: "pre-wrap", marginTop: 8 }}>{out}</pre>}
    </section>
  );
}
