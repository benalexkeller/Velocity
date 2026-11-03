"use client";
import "../account.css";
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ConnectWearable, WEARABLES, connectionText, useConnections, useWearables } from "@/components/ConnectWearable";
import type { WearableKey } from "@/lib/wearables/providers";
import { usePlan } from "@/lib/store";
import { ProfileForm } from "@/components/account/ProfileForm";
import { CalendarCard } from "@/components/account/CalendarCard";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { dateFull, dateLabel } from "@/lib/format";
import { Membership } from "@/components/account/Membership";

export default function ProfilePage() {
  const plan = usePlan();
  const a = plan.athlete;
  const [importing, setImporting] = useState(false);
  const initials = a.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <main className="main">
      <div className="acct">
        <div className="page-head"><div><h1>Profile</h1><div className="muted sub">{plan.accounts ? "Your account" : "Saved on this device"}</div></div></div>
        <section className="card">
          <div className="head">
            <span className="avatar">{a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : initials}</span>
            <div><b>{a.name}</b><small>{a.username ? `@${a.username}, ` : ""}{a.email ?? "no email"}{a.isAdmin ? ", admin" : ""}</small></div>
          </div>
          {plan.accounts ? <ProfileForm mode="edit" /> : <p className="muted" style={{ fontSize: 14 }}>Profile editing arrives with accounts.</p>}
        </section>
        <section className="card">
          <h2>Plan</h2>
          <div className="kv">
            <span>Weeks</span><span>{plan.hasPlan ? `${plan.planJson.length}, starts ${dateLabel(plan.planJson[0].start)}` : "No plan yet"}</span>
            <span>Race</span><span>{a.hasRace ? `${a.race.name}, ${dateFull(a.race.date)}${a.race.goal ? `, ${a.race.goal}` : ""}` : "Not set"}</span>
            <span>Activities</span><span>{plan.activities.length}</span>
            {plan.accounts && <Membership />}
            {!plan.accounts && <><span>Changes on this device</span><span>{plan.changes}</span></>}
          </div>
          {plan.accounts && a.isAdmin && !plan.hasPlan && <div className="row" style={{ marginTop: 12 }}><button type="button" className="btn ghost" disabled={importing} onClick={async () => { setImporting(true); try { await plan.importSeed(); } finally { setImporting(false); } }}>{importing ? "Importing…" : "Import my seed data"}</button></div>}
        </section>
        <section className="card">
          <h2>Connections</h2>
          <ProfileConnections />
        </section>
        <section className="card" id="calendar">
          <h2>Calendar</h2>
          <CalendarCard />
        </section>
        {plan.accounts && (
          <section className="card" id="delete">
            <h2>Delete account</h2>
            <DeleteAccount />
          </section>
        )}
        {plan.accounts && a.isAdmin && <Link href="/admin" className="link">Admin →</Link>}
      </div>
    </main>
  );
}

const FLAG: Record<string, string> = {
  "garmin-connected": "Garmin connected. Activities arrive on their own as your watch syncs.",
  "garmin-denied": "Garmin was not connected: the permission was not given.",
  "garmin-error": "Garmin did not connect. Try again; if it fails twice, send feedback.",
  "garmin-off": "Garmin is not switched on for this site yet.",
  "whoop-connected": "WHOOP connected. The last 30 days are in; new sleep, recovery and workouts arrive on their own.",
  "whoop-denied": "WHOOP was not connected: the permission was not given.",
  "whoop-error": "WHOOP did not connect. Try again; if it fails twice, send feedback.",
  "whoop-off": "WHOOP is not switched on for this site yet.",
  setup: "Wearable connections are not set up on this site yet.",
};
// the same four outcomes for the makers on the shared routes
for (const [k, name, after] of [["fitbit", "Fitbit", "The last 30 days are in; new workouts, sleep and health values arrive on their own through Google."], ["polar", "Polar", "The last 30 days are in; new exercises, nights and Nightly Recharge arrive on their own."], ["wahoo", "Wahoo", "Recent rides and runs are in; new ones arrive on their own."], ["coros", "COROS", "The last 30 days are in; new workouts arrive on their own."], ["suunto", "Suunto", "The last 30 days are in; new workouts arrive on their own."]] as const) {
  FLAG[`${k}-connected`] = `${name} connected. ${after}`;
  FLAG[`${k}-denied`] = `${name} was not connected: the permission was not given.`;
  FLAG[`${k}-error`] = `${name} did not connect. Try again; if it fails twice, send feedback.`;
  FLAG[`${k}-off`] = `${name} is not switched on for this site yet.`;
}
/** A reason the maker gave (set by the callback for two minutes), shown with the flag. */
const connectNote = () => (typeof document === "undefined" ? "" : decodeURIComponent((document.cookie.match(/(?:^|; )vel_connect_note=([^;]*)/) ?? [])[1] ?? ""));

function ProfileConnections() {
  const { picked } = useWearables();
  const { status, of, isLive } = useConnections();
  // ?wearable=whoop-connected (or garmin-error…) when a maker sends the athlete back; read once
  const [flag] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("wearable")));
  useEffect(() => { const u = new URL(window.location.href); if (u.searchParams.has("wearable")) { u.searchParams.delete("wearable"); window.history.replaceState(null, "", u.toString()); } }, []);
  const note = flag ? [FLAG[flag], flag.endsWith("-error") ? connectNote() : ""].filter(Boolean).join(" ") || null : null;
  const rows = WEARABLES.filter((w) => isLive(w.k) || of(w.k)?.status === "connected" || picked.includes(w.k));
  return (
    <>
      {note && <p className="small" style={{ margin: "0 0 10px" }}>{note}</p>}
      <div className="kv">
        {rows.map((w) => {
          const c = of(w.k);
          const text = connectionText(w.k as WearableKey, c, status.live[w.k]) ?? (isLive(w.k) ? "Not connected" : w.k === "apple" ? "Connects through the Velocity iPhone app, coming soon" : "Picked, connects when live");
          return <Fragment key={w.k}><span>{w.name}</span><span>{text}</span></Fragment>;
        })}
        {!rows.length && <><span>Wearable</span><span>None picked</span></>}
      </div>
      <div style={{ marginTop: 12 }}><ConnectWearable variant="ghost" /></div>
    </>
  );
}
