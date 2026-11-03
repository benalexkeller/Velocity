"use client";
// Admin → Users: every account with its facts and counts, search, filters, sorting, and a panel per account to
// give or remove membership, send a password reset email, disable or delete the account.
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, MEMBERSHIP, MEMBERSHIP_NOTE, type AdminUser } from "@/lib/admin/api";
import { MembershipPill, ago, day, int, when } from "./parts";

type Filter = "all" | "free" | "trial" | "free_pro" | "pro" | "ended" | "disabled" | "inactive" | "no_setup";
const FILTERS: { k: Filter; label: string; test: (u: AdminUser) => boolean }[] = [
  { k: "all", label: "All", test: () => true },
  { k: "free", label: "Free", test: (u) => u.access === "free" },
  { k: "trial", label: "Trial", test: (u) => u.access === "trial" },
  { k: "free_pro", label: "Free Pro", test: (u) => u.access === "free_pro" },
  { k: "pro", label: "Pro", test: (u) => u.access === "pro" },
  { k: "ended", label: "Ended", test: (u) => u.access === "ended" },
  { k: "inactive", label: "Inactive 30 d", test: (u) => !u.last_seen || Date.now() - new Date(u.last_seen).getTime() > 30 * 86_400_000 },
  { k: "no_setup", label: "Setup not done", test: (u) => !u.setup_done },
  { k: "disabled", label: "Disabled", test: (u) => u.disabled },
];
type Sort = "created_at" | "last_seen" | "coach_30" | "activities";
const who = (u: AdminUser) => u.name || (u.username ? `@${u.username}` : u.email) || u.id.slice(0, 8);

export function Users() {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("created_at");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => adminApi.users().then((r) => { setRows(r); setErr(null); }, (e: Error) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    const f = FILTERS.find((x) => x.k === filter)!;
    const val = (u: AdminUser) => (sort === "created_at" ? u.created_at : sort === "last_seen" ? u.last_seen ?? "" : sort === "coach_30" ? u.coach_30 : u.activities);
    return (rows ?? [])
      .filter((u) => f.test(u) && (!words || [u.name, u.username, u.email].some((s) => s?.toLowerCase().includes(words))))
      .sort((a, b) => { const x = val(a), y = val(b); return x < y ? 1 : x > y ? -1 : 0; });
  }, [rows, q, filter, sort]);
  const current = rows?.find((u) => u.id === open) ?? null;
  const head = (k: Sort, label: string) => <button type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{label}{sort === k ? " ↓" : ""}</button>;

  if (err) return <div className="err">{err}</div>;
  return (
    <>
      <div className="adm-tools">
        <input type="search" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
        <div className="pill-group" role="tablist" aria-label="Filter accounts">
          {FILTERS.map((f) => {
            const n = (rows ?? []).filter(f.test).length;
            if (f.k !== "all" && !n && filter !== f.k) return null;
            return <button key={f.k} type="button" role="tab" aria-selected={filter === f.k} className={filter === f.k ? "on" : ""} onClick={() => setFilter(f.k)}>{f.label}<span className="c">{n}</span></button>;
          })}
        </div>
      </div>
      <section className="card" style={{ padding: "6px 10px", overflow: "auto" }}>
        <table className="tbl small">
          <thead><tr><th>Athlete</th><th>Membership</th><th>{head("created_at", "Signed up")}</th><th>{head("last_seen", "Last active")}</th><th>Setup</th><th className="num">Plan weeks</th><th className="num">{head("activities", "Activities")}</th><th className="num">{head("coach_30", "Coach 30 d")}</th><th>Wearables</th><th>Calendar</th><th>Sign-in</th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={`row${open === u.id ? " sel" : ""}`} onClick={() => setOpen(u.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOpen(u.id); }}>
                <td><b>{who(u)}</b>{u.is_admin && <span className="flag admin">Admin</span>}{u.disabled && <span className="flag">Disabled</span>}<span className="sub">{[u.username && u.name ? `@${u.username}` : null, u.email].filter(Boolean).join(", ")}</span></td>
                <td><MembershipPill m={u.access} />{u.access_ends && u.access !== "ended" && <span className="sub">until {day(u.access_ends)}</span>}</td>
                <td>{day(u.created_at)}</td>
                <td>{ago(u.last_seen)}</td>
                <td>{u.setup_done ? "done" : <span className="muted">not yet</span>}</td>
                <td className="num">{u.plan_weeks ?? <span className="muted">-</span>}</td>
                <td className="num">{int(u.activities)}</td>
                <td className="num">{int(u.coach_30)}</td>
                <td>{u.wearables.length ? u.wearables.join(", ") : <span className="muted">-</span>}</td>
                <td>{u.calendars.length ? u.calendars.join(", ") : <span className="muted">-</span>}</td>
                <td>{u.signin === "google" ? "Google" : "Email"}</td>
              </tr>
            ))}
            {rows && !shown.length && <tr><td colSpan={11} className="muted" style={{ padding: 20 }}>No accounts match.</td></tr>}
            {!rows && <tr><td colSpan={11} className="muted" style={{ padding: 20 }}>Loading…</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="note">{rows ? `${shown.length} of ${rows.length} accounts. ` : ""}Account facts and counts only: training, body, meal and coach data stay private to each athlete.</p>
      {current && <UserPanel key={current.id} u={current} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function UserPanel({ u, onClose, onChanged }: { u: AdminUser; onClose: () => void; onChanged: () => Promise<void> }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <>
      <div className="adm-scrim" onClick={onClose} />
      <aside className="adm-panel" role="dialog" aria-modal="true" aria-label={`Account ${who(u)}`}>
        <header>
          <div><b>{who(u)}{u.is_admin && <span className="flag admin">Admin</span>}{u.disabled && <span className="flag">Disabled</span>}</b><small>{[u.username ? `@${u.username}` : null, u.email].filter(Boolean).join(", ")}</small></div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="body">
          <section>
            <h3>Account</h3>
            <div className="kv">
              <span>Signed up</span><span>{when(u.created_at)}</span>
              <span>Last active</span><span>{u.last_seen ? `${ago(u.last_seen)}, ${when(u.last_seen)}` : "never"}</span>
              <span>Sign-in</span><span>{u.signin === "google" ? "Google" : "Email and password"}</span>
              <span>Setup</span><span>{u.setup_done ? "done" : "not finished"}</span>
              <span>Race</span><span>{u.race ? `${u.race}${u.race_date ? `, ${day(u.race_date)}` : ""}` : "-"}</span>
              <span>Plan</span><span>{u.plan_weeks ? `${u.plan_weeks} weeks` : "none"}</span>
              <span>Activities</span><span>{int(u.activities)}</span>
              <span>Coach, 30 days</span><span>{int(u.coach_30)} questions</span>
              <span>Wearables</span><span>{u.wearables.length ? u.wearables.join(", ") : "none"}</span>
              <span>Calendars</span><span>{u.calendars.length ? u.calendars.join(", ") : "none"}</span>
            </div>
          </section>
          <AccessForm u={u} onChanged={onChanged} />
          {!u.is_admin && <AccountActions u={u} onChanged={onChanged} onDeleted={async () => { onClose(); await onChanged(); }} />}
          <p className="private">This panel shows account facts and counts only. Workouts, body data, meals, coach messages and calendar events are private to the athlete and not shown here.</p>
        </div>
      </aside>
    </>
  );
}

const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function AccessForm({ u, onChanged }: { u: AdminUser; onChanged: () => Promise<void> }) {
  const paid = u.access_kind === "paid";
  const [kind, setKind] = useState<"free" | "trial" | "comp">(u.access_kind === "trial" ? "trial" : u.access_kind === "comp" ? "comp" : "free");
  const [hasEnd, setHasEnd] = useState(u.access_kind ? !!u.access_ends : false);
  const [end, setEnd] = useState(u.access_ends ? u.access_ends.slice(0, 10) : inDays(14));
  const [note, setNote] = useState(u.access_note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pick = (k: "free" | "trial" | "comp") => { setKind(k); setMsg(null); if (k === "trial") { setHasEnd(true); if (!u.access_ends) setEnd(inDays(14)); } if (k === "comp" && u.access_kind !== "comp") setHasEnd(false); };
  async function save() {
    setBusy(true); setMsg(null);
    try {
      // the end date counts as the whole day, in the admin's own time zone
      const ends = kind !== "free" && hasEnd ? new Date(`${end}T23:59:59`).toISOString() : null;
      await adminApi.setAccess(u.id, kind, ends, kind === "free" ? "" : note);
      await onChanged();
      setMsg({ ok: true, text: "Saved." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Not saved." }); }
    setBusy(false);
  }
  return (
    <section>
      <h3>Membership</h3>
      <p style={{ fontSize: 13.5, margin: "0 0 10px" }}><MembershipPill m={u.access} /> {MEMBERSHIP_NOTE[u.access]}{u.access_ends ? ` ${u.access === "ended" ? "Ended" : "Ends"} ${day(u.access_ends)}.` : ""}{u.access_note ? ` Note: ${u.access_note}.` : ""}</p>
      {paid ? <p className="note">This athlete pays through Stripe. Change or cancel it in Stripe.</p> : (
        <div className="form">
          <div className="choices" role="radiogroup" aria-label="Membership">
            {(["free", "trial", "comp"] as const).map((k) => (
              <label key={k} className={kind === k ? "on" : ""}><input type="radio" name="kind" checked={kind === k} onChange={() => pick(k)} />{k === "comp" ? MEMBERSHIP.free_pro : MEMBERSHIP[k]}</label>
            ))}
          </div>
          {kind !== "free" && <>
            <div className="choices">
              <label className={!hasEnd ? "on" : ""}><input type="radio" name="end" checked={!hasEnd} onChange={() => setHasEnd(false)} />No end date</label>
              <label className={hasEnd ? "on" : ""}><input type="radio" name="end" checked={hasEnd} onChange={() => setHasEnd(true)} />Until a date</label>
            </div>
            {hasEnd && <input type="date" value={end} min={inDays(1)} onChange={(e) => setEnd(e.target.value)} aria-label="End date" />}
            <input type="text" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. beta tester, friend, club deal" aria-label="Note" />
          </>}
          <div className="row"><button type="button" className="btn small" disabled={busy || (kind !== "free" && hasEnd && !end)} onClick={save}>{busy ? "Saving…" : kind === "free" ? (u.access === "free" ? "Keep Free" : "Remove membership") : "Save membership"}</button></div>
          {msg && <div className={msg.ok ? "ok-note" : "err"}>{msg.text}</div>}
        </div>
      )}
    </section>
  );
}

function AccountActions({ u, onChanged, onDeleted }: { u: AdminUser; onChanged: () => Promise<void>; onDeleted: () => Promise<void> }) {
  const [ask, setAsk] = useState<"disable" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (f: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await f(); setMsg({ ok: true, text: ok }); setAsk(null); } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "That did not work." }); }
    setBusy(false);
  };
  return (
    <section>
      <h3>Account actions</h3>
      <div className="actions">
        {u.email && <div className="row"><button type="button" className="btn ghost small" disabled={busy} onClick={() => run(() => adminApi.sendReset(u.email!), `Reset email sent to ${u.email}.`)}>Send password reset email</button></div>}
        {u.disabled
          ? <div className="row"><button type="button" className="btn ghost small" disabled={busy} onClick={() => run(async () => { await adminApi.setDisabled(u.id, false); await onChanged(); }, "Account enabled. They can sign in again.")}>Enable account</button></div>
          : ask === "disable"
            ? <div className="confirm">Disable this account? They are signed out and cannot sign in until you enable it again. Nothing is deleted.
                <div className="row"><button type="button" className="btn danger small" disabled={busy} onClick={() => run(async () => { await adminApi.setDisabled(u.id, true); await onChanged(); }, "Account disabled.")}>Disable account</button><button type="button" className="btn ghost small" onClick={() => setAsk(null)}>Cancel</button></div></div>
            : <div className="row"><button type="button" className="btn ghost small" onClick={() => { setAsk("disable"); setMsg(null); }}>Disable account</button></div>}
        {ask === "delete"
          ? <div className="confirm">Delete this account and everything in it? Their plan, activities, body data, meals and coach messages are deleted, their Velocity calendars are removed from Google, Outlook and iCloud and their wearables are disconnected. This cannot be undone.
              <input type="text" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Reason, for the log (optional)" aria-label="Reason" style={{ font: "inherit", fontSize: 14, border: "1px solid var(--line)", borderRadius: 9, padding: "8px 10px" }} />
              <div className="row"><button type="button" className="btn danger small" disabled={busy} onClick={() => run(async () => { await adminApi.deleteUser(u.id, reason); await onDeleted(); }, "Account deleted.")}>{busy ? "Deleting…" : "Delete permanently"}</button><button type="button" className="btn ghost small" onClick={() => setAsk(null)}>Cancel</button></div></div>
          : <div className="row"><button type="button" className="btn danger small" onClick={() => { setAsk("delete"); setMsg(null); }}>Delete account</button></div>}
        {msg && <div className={msg.ok ? "ok-note" : "err"}>{msg.text}</div>}
      </div>
    </section>
  );
}
