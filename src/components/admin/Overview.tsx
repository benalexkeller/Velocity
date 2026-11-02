"use client";
// Admin → Overview: counts only. Who signed up, who is active, how far people get, memberships, deletions, coach cost.
import { useEffect, useState } from "react";
import { adminApi, type Overview as Data } from "@/lib/admin/api";
import { Bars, Funnel, Tile, int, money, pct } from "./parts";

export function Overview() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { adminApi.overview().then(setD, (e: Error) => setErr(e.message)); }, []);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <p className="note">Loading…</p>;
  const free = Math.max(0, d.users - d.trial - d.pro - d.free_pro);
  return (
    <>
      <div className="adm-tiles">
        <Tile k="Accounts" v={int(d.users)} u={`${int(d.new_7)} new this week, ${int(d.new_30)} in 30 days`} />
        <Tile k="Active this week" v={int(d.active_7)} u={`${int(d.active_1)} today, ${int(d.active_30)} in 30 days`} />
        <Tile k="Pro (paying)" v={int(d.pro)} u="Stripe not connected yet" />
        <Tile k="Free Pro" v={int(d.free_pro)} u={`${int(d.trial)} on a trial`} />
        <Tile k="Deleted, 30 days" v={int(d.deleted_30)} u={`${int(d.deleted_all)} since counting began`} />
        <Tile k="Coach cost, 30 days" v={money(d.coach_cost_30)} u={`${int(d.coach_users_30)} athletes asked`} />
      </div>
      <div className="grid2">
        <section className="card">
          <h2>From sign-up to use <small>share of all accounts</small></h2>
          <Funnel steps={[
            { label: "Signed up", n: d.users },
            { label: "Finished setup", n: d.setup_done },
            { label: "Plan built", n: d.has_plan },
            { label: "Logged an activity", n: d.has_activity },
            { label: "Asked the coach (30 d)", n: d.coach_users_30 },
            { label: "Watch connected", n: d.watch },
            { label: "Google Calendar", n: d.calendar },
            { label: "Outlook", n: d.outlook },
            { label: "Apple Calendar", n: d.apple },
          ]} />
        </section>
        <section className="card">
          <h2>Sign-ups per week <small>last 12 weeks</small></h2>
          <Bars name="Sign-ups per week" data={d.signups.map((s) => ({ label: new Date(s.week).toLocaleDateString(undefined, { day: "numeric", month: "short" }), v: s.n }))} />
        </section>
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Memberships</h2>
          <table className="tbl small">
            <tbody>
              <tr><td>Free</td><td className="num">{int(free)}</td><td className="num muted">{pct(free, d.users)}</td></tr>
              <tr><td>Trial</td><td className="num">{int(d.trial)}</td><td className="num muted">{pct(d.trial, d.users)}</td></tr>
              <tr><td>Free Pro</td><td className="num">{int(d.free_pro)}</td><td className="num muted">{pct(d.free_pro, d.users)}</td></tr>
              <tr><td>Pro (paying)</td><td className="num">{int(d.pro)}</td><td className="num muted">{pct(d.pro, d.users)}</td></tr>
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 10 }}>Nothing in the app is locked by membership yet. Give or remove it under Users.</p>
        </section>
        <section className="card">
          <h2>Accounts</h2>
          <table className="tbl small">
            <tbody>
              <tr><td>Sign in with Google</td><td className="num">{int(d.google_signin)}</td></tr>
              <tr><td>Sign in with email</td><td className="num">{int(Math.max(0, d.users - d.google_signin))}</td></tr>
              <tr><td>Disabled</td><td className="num">{int(d.disabled)}</td></tr>
              <tr><td>Deleted, all time</td><td className="num">{int(d.deleted_all)}</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
