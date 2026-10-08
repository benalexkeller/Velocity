"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { CoachNote } from "../CoachNote";
import { activityLoad, plannedLoad } from "@/lib/data";
import { METRICS, type Metric } from "@/lib/analysis";
import { useAnalysis } from "@/lib/useAnalysis";
import { addDays, dateLabel, fmtHMS, fmtHours, fmtPace, fromYmd, shortDate, today } from "@/lib/format";
import { fmtDist, runPace, swimDist, swimPace } from "@/lib/units";

type Sp = "swim" | "bike" | "run";
export type Range = 4 | 12 | 99;
const sign = (n: number | null | undefined, digits = 0, suffix = "") => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}${suffix}`);
const fmtV = (sp: Sp, v: number) => (sp === "bike" ? `${v.toFixed(1)}` : sp === "run" ? fmtPace(runPace(v).s) : fmtPace(swimPace(v).s));
const unitOf = (sp: Sp) => (sp === "bike" ? "mph" : sp === "run" ? runPace(0).u : swimPace(0).u);

// ---------- small marks ----------
function Delta({ v, good = "up", suffix = "%", digits = 0 }: { v: number | null | undefined; good?: "up" | "down"; suffix?: string; digits?: number }) {
  if (v == null || !isFinite(v)) return <span className="delta muted">—</span>;
  const up = v > 0, positive = good === "up" ? up : !up;
  return <span className={`delta ${v === 0 ? "" : positive ? "pos" : "neg"}`}>{up ? "↑" : v < 0 ? "↓" : "→"} {Math.abs(v).toFixed(digits)}{suffix}</span>;
}
function Spark({ pts, w = 110, h = 30, color = "var(--accent)" }: { pts: (number | null)[]; w?: number; h?: number; color?: string }) {
  const v = pts.filter((p): p is number => p != null);
  if (v.length < 2) return <svg width={w} height={h} />;
  const lo = Math.min(...v), hi = Math.max(...v);
  const y = (n: number) => (hi === lo ? h / 2 : h - 3 - ((n - lo) / (hi - lo)) * (h - 6));
  const x = (i: number) => 2 + (i / (pts.length - 1)) * (w - 4);
  const d = pts.map((p, i) => (p == null ? "" : `${i === 0 || pts[i - 1] == null ? "M" : "L"}${x(i)} ${y(p)}`)).join("");
  return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}><path d={d} fill="none" stroke={color} strokeWidth={1.8} /></svg>;
}
function Bars({ pts, w = 110, h = 30, color = "var(--accent)", soft = "var(--swim-soft)" }: { pts: number[]; w?: number; h?: number; color?: string; soft?: string }) {
  const hi = Math.max(1, ...pts);
  const bw = w / Math.max(1, pts.length);
  return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{pts.map((p, i) => <rect key={i} x={i * bw + 1} y={h - (p / hi) * h} width={Math.max(2, bw - 2)} height={(p / hi) * h} rx={1} fill={i === pts.length - 1 ? color : soft} />)}</svg>;
}

// ---------- info tooltip: the (i) appears on hover; the explanation opens on hover or focus ----------
export function Info({ title, text }: { title: string; text: string }) {
  return (
    <span className="info">
      <button type="button" className="info-btn" aria-label={`About ${title}`}>i</button>
      <span className="info-pop" role="tooltip"><b>{title}</b>{text}</span>
    </span>
  );
}
export const KPI_INFO = {
  load: { title: "Training load", text: "Average daily training load over the last 7 days. Load per session = duration in minutes × an intensity factor derived from average heart rate ((HR ÷ 155)², capped at 1.2), or from your 1–10 exertion when there is no heart rate. It is a TRIMP-style impulse: a 60-minute session at 155 bpm scores 60; the same hour at 170 bpm scores about 72. The change compares this 7-day average with the previous 7 days." },
  fitness: { title: "Fitness (chronic load)", text: "An exponentially weighted moving average of daily load with a 42-day time constant — the same construction as CTL in the Banister impulse-response model. Each day it moves 1/42 of the way toward that day's load, so it rises slowly with sustained work and decays slowly with rest. Higher = a larger recent training base. Change is vs 7 days ago." },
  fatigue: { title: "Fatigue (acute load)", text: "The same exponentially weighted average of daily load, but with a 7-day time constant (ATL). It reacts fast: a big week pushes it up within days and a rest week drops it. On its own it is neither good nor bad; read it against Fitness. A fall is shown as positive because it usually means recovery." },
  form: { title: "Form (training stress balance)", text: "Fitness minus Fatigue (TSB). Negative during loading blocks (you are carrying more acute than chronic load), positive after a taper or rest week. Roughly: below −30 you are digging deep, −10 to +5 is normal build training, +5 to +25 is fresh. Race day should be positive. Change is in points vs 7 days ago." },
  volume: { title: "Weekly volume", text: "Hours of completed activities in the current plan week (Monday to Sunday), all sports, taken from Garmin and manual logs. Change is vs the previous plan week. The dashboard's This week card shows the same number next to the planned hours." },
  consistency: { title: "Completed sessions", text: "Sessions completed ÷ sessions planned over the last 12 plan weeks, rest days excluded. Completed = an activity of the same sport covering at least 70 % of the planned time; a shorter one or another sport counts half; today's session is not counted until the day is over. It does not judge pace. Change is in percentage points vs the 12 weeks before." },
  zones: { title: "Load by heart-rate zone", text: "Each session's load is assigned to a zone by its average heart rate: Z1 below 135 bpm, Z2 135–147, Z3 148–157, Z4 158–167, Z5 168 and above (provisional zones, recalibrated at the week-4 threshold test). Share = that zone's load ÷ all load with heart rate. Load = the sum, minutes × intensity factor. Sessions without heart rate are excluded from the split. Per-second heart-rate data from the Garmin connection will replace the per-session average." },
  intensity: { title: "Intensity distribution", text: "Easy = Z1 + Z2 (below the first ventilatory threshold, conversational), Moderate = Z3 (between thresholds, tempo), Hard = Z4 + Z5 (above the second threshold). Polarized and pyramidal endurance programmes put 75–85% of load in the easy band; this plan targets 75–80% in the Base phases." },
} as const;

// ---------- 1. KPI tiles ----------
export function KpiRow() {
  const an = useAnalysis();
  const k = an.kpis();
  return (
    <div className="ax-kpis">
      <div className="card kpi"><div className="k">Training load<Info {...KPI_INFO.load} /></div><div className="row"><div className="v">{k.load.v.toFixed(0)}</div><Delta v={k.load.d} /></div><div className="u">7-day avg · load</div><Bars pts={k.load.bars} /></div>
      <div className="card kpi"><div className="k">Fitness<Info {...KPI_INFO.fitness} /></div><div className="row"><div className="v">{k.fitness.v.toFixed(0)}</div><Delta v={k.fitness.d} /></div><div className="u">42-day load</div><Spark pts={k.fitness.spark} /></div>
      <div className="card kpi"><div className="k">Fatigue<Info {...KPI_INFO.fatigue} /></div><div className="row"><div className="v">{k.fatigue.v.toFixed(0)}</div><Delta v={k.fatigue.d} good="down" /></div><div className="u">7-day load</div><Spark pts={k.fatigue.spark} color="var(--ink)" /></div>
      <div className="card kpi"><div className="k">Form<Info {...KPI_INFO.form} /></div><div className="row"><div className="v">{sign(k.form.v)}</div><Delta v={k.form.dAbs} suffix="" /></div><div className="u">fitness − fatigue</div><Spark pts={k.form.spark} color="var(--swim)" /></div>
      <div className="card kpi"><div className="k">Weekly volume<Info {...KPI_INFO.volume} /></div><div className="row"><div className="v">{k.volume.v.toFixed(1)}<small> h</small></div><Delta v={k.volume.d} /></div><div className="u">This week</div><Bars pts={k.volume.bars} /></div>
      <div className="card kpi"><div className="k">Completed sessions<Info {...KPI_INFO.consistency} /></div><div className="row"><div className="v">{k.consistency.v ?? "—"}{k.consistency.v != null && <small>%</small>}</div><Delta v={k.consistency.dAbs} suffix=" pts" /></div><div className="u">12 weeks · done ÷ planned</div><Bars pts={k.consistency.bars} /></div>
    </div>
  );
}

// ---------- 2. Performance overview (fitness / fatigue / form) ----------
export function Overview({ range }: { range: Range }) {
  const { LOAD_SERIES } = useAnalysis();
  const days = range === 99 ? LOAD_SERIES.length : Math.min(LOAD_SERIES.length, range * 7);
  const pts = LOAD_SERIES.slice(-days);
  const [hover, setHover] = useState<number | null>(null);
  const i = hover ?? pts.length - 1;
  const W = 760, H = 230, L = 40, R = 16, T = 12, B = 28;
  const top = Math.max(10, Math.ceil((Math.max(...pts.map((p) => Math.max(p.fitness, p.fatigue))) * 1.3) / 10) * 10);
  const bottom = Math.min(0, Math.floor((Math.min(...pts.map((p) => p.form)) * 1.2) / 10) * 10);
  const y = (v: number) => T + ((top - v) / (top - bottom)) * (H - T - B);
  const x = (j: number) => L + (pts.length < 2 ? 0 : (j / (pts.length - 1)) * (W - L - R));
  const line = (k: "fitness" | "fatigue" | "form") => pts.map((p, j) => `${j ? "L" : "M"}${x(j)} ${y(p[k])}`).join("");
  const area = `${line("fitness")} L${x(pts.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;
  const span = top - bottom, step = span > 200 ? 50 : span > 100 ? 25 : span > 40 ? 10 : 5;
  const ticks: number[] = []; for (let v = Math.ceil(bottom / step) * step; v <= top; v += step) ticks.push(v);
  const every = Math.max(1, Math.round(pts.length / 10));
  const p = pts[i];
  return (
    <section className="card ax-panel" aria-label="Performance overview">
      <div className="ax-head">
        <div><h2>Performance overview</h2><p>Fitness, fatigue and form over the last {range === 99 ? `${Math.round(pts.length / 7)} weeks` : `${range} weeks`}</p></div>
        <span className="lgd"><span><i style={{ background: "var(--accent)" }} />Fitness</span><span><i style={{ background: "var(--ink)" }} />Fatigue</span><span><i style={{ background: "var(--swim)" }} />Form</span></span>
      </div>
      <div className="ax-overview">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fitness, fatigue and form" onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const j = Math.round(((px - L) / (W - L - R)) * (pts.length - 1)); setHover(Math.max(0, Math.min(pts.length - 1, j))); }}>
          {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke={v === 0 ? "var(--line)" : "var(--grid)"} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
          <path d={area} fill="var(--accent-soft)" opacity={0.7} />
          <path d={line("form")} fill="none" stroke="var(--swim)" strokeWidth={1.6} />
          <path d={line("fatigue")} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
          <path d={line("fitness")} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          {pts.map((q, j) => j % every === 0 || j === pts.length - 1 ? <circle key={q.date} cx={x(j)} cy={y(q.fitness)} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} /> : null)}
          <line x1={x(i)} y1={T} x2={x(i)} y2={H - B} stroke="var(--muted-2)" strokeDasharray="3 3" />
          <circle cx={x(i)} cy={y(p.fitness)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.fatigue)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.form)} r={4} fill="var(--swim)" stroke="var(--surface)" strokeWidth={2} />
          {pts.map((q, j) => (j === pts.length - 1 || (j % every === 0 && j <= pts.length - 1 - every)) ? <text key={"l" + q.date} x={x(j)} y={H - 8} textAnchor={j === pts.length - 1 ? "end" : j === 0 ? "start" : "middle"}>{shortDate(q.date)}</text> : null)}
        </svg>
        <div className="ax-tip">
          <div className="d">{dateLabel(p.date)}</div>
          <div><span><i style={{ background: "var(--accent)" }} />Fitness</span><b>{p.fitness.toFixed(0)}</b></div>
          <div><span><i style={{ background: "var(--ink)" }} />Fatigue</span><b>{p.fatigue.toFixed(0)}</b></div>
          <div><span><i style={{ background: "var(--swim)" }} />Form</span><b>{sign(p.form)}</b></div>
          <div><span><i style={{ background: "var(--track)" }} />Day load</span><b>{p.load}</b></div>
        </div>
      </div>
    </section>
  );
}

// ---------- 3. Training volume ----------
export function Volume({ range }: { range: Range }) {
  const an = useAnalysis();
  const [mode, setMode] = useState<"hours" | "distance" | "load">("hours");
  const [hov, setHov] = useState<number | null>(null);
  const cur = an.currentWeek();
  const n = range === 99 ? cur.week : Math.min(cur.week, range);
  const weeks = an.weeks.slice(cur.week - n, cur.week);
  const per = (w: (typeof weeks)[number]) => {
    const s = fromYmd(w.start), e = addDays(s, 7);
    const acts = an.activities.filter((a) => { const d = fromYmd(a.date); return d >= s && d < e; });
    const g = { swim: 0, bike: 0, run: 0, other: 0 };
    const hours = { swim: 0, bike: 0, run: 0, other: 0 }, count = { swim: 0, bike: 0, run: 0, other: 0 };
    for (const a of acts) {
      const k = a.sport === "swim" || a.sport === "bike" || a.sport === "run" ? a.sport : "other";
      g[k] += mode === "hours" ? a.min / 60 : mode === "load" ? activityLoad(a, an.athlete.lthr ?? undefined) : a.sport === "swim" ? (a.yd ?? 0) / 1760 : a.mi ?? 0;
      hours[k] += a.min / 60; count[k]++;
    }
    const planned = mode === "hours" ? w.plannedMin / 60 : mode === "load" ? w.sessions.reduce((s2, x) => s2 + plannedLoad(x), 0) : null;
    const plannedSessions = w.sessions.filter((x) => x.sport !== "rest").length;
    return { w, g, planned, hours, count, activities: acts.length, hoursTotal: acts.reduce((t, a) => t + a.min, 0) / 60, plannedH: w.plannedMin / 60, plannedSessions };
  };
  const rows = weeks.map(per);
  const W = 760, H = 220, L = 34, R = 10, T = 14, B = 26;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.g.swim + r.g.bike + r.g.run + r.g.other, r.planned ?? 0)));
  const nice = mode === "hours" ? Math.ceil(max / 2) * 2 : Math.ceil(max / 50) * 50 || 50;
  const y = (v: number) => H - B - (v / nice) * (H - T - B);
  const gw = (W - L - R) / Math.max(1, rows.length), bw = Math.min(40, gw * 0.55);
  const ticks = mode === "hours" ? [0, nice / 2, nice] : [0, nice / 2, nice];
  const unit = mode === "hours" ? "h" : mode === "load" ? "load" : "mi";
  return (
    <section className="card ax-panel" aria-label="Training volume">
      <div className="ax-head">
        <div><h2>Training volume</h2><p>Weekly volume by sport · planned vs completed</p></div>
        <div className="ax-tools">
          <div className="pill-group">{(["hours", "distance", "load"] as const).map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "hours" ? "Hours" : m === "distance" ? "Distance" : "Load"}</button>)}</div>
          <span className="lgd"><span><i style={{ background: "var(--swim)" }} />Swim</span><span><i style={{ background: "var(--bike)" }} />Bike</span><span><i style={{ background: "var(--run)" }} />Run</span><span><i style={{ background: "var(--strength-soft)", border: "1px solid var(--line)" }} />Other</span><span><i className="dash" />Planned</span></span>
        </div>
      </div>
      <div className="ax-volwrap" onMouseLeave={() => setHov(null)}>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly volume">
          {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{mode === "hours" ? v : Math.round(v)}</text></g>)}
          {rows.map((r, i) => {
            const cx = L + i * gw + gw / 2;
            const segs: [number, string][] = [[r.g.run, "var(--run)"], [r.g.bike, "var(--bike)"], [r.g.swim, "var(--swim)"], [r.g.other, "var(--strength-soft)"]];
            let acc = 0;
            return (
              <g key={r.w.week} onMouseEnter={() => setHov(i)} opacity={hov == null || hov === i ? 1 : 0.6}>
                <rect x={L + i * gw} y={T} width={gw} height={H - T - B} fill="transparent" />
                {r.planned != null && <rect x={cx - bw / 2 - 3} y={y(r.planned)} width={bw + 6} height={Math.max(0, y(0) - y(r.planned))} fill="none" stroke="var(--muted-2)" strokeDasharray="3 3" rx={3} />}
                {segs.map(([v, c], k) => { const el = v > 0 ? <rect key={k} x={cx - bw / 2} y={y(acc + v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={c} /> : null; acc += v; return el; })}
                <text x={cx} y={H - 8} textAnchor="middle" fontWeight={hov === i ? 600 : undefined}>{shortDate(r.w.start)}</text>
              </g>
            );
          })}
        </svg>
        {hov != null && rows[hov] && (() => {
          const r = rows[hov];
          const cx = (L + hov * gw + gw / 2) / W;
          const line = (k: "swim" | "bike" | "run" | "other", label: string, col: string) => r.count[k] ? <div key={k}><span><i style={{ background: col }} />{label}</span><b>{fmtHours(r.hours[k])}</b><span className="n">{r.count[k]} {r.count[k] === 1 ? "activity" : "activities"}</span></div> : null;
          return (
            <div className="ax-vtip" style={{ left: `${cx * 100}%`, transform: cx > 0.75 ? "translateX(-100%)" : cx < 0.2 ? "none" : "translateX(-50%)" }}>
              <div className="d">Week {r.w.week} · {dateLabel(r.w.start)}</div>
              <div className="tot"><b>{fmtHours(r.hoursTotal)}</b> done · <b>{r.activities}</b> {r.activities === 1 ? "activity" : "activities"}</div>
              <div className="sub">plan {fmtHours(r.plannedH)} · {r.plannedSessions} sessions</div>
              {line("swim", "Swim", "var(--swim)")}{line("bike", "Bike", "var(--bike)")}{line("run", "Run", "var(--run)")}{line("other", "Other", "var(--strength-soft)")}
              {!r.activities && <div className="sub">No activities logged</div>}
            </div>
          );
        })()}
      </div>
      <div className="ax-foot muted">Bars: completed {unit} per week. Dashed outline: the plan. Hover a week for hours and activities. {mode === "distance" ? "Swim yards converted to miles." : ""}</div>
    </section>
  );
}

// ---------- 4. Load distribution ----------
export function LoadDistribution({ range }: { range: Range }) {
  const an = useAnalysis();
  const z = an.zoneDistribution(range === 99 ? 400 : range * 7);
  const colors = ["#DCE6FB", "var(--swim)", "var(--accent)", "var(--run)", "#0E2E8A"];
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const easyDelta = z.prevEasy != null ? z.easy - z.prevEasy : null;
  return (
    <section className="card ax-panel" aria-label="Load distribution">
      <div className="ax-head"><div><h2>Load distribution</h2><p>By heart-rate zone · {z.withHr} of {z.sessions} sessions have heart rate</p></div></div>
      <div className="ax-dist">
        <div className="donut-wrap">
          <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Load by zone">
            {z.zones.map((zz, i) => { const len = (zz.pct / 100) * c; const el = <circle key={zz.z} cx="70" cy="70" r={r} fill="none" stroke={colors[i]} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />; off += len; return el; })}
            <text x="70" y="66" textAnchor="middle" className="ink" fontSize="24" fontWeight="600">{z.total}</text>
            <text x="70" y="84" textAnchor="middle" fontSize="10">load · {range === 99 ? "all" : `${range} wk`}</text>
          </svg>
          <table className="zones"><thead><tr><th>Zone<Info {...KPI_INFO.zones} /></th><th>Share</th><th>Load</th></tr></thead><tbody>{z.zones.map((zz, i) => <tr key={zz.z}><td><i style={{ background: colors[i] }} />Zone {zz.z}</td><td>{zz.pct}%</td><td className="muted">{zz.load}</td></tr>)}</tbody></table>
        </div>
        <div className="intensity">
          <div className="k">Intensity distribution<Info {...KPI_INFO.intensity} /></div>
          <div className="ibar"><i style={{ width: `${z.easy}%`, background: "var(--swim)" }} /><i style={{ width: `${z.moderate}%`, background: "var(--accent)" }} /><i style={{ width: `${z.hard}%`, background: "var(--run)" }} /></div>
          <div className="ilbl"><div><b>{z.easy}%</b><span>Easy (Z1–Z2)</span></div><div><b>{z.moderate}%</b><span>Moderate (Z3)</span></div><div><b>{z.hard}%</b><span>Hard (Z4–Z5)</span></div></div>
        </div>
        <div className={`note ${easyDelta != null && easyDelta >= 0 ? "ok" : ""}`}>
          <div className="t">Easy share {z.easy}%{easyDelta != null ? ` · ${sign(easyDelta)} pts vs previous period` : ""}</div>
          <div className="s">Base-phase target: 75–80% of load easy. Zones are from each session's average heart rate until per-second data arrives.</div>
        </div>
      </div>
    </section>
  );
}

// ---------- 5. Sport performance ----------
function SportCard({ sp }: { sp: Sp }) {
  const an = useAnalysis();
  const p = an.sportPerformance(sp);
  const fmtRow = (kind: string, v: number | null) => v == null ? "—" : kind === "pace" ? `${fmtV(sp, v)} ${unitOf(sp)}` : kind === "speed" ? `${v.toFixed(1)} mph` : kind === "hr" ? `${v.toFixed(0)} bpm` : sp === "swim" ? `${swimDist(v).v.toLocaleString()} ${swimDist(0).u}` : fmtDist(v);
  const good = (kind: string) => (kind === "pace" || kind === "hr" ? "down" : "up");
  const W = 240, H = 92, L = 42, R = 8, T = 8, B = 18;
  const pts = p.trend;
  const v = pts.map((q) => q.v).filter((q): q is number => q != null);
  const lo = v.length ? Math.min(...v) : 0, hi = v.length ? Math.max(...v) : 1;
  const pad = (hi - lo) * 0.35 || (sp === "bike" ? 1 : 15);
  const ylo = lo - pad, yhi = hi + pad;
  const inv = sp !== "bike";
  const y = (n: number) => (inv ? T + ((n - ylo) / (yhi - ylo)) * (H - T - B) : H - B - ((n - ylo) / (yhi - ylo)) * (H - T - B));
  const x = (i: number) => L + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - L - R));
  let d = "", started = false;
  pts.forEach((q, i) => { if (q.v == null) { started = false; return; } d += `${started ? "L" : "M"}${x(i)} ${y(q.v)}`; started = true; });
  const guides = [ylo + (yhi - ylo) * 0.15, (ylo + yhi) / 2, yhi - (yhi - ylo) * 0.15];
  return (
    <div className="sport">
      <div className="sh"><SportIcon sport={sp} size={22} /><b>{sp[0].toUpperCase() + sp.slice(1)}</b><span className="muted">{p.sessions} sessions · 4 wk</span></div>
      <table><tbody>{p.rows.map((r) => <tr key={r.k}><td>{r.k}</td><td><b>{fmtRow(r.kind, r.cur)}</b></td><td><Delta v={r.cur != null && r.prev ? ((r.cur - r.prev) / r.prev) * 100 : null} good={good(r.kind)} /></td></tr>)}</tbody></table>
      <div className="k">{sp === "bike" ? "Speed" : "Pace"} · weekly average · {unitOf(sp)}{inv ? " · faster is higher" : ""}</div>
      <svg className="chart mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} weekly ${sp === "bike" ? "speed" : "pace"} trend`}>
        {v.length ? guides.map((g, i) => <g key={i}><line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="var(--grid)" /><text x={L - 5} y={y(g) + 3} textAnchor="end" fontSize="9">{fmtV(sp, g)}</text></g>) : null}
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        {pts.map((q, i) => q.v != null ? <circle key={i} cx={x(i)} cy={y(q.v)} r={2.4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1} /> : null)}
        {pts.map((q, i) => (i === 0 || i === pts.length - 1 || i % 3 === 0) && pts.length > 1 ? <text key={"w" + i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"} fontSize="9">W{q.week}</text> : null)}
        {!v.length && <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="10">No {sp} sessions yet</text>}
      </svg>
    </div>
  );
}
export function SportRow() {
  return (
    <section className="card ax-panel" aria-label="Sport performance">
      <div className="ax-head"><div><h2>Sport performance</h2><p>Last 4 weeks vs the 4 weeks before</p></div></div>
      <div className="ax-sports"><SportCard sp="swim" /><SportCard sp="bike" /><SportCard sp="run" /></div>
    </section>
  );
}

// ---------- 6. Progress over time ----------
export function Progress({ range, onPick }: { range: Range; onPick: (id: string) => void }) {
  const an = useAnalysis();
  const [sp, setSp] = useState<Sp | "all">("run");
  const [m, setM] = useState<Metric>("pace");
  const days = range === 99 ? 400 : range * 7;
  const W = 760, H = 220, L = 46, R = 12, T = 14, B = 26;
  const COLORS: Record<Sp, string> = { swim: "var(--swim)", bike: "var(--bike)", run: "var(--run)" };
  const sports: Sp[] = sp === "all" ? ["swim", "bike", "run"] : [sp];
  // in "all" mode the sports have different units for pace and distance, so each is plotted as % of its first session
  const normalise = sp === "all" && (m === "pace" || m === "distance");
  // bike "pace" is a speed, so its ratio is flipped to keep "faster = up" consistent with run and swim
  const series = sports.map((k) => { const s = an.progressSeries(k, m, days); const base = s.pts[0]?.v ?? 1; return { k, ...s, plot: s.pts.map((q) => ({ ...q, y: normalise ? (m === "pace" && k === "bike" ? (base / q.v) * 100 : (q.v / base) * 100) : q.v })) }; });
  const all = series.flatMap((s) => s.plot);
  const inv = m === "pace" && sp !== "bike" && !normalise ? true : normalise && m === "pace";
  const vals = all.map((q) => q.y);
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const pad = (hi - lo) * 0.2 || 1; lo -= pad; hi += pad;
  const start = all.length ? fromYmd(all.reduce((a, q) => (q.date < a ? q.date : a), all[0].date)) : addDays(today(), -days), end = today();
  const x = (dt: string) => L + ((fromYmd(dt).getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * (W - L - R);
  const y = (n: number) => (inv ? T + ((n - lo) / (hi - lo)) * (H - T - B) : H - B - ((n - lo) / (hi - lo)) * (H - T - B));
  const fmtFor = (k: Sp, n: number) => m === "pace" ? fmtV(k, n) : m === "hr" ? `${n.toFixed(0)}` : m === "distance" ? (k === "swim" ? `${Math.round(n)}` : n.toFixed(1)) : m === "duration" ? fmtHMS(n) : n.toFixed(0);
  const fmtAxis = (n: number) => normalise ? `${n.toFixed(0)}%` : sp === "all" ? (m === "duration" ? fmtHMS(n) : n.toFixed(0)) : fmtFor(sp as Sp, n);
  const unitFor = (k: Sp) => m === "pace" ? unitOf(k) : m === "hr" ? "bpm" : m === "distance" ? (k === "swim" ? "yd" : "mi") : m === "duration" ? "" : "load";
  const goodDir = m === "pace" ? (sp === "bike" ? "up" : "down") : m === "hr" ? "down" : "up";
  const ticks = 4;
  const single = sp !== "all" ? series[0] : null;
  return (
    <section className="card ax-panel" aria-label="Progress over time">
      <div className="ax-head">
        <div><h2>Progress over time</h2><p>Every session as a point · click a point to analyse it{normalise ? " · all sports shown as % of each sport's first session in range" : ""}</p></div>
        <div className="ax-tools">
          {sp === "all" && <span className="lgd">{sports.map((k) => <span key={k}><i style={{ background: COLORS[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</span>}
          <div className="pill-group">{(["all", "swim", "bike", "run"] as const).map((k) => <button key={k} type="button" className={sp === k ? "on" : ""} onClick={() => setSp(k)}>{k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
        </div>
      </div>
      <div className="tabs ax-tabs">{METRICS.map((t) => <button key={t.k} type="button" className={m === t.k ? "on" : ""} onClick={() => setM(t.k)}>{t.label}</button>)}</div>
      <div className="ax-progress">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} ${m} over time`}>
          {Array.from({ length: ticks + 1 }, (_, k) => lo + ((hi - lo) * k) / ticks).map((t, k) => <g key={k}><line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke="var(--grid)" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{fmtAxis(t)}</text></g>)}
          {normalise && <line x1={L} y1={y(100)} x2={W - R} y2={y(100)} stroke="var(--muted-2)" strokeDasharray="4 4" />}
          {series.map((s) => (
            <g key={s.k}>
              {s.plot.length > 1 && sp !== "all" && <path d={`${s.plot.map((q, i) => `${i ? "L" : "M"}${x(q.date)} ${y(q.y)}`).join("")} L${x(s.plot[s.plot.length - 1].date)} ${y(inv ? hi : lo)} L${x(s.plot[0].date)} ${y(inv ? hi : lo)} Z`} fill="var(--accent-soft)" opacity={0.6} />}
              {s.plot.length > 1 && <path d={s.plot.map((q, i) => `${i ? "L" : "M"}${x(q.date)} ${y(q.y)}`).join("")} fill="none" stroke={sp === "all" ? COLORS[s.k] : "var(--accent)"} strokeWidth={2} />}
              {s.plot.map((q) => <circle key={q.id} cx={x(q.date)} cy={y(q.y)} r={4} fill={sp === "all" ? COLORS[s.k] : "var(--accent)"} stroke="var(--surface)" strokeWidth={1.5} style={{ cursor: "pointer" }} onClick={() => onPick(q.id)}><title>{`${s.k} · ${dateLabel(q.date)} · ${fmtFor(s.k, q.v)} ${unitFor(s.k)}`}</title></circle>)}
            </g>
          ))}
          {all.length ? <><text x={L} y={H - 8} textAnchor="start">{shortDate(all.reduce((a, q) => (q.date < a ? q.date : a), all[0].date))}</text><text x={W - R} y={H - 8} textAnchor="end">{shortDate(all.reduce((a, q) => (q.date > a ? q.date : a), all[0].date))}</text></> : <text x={W / 2} y={H / 2} textAnchor="middle">No sessions in range</text>}
        </svg>
        <div className="ax-current">
          {single ? (
            <>
              <div className="k">Current value</div>
              <div className="v">{single.cur != null ? fmtFor(single.k, single.cur) : "—"}<small> {unitFor(single.k)}</small></div>
              <Delta v={single.delta} good={goodDir} />
              <div className="u">vs first session in range</div>
            </>
          ) : (
            <div className="ax-all">
              <div className="k">Latest per sport</div>
              {series.map((s) => <div key={s.k} className="row"><i style={{ background: COLORS[s.k] }} /><span>{s.k[0].toUpperCase() + s.k.slice(1)}</span><b>{s.cur != null ? `${fmtFor(s.k, s.cur)} ${unitFor(s.k)}` : "—"}</b><Delta v={s.delta} good={m === "pace" ? (s.k === "bike" ? "up" : "down") : m === "hr" ? "down" : "up"} /></div>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- 7. Recovery ----------
export function Recovery() {
  const an = useAnalysis();
  const bodySummary = an.bodySummary;
  const w = bodySummary(7), p = bodySummary(7, 7);
  const h = an.healthScore();
  const bars = (k: "rhr" | "hrv" | "sleep_h" | "stress") => [...Array(14)].map((_, i) => { const d = addDays(today(), -13 + i); const day = bodySummary(1, 13 - i); return k === "rhr" ? day.rhr ?? 0 : k === "hrv" ? day.hrv ?? 0 : k === "sleep_h" ? day.sleep ?? 0 : day.stress ?? 0; }).map((v) => v ?? 0);
  const ring = h.score ?? 0, r = 46, c = 2 * Math.PI * r, len = (Math.min(100, ring) / 100) * c;
  const tile = (label: string, v: string, delta: number | null, good: "up" | "down", k: "rhr" | "hrv" | "sleep_h" | "stress", suffix = "", digits = 0) => (
    <div className="rt"><div className="k">{label}</div><div className="v">{v}</div><Delta v={delta} good={good} suffix={suffix} digits={digits} /><div className="u">7-day avg</div><Bars pts={bars(k)} w={120} h={26} /></div>
  );
  const pct = (a: number | null, b: number | null) => (a != null && b ? ((a - b) / b) * 100 : null);
  return (
    <section className="card ax-panel" aria-label="Recovery">
      <div className="ax-head"><div><h2>Recovery</h2><p>Garmin body data · evidence for the Sunday review, not a daily verdict</p></div></div>
      <div className="ax-recovery">
        <div className="tiles">
          {tile("Sleep", w.sleep != null ? `${Math.floor(w.sleep)} h ${Math.round((w.sleep % 1) * 60)} m` : "—", pct(w.sleep, p.sleep), "up", "sleep_h")}
          {tile("HRV", w.hrv != null ? `${w.hrv.toFixed(0)} ms` : "—", pct(w.hrv, p.hrv), "up", "hrv")}
          {tile("Resting HR", w.rhr != null ? `${w.rhr.toFixed(0)} bpm` : "—", pct(w.rhr, p.rhr), "down", "rhr")}
          {tile("Stress", w.stress != null ? w.stress.toFixed(0) : "—", pct(w.stress, p.stress), "down", "stress")}
        </div>
        <div className="score">
          <div className="k">Health score</div>
          <div className="ringwrap">
            <svg viewBox="0 0 120 120" className="ring"><circle cx="60" cy="60" r={r} fill="none" stroke="var(--track)" strokeWidth="10" /><circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${len} ${c - len}`} transform="rotate(-90 60 60)" /><text x="60" y="58" textAnchor="middle" className="ink" fontSize="26" fontWeight="600">{h.score ?? "—"}</text><text x="60" y="76" textAnchor="middle" fontSize="10">/ 100</text></svg>
            <div>
              <b>{h.score == null ? "No data" : h.score >= 100 ? "Targets met" : h.score >= 85 ? "Near targets" : "Building"}</b>
              <p>VO2max {h.inputs.vo2 ?? "—"} (target 60) · resting HR {h.inputs.rhr?.toFixed(0) ?? "—"} (38) · HRV {h.inputs.hrv?.toFixed(0) ?? "—"} (96). 70 = plan-start values, 100 = all targets.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- 8. Training quality ----------
export function Quality({ onPick }: { onPick: (id: string) => void }) {
  const an = useAnalysis();
  const rows = an.trainingQuality(6);
  return (
    <section className="card ax-panel" aria-label="Training quality">
      <div className="ax-head"><div><h2>Training quality</h2><p>Recent sessions and execution</p></div><Link href="/activities" className="link">View all activities →</Link></div>
      <table className="tbl small ax-quality">
        <thead><tr><th>Date</th><th>Session</th><th>Planned</th><th>Actual</th><th>Load</th><th>Execution</th><th>Facts</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.a.id} className="row" onClick={() => onPick(r.a.id)}>
              <td className="nowrap">{dateLabel(r.a.date)}</td>
              <td><span className="sess"><SportIcon sport={r.a.sport} size={18} />{r.a.name}</span></td>
              <td>{r.planned ? `${r.planned.min} min` : "—"}</td>
              <td>{fmtHMS(r.a.min)}</td>
              <td>{r.load}</td>
              <td><span className="exec"><b>{r.execution}%</b><i className={r.level}><span style={{ width: `${r.execution}%` }} /></i></span></td>
              <td className="facts"><i className={`dot ${r.level}`} /><CoachNote text={r.insight} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- 9. Race readiness ----------
export function RaceReadiness() {
  const an = useAnalysis();
  const ATHLETE = an.athlete;
  const r = an.raceReadiness();
  const h = (x: number | null | undefined) => (x == null ? "—" : fmtHMS(x * 60));
  const rng = (x: { lo: number; hi: number } | null) => (x ? `${h(x.lo)} – ${h(x.hi)}` : "—");
  return (
    <section className="card ax-panel" aria-label="Race readiness">
      <div className="ax-head"><div><h2>Race readiness</h2><p>Projected from current 4-week average pace · no fatigue adjustment</p></div><span className="badge">{ATHLETE.race.name} · {ATHLETE.race.distanceLabel}</span></div>
      <div className="ax-race">
        <div className="leg"><SportIcon sport="swim" size={22} /><div><div className="k">Swim · 2.4 mi</div><div className="v">{h(r.swimH)}</div><div className="u">{rng(r.ranges.swim)}</div></div></div>
        <div className="leg"><SportIcon sport="bike" size={22} /><div><div className="k">Bike · 112 mi</div><div className="v">{h(r.bikeH)}</div><div className="u">{rng(r.ranges.bike)}</div></div></div>
        <div className="leg"><SportIcon sport="run" size={22} /><div><div className="k">Run · 26.2 mi</div><div className="v">{h(r.runH)}</div><div className="u">{rng(r.ranges.run)}</div></div></div>
        <div className="leg total"><span className="trophy"><Icon name="check" /></span><div><div className="k">Total finish time</div><div className="v">{h(r.total)}</div><div className="u">{rng(r.ranges.total)} · incl. {h(r.transitions)} transitions</div></div></div>
        <div className={`verdict ${r.onTrack ? "ok" : "warn"}`}>
          <b>{!ATHLETE.hasRace ? "No race set · add it under Profile" : r.onTrack == null ? "Not enough data" : r.onTrack ? `On track for ${ATHLETE.race.goal || "the goal"}` : `${Math.round(r.gapMin ?? 0)} min behind ${ATHLETE.race.goal || "the goal"}`}</b>
          <p>Goal {h(r.goalTotal)} · projected {h(r.total)} ({sign(r.gapMin != null ? Math.round(r.gapMin) : null)} min). {r.sessions4w} sessions in the last 4 weeks. Race capability score {r.score ?? "—"}.</p>
        </div>
      </div>
    </section>
  );
}

// ---------- 10. Observations ----------
export function Observations() {
  const an = useAnalysis();
  const o = an.observations();
  return (
    <section className="card ax-panel" aria-label="Sunday review facts">
      <div className="ax-head"><div><h2>Sunday review · facts</h2><p>What the coach reads before proposing any change</p></div></div>
      <div className="ax-obs">{o.map((x, i) => <div key={x.title} className="ob"><span className="n">{i + 1}</span><div><b>{x.title}</b><p><CoachNote text={x.text} /></p></div></div>)}</div>
    </section>
  );
}
