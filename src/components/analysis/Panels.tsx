"use client";
import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { RouteMap } from "../RouteMap";
import { CoachNote } from "../CoachNote";
import type { Activity } from "@/lib/data";
import { useAnalysis } from "@/lib/useAnalysis";
import { addDays, dateLabel, fmtHMS, fmtHours, fmtPace, fromYmd, shortDate, today } from "@/lib/format";
import { elev, fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";

export type Range = 4 | 12 | 99;
type Sp = "swim" | "bike" | "run";
const UNIT: Record<Sp, string> = { run: `min${runPace(0).u}`, swim: `min${swimPace(0).u}`, bike: "mph" };
const fmtV = (sp: Sp, v: number) => (sp === "bike" ? fmtSpeed(v).replace(" mph", "") : sp === "run" ? fmtPace(runPace(v).s) : fmtPace(swimPace(v).s));
const sign = (n: number | null, digits = 0) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}`);

// ---------- Row 1: scores ----------
function Spark({ pts, w = 120, h = 34 }: { pts: (number | null)[]; w?: number; h?: number }) {
  const v = pts.filter((p): p is number => p != null);
  if (v.length < 2) return <svg className="chart spark" width={w} height={h} />;
  const lo = Math.min(...v), hi = Math.max(...v);
  const y = (n: number) => (hi === lo ? h / 2 : h - 4 - ((n - lo) / (hi - lo)) * (h - 8));
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (w - 8);
  const d = pts.map((p, i) => (p == null ? "" : `${i === 0 || pts[i - 1] == null ? "M" : "L"}${x(i)} ${y(p)}`)).join("");
  const last = pts.length - 1;
  return (
    <svg className="chart spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {pts[last] != null && <circle cx={x(last)} cy={y(pts[last] as number)} r={3.5} fill="var(--accent)" />}
    </svg>
  );
}

export function LoadChart({ range }: { range: Range }) {
  const { LOAD_SERIES } = useAnalysis();
  const days = range === 99 ? LOAD_SERIES.length : Math.min(LOAD_SERIES.length, range * 7);
  const pts = LOAD_SERIES.slice(-days);
  const W = 640, H = 200, L = 36, R = 12, T = 12, B = 26;
  const top = Math.max(10, Math.ceil((Math.max(...pts.map((p) => Math.max(p.fitness, p.fatigue))) * 1.25) / 5) * 5);
  const bottom = Math.min(0, Math.floor((Math.min(...pts.map((p) => p.form)) * 1.1) / 5) * 5);
  const y = (v: number) => T + ((top - v) / (top - bottom)) * (H - T - B);
  const x = (i: number) => L + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - L - R));
  const maxLoad = Math.max(1, ...pts.map((p) => p.load));
  const yLoad = (v: number) => y(0) - (v / maxLoad) * (y(0) - T) * 0.9; // daily load on its own scale (bars)
  const line = (k: "fitness" | "fatigue" | "form") => pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p[k])}`).join("");
  const step = top - bottom > 40 ? 20 : top - bottom > 20 ? 10 : 5;
  const ticks: number[] = []; for (let v = bottom; v <= top; v += step) ticks.push(v);
  const labelEvery = Math.max(1, Math.round(pts.length / 5));
  return (
    <section className="card chartcard an-load" aria-label="Fitness, fatigue and form">
      <div className="head">
        <span className="eyebrow">Fitness · Fatigue · Form</span>
        <span className="lgd"><span><i style={{ background: "var(--accent)" }} />Fitness</span><span><i style={{ background: "var(--run)" }} />Fatigue</span><span><i style={{ background: "var(--swim)" }} />Form</span><span><i style={{ background: "var(--track)" }} />Daily load</span></span>
      </div>
      <div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Load model over time">
          {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke={v === 0 ? "var(--line)" : "var(--grid)"} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
          {pts.map((p, i) => p.load ? <rect key={p.date} x={x(i) - 2} y={yLoad(p.load)} width={4} height={y(0) - yLoad(p.load)} fill="var(--track)" rx={1} /> : null)}
          <path d={line("fatigue")} fill="none" stroke="var(--run)" strokeWidth={1.5} />
          <path d={line("form")} fill="none" stroke="var(--swim)" strokeWidth={1.5} />
          <path d={line("fitness")} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          {pts.map((p, i) => (i === pts.length - 1 || i % labelEvery === 0) && i < pts.length - labelEvery / 2 || i === pts.length - 1 ? <text key={"l" + p.date} x={x(i)} y={H - 8} textAnchor={i === pts.length - 1 ? "end" : i === 0 ? "start" : "middle"}>{shortDate(p.date)}</text> : null)}
        </svg>
      </div>
      <div className="side">
        <div><div className="k">Fitness</div><div className="v">{pts[pts.length - 1].fitness.toFixed(0)}</div><div className="u">42-day load</div></div>
        <div><div className="k">Fatigue</div><div className="v">{pts[pts.length - 1].fatigue.toFixed(0)}</div><div className="u">7-day load</div></div>
        <div><div className="k">Form</div><div className="v">{sign(pts[pts.length - 1].form)}</div><div className="u">fitness − fatigue</div></div>
      </div>
    </section>
  );
}

// ---------- Weekly volume, stacked by discipline ----------
export function VolumeStack({ range }: { range: Range }) {
  const an = useAnalysis();
  const [sp, setSp] = useState<"all" | Sp>("all");
  const weeks = an.volumeWeekly(range === 99 ? 99 : range);
  const W = 640, H = 210, L = 34, R = 10, T = 14, B = 26;
  const val = (w: (typeof weeks)[number], k: "actual" | "planned") => (sp === "all" ? w[k].swim + w[k].bike + w[k].run + w[k].other : w[k][sp]);
  const max = Math.max(2, Math.ceil(Math.max(...weeks.flatMap((w) => [val(w, "actual"), val(w, "planned")])) / 2) * 2);
  const y = (h: number) => H - B - (h / max) * (H - T - B);
  const gw = (W - L - R) / Math.max(1, weeks.length), bw = Math.min(34, gw * 0.36);
  const tot = weeks.reduce((s, w) => s + val(w, "actual"), 0), plan = weeks.reduce((s, w) => s + val(w, "planned"), 0);
  return (
    <section className="card chartcard" aria-label="Weekly volume">
      <div className="head">
        <span className="eyebrow">Weekly volume · hours</span>
        <div className="pill-group">{(["all", "swim", "bike", "run"] as const).map((k) => <button key={k} type="button" className={sp === k ? "on" : ""} onClick={() => setSp(k)}>{k === "all" ? "Tri" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
      </div>
      <div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hours per week, actual versus planned">
          {Array.from({ length: max / 2 + 1 }, (_, k) => k * 2).map((h) => <g key={h}><line x1={L} y1={y(h)} x2={W - R} y2={y(h)} stroke="var(--grid)" /><text x={L - 8} y={y(h) + 4} textAnchor="end">{h}</text></g>)}
          {weeks.map((w, i) => {
            const cx = L + i * gw + gw / 2;
            const segs = sp === "all" ? [["run", w.actual.run, "var(--run)"], ["bike", w.actual.bike, "var(--bike)"], ["swim", w.actual.swim, "var(--swim)"], ["other", w.actual.other, "var(--strength-soft)"]] as const : [[sp, w.actual[sp], "var(--accent)"]] as const;
            let acc = 0;
            return (
              <g key={w.week}>
                <rect x={cx + 2} y={y(val(w, "planned"))} width={bw} height={Math.max(0, y(0) - y(val(w, "planned")))} fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity={0.5} rx={2} />
                {segs.map(([k, v, c]) => { const r = <rect key={k} x={cx - bw - 2} y={y(acc + v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={c} rx={1} />; acc += v; return v ? r : null; })}
                <text x={cx} y={H - 8} textAnchor="middle">W{w.week}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="side">
        <div><div className="k">Total</div><div className="v">{fmtHours(tot)}</div><div className="u">of {fmtHours(plan)} planned</div></div>
        <div><div className="k">Average per week</div><div className="v">{fmtHours(weeks.length ? tot / weeks.length : 0)}</div><div className="u">{weeks.length} weeks</div></div>
        {sp === "all" && <div className="lgd col"><span><i style={{ background: "var(--swim)" }} />Swim</span><span><i style={{ background: "var(--bike)" }} />Bike</span><span><i style={{ background: "var(--run)" }} />Run</span><span><i className="hollow" />Planned</span></div>}
      </div>
    </section>
  );
}

// ---------- Pace trend with corridor ----------
export function PaceCorridor({ range, onPick }: { range: Range; onPick: (id: string) => void }) {
  const an = useAnalysis();
  const ATHLETE = an.athlete;
  const corridorAt = an.corridorAt;
  const [sp, setSp] = useState<Sp>("run");
  const days = range === 99 ? 400 : range * 7;
  const pts = an.paceSeries(sp, days);
  const inv = sp !== "bike";
  const W = 640, H = 210, L = 44, R = 12, T = 14, B = 26;
  const start = pts.length ? fromYmd(pts[0].date) : addDays(today(), -days), end = today();
  const cs = corridorAt(sp, start), ce = corridorAt(sp, end);
  let lo = Math.min(cs.lo, ce.lo, ...pts.map((p) => p.v)), hi = Math.max(cs.hi, ce.hi, ...pts.map((p) => p.v));
  const pad = (hi - lo) * 0.15 || 10; lo -= pad; hi += pad;
  const x = (d: string) => L + ((fromYmd(d).getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * (W - L - R);
  const y = (v: number) => (inv ? T + ((v - lo) / (hi - lo)) * (H - T - B) : H - B - ((v - lo) / (hi - lo)) * (H - T - B));
  const band = `M${L} ${y(cs.lo)} L${W - R} ${y(ce.lo)} L${W - R} ${y(ce.hi)} L${L} ${y(cs.hi)} Z`;
  const avg = an.weightedAvgPace(sp, 28);
  const now = corridorAt(sp, end);
  const ticks = 4;
  return (
    <section className="card chartcard" aria-label="Pace trend">
      <div className="head">
        <span className="eyebrow">Pace trend · target corridor</span>
        <div className="pill-group">{(["swim", "bike", "run"] as Sp[]).map((k) => <button key={k} type="button" className={sp === k ? "on" : ""} onClick={() => setSp(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}</div>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>{UNIT[sp]} · faster is higher · band = coach target for that date</div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} pace with target corridor`}>
          {Array.from({ length: ticks + 1 }, (_, k) => lo + ((hi - lo) * k) / ticks).map((v, k) => <g key={k}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{fmtV(sp, v)}</text></g>)}
          <path d={band} fill="var(--accent-soft)" />
          {pts.map((p) => <circle key={p.id} cx={x(p.date)} cy={y(p.v)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} style={{ cursor: "pointer" }} onClick={() => onPick(p.id)}><title>{`${dateLabel(p.date)} · ${fmtV(sp, p.v)}`}</title></circle>)}
          {avg != null && <line x1={L} y1={y(avg)} x2={W - R} y2={y(avg)} stroke="var(--ink)" strokeDasharray="4 4" strokeWidth={1} />}
          {pts.length ? [pts[0], pts[pts.length - 1]].map((p, i) => <text key={i} x={x(p.date)} y={H - 8} textAnchor={i ? "end" : "start"}>{shortDate(p.date)}</text>) : <text x={W / 2} y={H / 2} textAnchor="middle">No {sp} activities in range</text>}
        </svg>
      </div>
      <div className="side">
        <div><div className="k">4-week avg</div><div className="v">{avg != null ? fmtV(sp, avg) : "—"}</div><div className="u">{UNIT[sp]} · dashed line</div></div>
        <div><div className="k">Target now</div><div className="v">{fmtV(sp, now.lo)}–{fmtV(sp, now.hi)}</div><div className="u">{UNIT[sp]}</div></div>
        <div><div className="k">Race-day target</div><div className="v">{fmtV(sp, corridorAt(sp, fromYmd(ATHLETE.race.date)).lo)}–{fmtV(sp, corridorAt(sp, fromYmd(ATHLETE.race.date)).hi)}</div><div className="u">{UNIT[sp]}</div></div>
      </div>
    </section>
  );
}

// ---------- Body ----------
export function BodyPanel() {
  const an = useAnalysis();
  const w7 = an.bodySummary(7), prev = an.bodySummary(7, 7);
  const rows = [...an.BODY].reverse().slice(0, 7);
  const d = (a: number | null, b: number | null, digits = 0) => (a != null && b != null ? sign(a - b, digits) : "—");
  return (
    <section className="card an-body" aria-label="Body metrics">
      <div className="head"><span className="eyebrow">Body · Garmin</span><span className="muted">7-day average vs the 7 days before</span></div>
      <div className="an-body-grid">
        <div><div className="k">Resting HR</div><div className="v">{w7.rhr?.toFixed(0) ?? "—"}<small> bpm</small></div><div className="u">{d(w7.rhr, prev.rhr)} · target 38</div></div>
        <div><div className="k">HRV</div><div className="v">{w7.hrv?.toFixed(0) ?? "—"}<small> ms</small></div><div className="u">{d(w7.hrv, prev.hrv)} · target 96</div></div>
        <div><div className="k">VO2max</div><div className="v">{w7.vo2 ?? "—"}</div><div className="u">target 60</div></div>
        <div><div className="k">Sleep</div><div className="v">{w7.sleep?.toFixed(1) ?? "—"}<small> h</small></div><div className="u">{d(w7.sleep, prev.sleep, 1)} h · score {w7.sleepScore?.toFixed(0) ?? "—"}</div></div>
        <div><div className="k">Stress</div><div className="v">{w7.stress?.toFixed(0) ?? "—"}</div><div className="u">{d(w7.stress, prev.stress)} · Garmin 0–100</div></div>
      </div>
      <table className="tbl small">
        <thead><tr><th>Date</th><th>Resting HR</th><th>HRV</th><th>Sleep</th><th>Sleep score</th><th>Stress</th><th>VO2max</th></tr></thead>
        <tbody>{rows.map((b) => <tr key={b.date}><td>{dateLabel(b.date)}</td><td>{b.rhr ?? "—"}</td><td>{b.hrv ?? "—"}</td><td>{b.sleep_h != null ? `${b.sleep_h.toFixed(1)} h` : "—"}</td><td>{b.sleep_score ?? "—"}</td><td>{b.stress ?? "—"}</td><td>{b.vo2 ?? "—"}</td></tr>)}</tbody>
      </table>
    </section>
  );
}

// ---------- Totals + bests + projection ----------
export function TotalsPanel() {
  const an = useAnalysis();
  const ATHLETE = an.athlete;
  const t = an.totals(), p = an.raceProjection();
  const h = (x: number | null) => (x == null ? "—" : fmtHMS(x * 60));
  const goalTotal = ATHLETE.raceSplits.swim + ATHLETE.raceSplits.bike + ATHLETE.raceSplits.run + ATHLETE.raceSplits.transitions;
  return (
    <div className="an-two">
      <section className="card an-totals" aria-label="Totals since plan start">
        <div className="head"><span className="eyebrow">Since plan start · {dateLabel(ATHLETE.planStart)}</span></div>
        <div className="an-body-grid five">
          <div><div className="k">Sessions</div><div className="v">{t.sessions}</div><div className="u">{t.swim} swim · {t.bike} bike · {t.run} run</div></div>
          <div><div className="k">Hours</div><div className="v">{t.hours.toFixed(1)}</div><div className="u">total</div></div>
          <div><div className="k">Swim</div><div className="v">{swimDist(t.swimYd).v.toLocaleString()}<small> {swimDist(0).u}</small></div></div>
          <div><div className="k">Bike</div><div className="v">{fmtDist(t.bikeMi, 0)}</div></div>
          <div><div className="k">Run</div><div className="v">{fmtDist(t.runMi, 0)}</div><div className="u">{elev(t.elevFt).v.toLocaleString()} {elev(0).u} climbed</div></div>
        </div>
        <table className="tbl small">
          <tbody>
            <tr><td>Longest ride</td><td>{t.bests.longestRide ? `${fmtDist(t.bests.longestRide.mi)} · ${dateLabel(t.bests.longestRide.date)}` : "—"}</td></tr>
            <tr><td>Longest run</td><td>{t.bests.longestRun ? `${fmtDist(t.bests.longestRun.mi)} · ${dateLabel(t.bests.longestRun.date)}` : "—"}</td></tr>
            <tr><td>Longest swim</td><td>{t.bests.longestSwim ? `${swimDist(t.bests.longestSwim.yd ?? 0).v.toLocaleString()} ${swimDist(0).u} · ${dateLabel(t.bests.longestSwim.date)}` : "—"}</td></tr>
            <tr><td>Fastest run (≥ 3 mi)</td><td>{t.bests.fastestRun ? `${fmtPace(runPace(t.bests.fastestRun.pace_s ?? 0).s)} ${runPace(0).u} · ${dateLabel(t.bests.fastestRun.date)}` : "—"}</td></tr>
            <tr><td>Longest session</td><td>{t.bests.longestSession ? `${fmtHMS(t.bests.longestSession.min)} · ${t.bests.longestSession.name}` : "—"}</td></tr>
          </tbody>
        </table>
      </section>
      <section className="card an-proj" aria-label="Race projection">
        <div className="head"><span className="eyebrow">Race projection · {ATHLETE.race.name}</span><span className="muted">at current 4-week average pace, no fatigue adjustment</span></div>
        <table className="tbl small">
          <thead><tr><th>Leg</th><th>Projected</th><th>{ATHLETE.race.goal} goal</th><th>Gap</th></tr></thead>
          <tbody>
            {([["Swim 2.4 mi", p.swimH, ATHLETE.raceSplits.swim], ["Bike 112 mi", p.bikeH, ATHLETE.raceSplits.bike], ["Run 26.2 mi", p.runH, ATHLETE.raceSplits.run], ["Transitions", p.transitions, ATHLETE.raceSplits.transitions]] as const).map(([k, v, g]) => (
              <tr key={k}><td>{k}</td><td>{h(v)}</td><td>{h(g)}</td><td className={v != null && v > g ? "neg" : "pos"}>{v != null ? sign((v - g) * 60) + " min" : "—"}</td></tr>
            ))}
            <tr className="total"><td>Total</td><td>{h(p.total)}</td><td>{h(goalTotal)}</td><td className={p.total != null && p.total > goalTotal ? "neg" : "pos"}>{p.total != null ? sign((p.total - goalTotal) * 60) + " min" : "—"}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------- Single-activity analysis ----------
export function ActivityAnalyzer({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const an = useAnalysis();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => [...an.activities].reverse(), [an.activities]);
  return (
    <>
      <div className="an-pick">
        <button type="button" className="btn ghost plus" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Icon name="plus" /> Analyze activity</button>
        {open && (
          <select className="an-select" size={8} value={selectedId ?? ""} onChange={(e) => { onSelect(e.target.value || null); setOpen(false); }} aria-label="Pick an activity">
            {list.map((x) => <option key={x.id} value={x.id}>{dateLabel(x.date)} · {x.name} · {fmtHMS(x.min)}</option>)}
          </select>
        )}
      </div>
    </>
  );
}

export function ActivityPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const an = useAnalysis();
  const a = an.activities.find((x) => x.id === id) ?? null;
  if (!a) return null;
  const r = an.analyzeActivity(a);
  const sp = r.sport as Sp | null;
  const paceStr = sp && r.pace != null ? `${fmtV(sp, r.pace)} ${UNIT[sp]}` : "—";
  const rangeStr = sp && r.range ? `${fmtV(sp, r.range[0])}–${fmtV(sp, r.range[1])} ${UNIT[sp]}` : "—";
  return (
    <section className="card an-activity" aria-label="Activity analysis">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="hd">
        <SportIcon sport={a.sport} size={40} />
        <div>
          <div className="eyebrow muted">Activity analysis</div>
          <h2>{a.name}</h2>
          <div className="muted">{dateLabel(a.date)}{a.start ? ` · ${a.start}` : ""} · {a.source === "garmin" ? "Garmin" : "Manual"}{r.planned ? (r.planned.sport === a.sport || r.planned.sport === "brick" ? ` · matches plan: ${r.planned.title} ${r.planned.intensity} ${r.planned.min} min` : ` · planned that day: ${r.planned.title} ${r.planned.intensity} ${r.planned.min} min (different sport)`) : r.restDay ? " · rest day in the plan" : " · no planned session that day"}</div>
        </div>
      </div>
      <div className="an-activity-grid">
        <div className="blk">
          <div className="eyebrow">Planned vs actual</div>
          <table className="tbl small"><tbody>
            <tr><td>Duration</td><td>{fmtHMS(a.min)}</td><td className="muted">{r.planned ? `plan ${r.planned.min} min · ${sign(r.durDelta)} min` : "—"}</td></tr>
            <tr><td>{sp === "bike" ? "Speed" : "Pace"}</td><td>{paceStr}</td><td className={`muted ${r.verdict === "in range" ? "pos" : r.verdict ? "neg" : ""}`}>{r.range ? `target ${rangeStr} · ${r.verdict}` : "no target"}</td></tr>
            <tr><td>Distance</td><td>{a.sport === "swim" ? (a.yd ? `${swimDist(a.yd).v.toLocaleString()} ${swimDist(0).u}` : "—") : fmtDist(a.mi)}</td><td className="muted">{a.elev_ft ? `${elev(a.elev_ft).v.toLocaleString()} ${elev(0).u} climbed` : ""}</td></tr>
            <tr><td>Avg heart rate</td><td>{a.hr ? `${a.hr} bpm` : "—"}</td><td className="muted">{r.planned?.intensity ?? ""}</td></tr>
          </tbody></table>
        </div>
        <div className="blk">
          <div className="eyebrow">Load</div>
          <table className="tbl small"><tbody>
            <tr><td>Session load</td><td>{r.load}</td><td className="muted">minutes × intensity factor</td></tr>
            <tr><td>Fitness effect</td><td>{sign(r.fitnessEffect, 1)}</td><td className="muted">load ÷ 42</td></tr>
            <tr><td>Fatigue effect</td><td>{sign(r.fatigueEffect, 1)}</td><td className="muted">load ÷ 7</td></tr>
            <tr><td>Efficiency</td><td>{r.ef != null ? r.ef.toFixed(3) : "—"}</td><td className="muted">{r.efAvg != null ? `${sign(((r.ef as number) / r.efAvg - 1) * 100)}% vs ${r.efN} similar` : "speed ÷ heart rate"}</td></tr>
          </tbody></table>
        </div>
        <div className="blk">
          <div className="eyebrow">Notes</div>
          <table className="tbl small"><tbody>
            <tr><td>Exertion</td><td>{a.exertion ? `${a.exertion} / 10` : "—"}</td></tr>
            <tr><td>Your note</td><td>{a.note ?? "—"}</td></tr>
            <tr><td>Coach</td><td>{a.coachNote ? <CoachNote text={a.coachNote} /> : "—"}</td></tr>
          </tbody></table>
        </div>
        <div className="blk map"><RouteMap route={a.route} height={150} bg="var(--surface-2)" /></div>
      </div>
    </section>
  );
}

