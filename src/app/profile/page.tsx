"use client";
import "../account.css";
import { Fragment, useState } from "react";
import Link from "next/link";
import { ConnectWearable, WEARABLES, useWearables } from "@/components/ConnectWearable";
import { usePlan } from "@/lib/store";
import { ProfileForm } from "@/components/account/ProfileForm";
import { dateLabel } from "@/lib/format";

export default function ProfilePage() {
  const plan = usePlan();
  const a = plan.athlete;
  const [importing, setImporting] = useState(false);
  const initials = a.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="main">
      <div className="acct">
        <div className="page-head"><div><h1>Profile</h1><div className="muted sub">{plan.accounts ? "Your account" : "Local mode · no account"}</div></div></div>
        <section className="card">
          <div className="head">
            <span className="avatar">{a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : initials}</span>
            <div><b>{a.name}</b><small>{a.username ? `@${a.username} · ` : ""}{a.email ?? "no email"}{a.isAdmin ? " · admin" : ""}</small></div>
          </div>
          {plan.accounts ? <ProfileForm mode="edit" /> : <p className="muted" style={{ fontSize: 14 }}>Accounts are off in local mode.</p>}
        </section>
        <section className="card">
          <h2>Plan</h2>
          <div className="kv">
            <span>Weeks</span><span>{plan.hasPlan ? `${plan.planJson.length} · starts ${dateLabel(plan.planJson[0].start)}` : "No plan yet"}</span>
            <span>Race</span><span>{a.hasRace ? `${a.race.name} · ${dateLabel(a.race.date)} ${a.race.date.slice(0, 4)}${a.race.goal ? ` · ${a.race.goal}` : ""}` : "Not set"}</span>
            <span>Activities</span><span>{plan.activities.length}</span>
            <span>Local changes</span><span>{plan.changes}</span>
          </div>
          {plan.accounts && a.isAdmin && !plan.hasPlan && <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn ghost" disabled={importing} onClick={async () => { setImporting(true); try { await plan.importSeed(); } finally { setImporting(false); } }}>{importing ? "Importing…" : "Import my seed data"}</button></div>}
        </section>
        <section className="card">
          <h2>Connections</h2>
          <ProfileConnections />
        </section>
        {plan.accounts && a.isAdmin && <Link href="/admin" className="link">Admin · user list →</Link>}
      </div>
    </main>
  );
}

function ProfileConnections() {
  const { picked } = useWearables();
  return (
    <>
      <div className="kv">
        {WEARABLES.filter((w) => picked.includes(w.k)).map((w) => <Fragment key={w.k}><span>{w.name}</span><span>Picked · connects when live</span></Fragment>)}
        {!picked.length && <><span>Wearable</span><span>None picked</span></>}
        <span>Google Calendar</span><span>Not available yet</span>
      </div>
      <div style={{ marginTop: 12 }}><ConnectWearable variant="ghost" /></div>
    </>
  );
}
