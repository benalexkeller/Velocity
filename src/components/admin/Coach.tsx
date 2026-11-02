"use client";
// Admin → Coach: how much the coach is used and what it costs. Counts and money only, never the messages.
import { useEffect, useState } from "react";
import { adminApi, type CoachUsage } from "@/lib/admin/api";
import { Bars, Tile, day, int, money } from "./parts";

const PERIODS = [7, 30, 90] as const;
const TIER: Record<string, string> = { fast: "Questions", strong: "Plan reviews" };

export function Coach() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [d, setD] = useState<CoachUsage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { let live = true; adminApi.coach(days).then((r) => { if (live) { setD(r); setErr(null); } }, (e: Error) => live && setErr(e.message)); return () => { live = false; }; }, [days]);
  if (err) return <div className="err">{err}</div>;
  const questions = d?.daily.reduce((s, x) => s + x.questions, 0) ?? 0;
  const cost = d?.daily.reduce((s, x) => s + x.cost, 0) ?? 0;
  const requests = d?.models.reduce((s, m) => s + m.requests, 0) ?? 0;
  const label = (s: string) => new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <>
      <div className="tabs-row">
        <div className="pill-group" role="tablist" aria-label="Period">
          {PERIODS.map((p) => <button key={p} type="button" role="tab" aria-selected={days === p} className={days === p ? "on" : ""} onClick={() => setDays(p)}>{p} days</button>)}
        </div>
        {d && <span className="note">{d.logged_from ? `Cost is recorded from ${day(d.logged_from)}; questions before that are counted without cost.` : "Cost is recorded from the first coach question after this update."}</span>}
      </div>
      {!d ? <p className="note">Loading…</p> : <>
        <div className="adm-tiles">
          <Tile k="Questions" v={int(questions)} u={`${int(d.athletes.length)} athletes asked`} />
          <Tile k="Cost" v={money(cost)} u={`${int(requests)} answers with a recorded cost`} />
          <Tile k="Cost per answer" v={requests ? money(cost / requests) : "-"} u="all models together" />
          <Tile k="Cost per athlete" v={d.athletes.length ? money(cost / d.athletes.length) : "-"} u={`over ${days} days`} />
          <Tile k="Daily limit reached" v={int(d.capped)} u="questions refused at the limit" />
          <Tile k="Failed answers" v={int(d.failed)} u="no model answered" />
        </div>
        <div className="grid2">
          <section className="card"><h2>Questions per day</h2><Bars name="Questions per day" data={d.daily.map((x) => ({ label: label(x.day), v: x.questions }))} /></section>
          <section className="card"><h2>Cost per day</h2><Bars name="Cost per day" fmt={money} data={d.daily.map((x) => ({ label: label(x.day), v: x.cost }))} /></section>
        </div>
        <section className="card" style={{ overflow: "auto" }}>
          <h2>By model</h2>
          <table className="tbl small">
            <thead><tr><th>Model</th><th>Used for</th><th className="num">Answers</th><th className="num">Tokens in</th><th className="num">Tokens out</th><th className="num">Cost</th><th className="num">Per answer</th></tr></thead>
            <tbody>
              {d.models.map((m) => <tr key={`${m.model}-${m.tier}`}><td>{m.model}</td><td>{TIER[m.tier] ?? m.tier}</td><td className="num">{int(m.requests)}</td><td className="num">{int(m.tokens_in)}</td><td className="num">{int(m.tokens_out)}</td><td className="num">{money(m.cost)}</td><td className="num">{m.requests ? money(m.cost / m.requests) : "-"}</td></tr>)}
              {!d.models.length && <tr><td colSpan={7} className="muted" style={{ padding: 16 }}>No answers with a recorded cost in this period.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card" style={{ overflow: "auto" }}>
          <h2>By athlete <small>top 50 by questions</small></h2>
          <table className="tbl small">
            <thead><tr><th>Athlete</th><th className="num">Questions</th><th className="num">Cost</th><th className="num">Days at the limit</th></tr></thead>
            <tbody>
              {d.athletes.map((a) => <tr key={a.id}><td>{a.who}</td><td className="num">{int(a.questions)}</td><td className="num">{money(a.cost)}</td><td className="num">{int(a.capped_days)}</td></tr>)}
              {!d.athletes.length && <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>Nobody asked the coach in this period.</td></tr>}
            </tbody>
          </table>
        </section>
      </>}
    </>
  );
}
