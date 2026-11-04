"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import DateRangePicker from "../DateRangePicker";
import { SportIcon } from "../SportIcon";
import { CoachNote } from "../CoachNote";
import { activityLoad, plannedLoad } from "@/lib/data";
import { METRICS, type Metric } from "@/lib/analysis";
import { useAnalysis } from "@/lib/useAnalysis";
import { addDays, dateLabel, fmtHMS, fmtHours, fmtPace, fromYmd, shortDate, today, ymd as ymdOf } from "@/lib/format";
import { dist, fmtDist, fmtSpeed, localize, runPace, speed, swimDist, swimPace, unitWords } from "@/lib/units";
import { niceTicks, useWidth } from "@/lib/ticks";

type Sp = "swim" | "bike" | "run";
/** The page's time range: whole months back from today, everything, or two dates the athlete picked. */
export type RangeKey = "1m" | "3m" | "6m" | "all" | "custom";
export type Range = { key: RangeKey; from: string; to: string };
export const RANGE_LABEL: Record<RangeKey, string> = { "1m": "1 month", "3m": "3 months", "6m": "6 months", all: "All", custom: "Custom" };
export function rangeFor(key: Exclude<RangeKey, "custom">, firstDate: string): Range {
  const t = today(), to = ymdOf(t);
  if (key === "all") return { key, from: firstDate < to ? firstDate : to, to };
  const months = key === "1m" ? 1 : key === "3m" ? 3 : 6;
  const d = new Date(t.getFullYear(), t.getMonth() - months, t.getDate());
  return { key, from: ymdOf(d), to };
}
/** The range pills (1 month … All, Custom with a two-date picker): the master at the top, and the same on panels that keep their own. */
export function RangePills({ value, onChange, firstDate, label = "Time range" }: { value: Range; onChange: (r: Range) => void; firstDate: string; label?: string }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="ax-range">
      <div className="pill-group" role="group" aria-label={label}>
        {(["1m", "3m", "6m", "all"] as const).map((r) => <button key={r} type="button" className={value.key === r ? "on" : ""} onClick={() => { setPicking(false); onChange(rangeFor(r, firstDate)); }}>{RANGE_LABEL[r]}</button>)}
        <button type="button" className={value.key === "custom" ? "on" : ""} onClick={() => setPicking((v) => !v)} aria-expanded={picking}>Custom</button>
      </div>
      {picking && <DateRangePicker from={value.from} to={value.to} max={ymdOf(today())} onApply={(from, to) => { onChange({ key: "custom", from, to }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </div>
  );
}
/** A panel's own range: follows the master until the panel picks its own, and follows the master again when that changes. */
function useOwnRange(master: Range): [Range, (r: Range) => void] {
  const [own, setOwn] = useState<{ base: Range; r: Range } | null>(null);
  const eff = own && own.base === master ? own.r : master;
  return [eff, (r) => setOwn({ base: master, r })];
}
export const rangeDays = (r: Range) => Math.max(1, Math.round((fromYmd(r.to).getTime() - fromYmd(r.from).getTime()) / 86400000) + 1);
const sign = (n: number | null | undefined, digits = 0, suffix = "") => (n == null ? "-" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}${suffix}`);
/** A stored pace or speed (s/mi, s/100 yd, mph) in the athlete's units, as a number; `fmtV` writes it. */
const paceDisp = (sp: Sp, v: number) => (sp === "bike" ? speed(v).v : sp === "run" ? runPace(v).s : swimPace(v).s);
const distDisp = (sp: Sp, v: number) => (sp === "swim" ? swimDist(v).v : dist(v).v);
/** Four evenly spaced y labels from the lowest to the highest point, rounded outwards to a fine step (1 s, 0.1 mph, 1 bpm). */
function evenTicks(lo: number, hi: number, kind: "pace" | "speed" | "hr" | "number") {
  const fine = kind === "speed" ? 0.1 : kind === "pace" ? 0.5 : 1; // the step is a whole number of these, so labels stay round
  const a = Math.floor(lo / fine + 1e-9) * fine;
  const step = Math.max(fine, Math.ceil((hi - a) / 3 / fine - 1e-9) * fine);
  const b = a + 3 * step;
  return { lo: a, hi: b, step, ticks: [0, 1, 2, 3].map((i) => a + i * step) };
}
const wholeStep = (step: number) => Math.abs(step - Math.round(step)) < 1e-6;
function fmtTick(kind: "pace" | "speed" | "hr" | "number", n: number, step: number) {
  if (kind === "pace") { const m = Math.floor(n / 60 + 1e-9), sec = n - m * 60; return wholeStep(step) || wholeStep(sec) ? `${m}:${String(Math.round(sec)).padStart(2, "0")}` : `${m}:${sec.toFixed(1).padStart(4, "0")}`; }
  if (kind === "speed") return n.toFixed(1);
  return wholeStep(step) || wholeStep(n) ? n.toFixed(0) : n.toFixed(1);
}
const titleCase = (t: string) => t.replace(/\b([a-z])([a-z]*)/g, (m, a, rest) => (/^(at|of|per|the|a|an|in|on|to|and)$/.test(m) ? m : a.toUpperCase() + rest));
const fmtV = (sp: Sp, v: number) => (sp === "bike" ? `${v.toFixed(1)}` : fmtPace(v));
const unitOf = (sp: Sp) => (sp === "bike" ? speed(0).u : sp === "run" ? runPace(0).u : swimPace(0).u);

// ---------- small marks ----------
function Delta({ v, good = "up", suffix = "%", digits = 0 }: { v: number | null | undefined; good?: "up" | "down"; suffix?: string; digits?: number }) {
  if (v == null || !isFinite(v)) return <span className="delta muted">-</span>;
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
  week: { title: "This week", text: "Sessions completed and hours done in the current plan week (Monday to Sunday) against the plan. Bars: hours done in each of the last 8 plan weeks." },
  load: { title: "Week load", text: "Load done this plan week against the load of the planned sessions. Load per session = minutes × (average HR ÷ threshold HR)², or from your 1-10 exertion when there is no heart rate. 'Last week' is the full previous plan week." },
  fitness: { title: "Fitness (chronic load)", text: "Exponentially weighted average of daily load with a 42-day time constant (CTL in the Banister model). Rises slowly with sustained work, falls slowly with rest. Change in points vs 7 days ago; shown only when there was training before that." },
  form: { title: "Form (training stress balance)", text: "Fitness minus Fatigue (7-day average, ATL). Below −30 very fatigued, −30 to −10 fatigued, −10 to +5 neutral, +5 to +25 fresh. Above +25 with Fitness falling: detraining." },
  compliance: { title: "Completed sessions, 28 days", text: "Sessions completed ÷ sessions planned in the last 28 days, rest days excluded. Completed = same sport, at least 70 % of the planned time; shorter or another sport counts half. Today's session is not counted until the day is over." },
  ef: { title: "Run efficiency", text: "Efficiency factor of steady runs (up to Z3, at least 20 min): speed in metres per minute ÷ average heart rate, weighted by duration, last 4 weeks. Higher = more speed for the same heart rate. Change vs the 4 weeks before." },
  zones: { title: "Load by heart-rate zone", text: "Each session's load is assigned to a zone by its average heart rate: Z1 below 135 bpm, Z2 135-147, Z3 148-157, Z4 158-167, Z5 168 and above (provisional zones, recalibrated at the week-4 threshold test). Share = that zone's load ÷ all load with heart rate. Load = the sum, minutes × intensity factor. Sessions without heart rate are excluded from the split. Per-second heart-rate data from the Garmin connection will replace the per-session average." },
  intensity: { title: "Intensity distribution", text: "Easy = Z1 + Z2 (below the first ventilatory threshold, conversational), Moderate = Z3 (between thresholds, tempo), Hard = Z4 + Z5 (above the second threshold). Polarized and pyramidal endurance programmes put 75-85% of load in the easy band; this plan targets 75-80% in the Base phases." },
} as const;

// ---------- 1. KPI tiles ----------
/** A half-circle gauge with 1.00 at the centre: the needle sits left (red) when the ratio is under 1, right (green) above. */
/** Run efficiency, PR's sketch: a thick half ring, a tick for 1.00 at the top, a filled segment from the tick to the ratio (its value at the tip), the signed percent inside. 0.85 … 1.15 across the dial. */
function RatioGauge({ ratio, w = 164 }: { ratio: number | null; w?: number }) {
  const sw = 14, h = w * 0.6, cx = w / 2, cy = h - 10, r = w / 2 - 22;
  const f = ratio == null ? 0.5 : Math.max(0, Math.min(1, (ratio - 0.85) / 0.3));
  const ang = Math.PI - f * Math.PI, top = Math.PI / 2;
  const pt = (a: number, rr: number) => `${cx + Math.cos(a) * rr} ${cy - Math.sin(a) * rr}`;
  const arc = (a0: number, a1: number) => `M${pt(a0, r)} A${r} ${r} 0 0 1 ${pt(a1, r)}`; // a0 → a1 clockwise (left to right over the top)
  const up = ratio != null && ratio >= 1;
  const col = ratio == null ? "var(--muted-2)" : up ? "var(--accent)" : "var(--danger)";
  const pct = ratio == null ? "–" : `${ratio >= 1 ? "+" : "−"}${Math.abs((ratio - 1) * 100).toFixed(0)}%`;
  const tipR = r + sw / 2 + 6, tx = cx + Math.cos(ang) * tipR, ty = cy - Math.sin(ang) * tipR;
  return (
    <svg className="gauge" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={ratio == null ? "No baseline yet" : `${ratio.toFixed(2)} of the 4 weeks before, ${pct}`}>
      <path d={arc(Math.PI, 0)} fill="none" stroke="var(--track)" strokeWidth={sw} />
      {ratio != null && Math.abs(ang - top) > 0.01 && <path d={up ? arc(top, ang) : arc(ang, top)} fill="none" stroke={col} strokeWidth={sw} />}
      <line x1={cx} y1={cy - r - sw / 2 - 4} x2={cx} y2={cy - r + sw / 2 + 4} stroke="var(--ink)" strokeWidth={2} />
      <text x={cx} y={cy - r - sw / 2 - 9} textAnchor="middle" fontSize={11} fill="var(--muted)">1</text>
      {ratio != null && <text x={tx} y={ty + 4} textAnchor={f > 0.52 ? "start" : f < 0.48 ? "end" : "middle"} fontSize={11} fontWeight={600} fill="var(--ink)">{ratio.toFixed(2)}</text>}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22} fontWeight={600} fill={ratio == null ? "var(--muted-2)" : col}>{pct}</text>
    </svg>
  );
}
/** The last 28 days as a strip of dots: filled = done, half = partial, ring = missed, faint = nothing planned. */
function DayStrip({ days, w = 110, h = 30 }: { days: { date: string; state: string }[]; w?: number; h?: number }) {
  const cols = 14, rows = 2, gx = w / cols, gy = h / rows, r = Math.min(gx, gy) * 0.3;
  return (
    <svg className="spark strip" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label="Last 28 days, one dot each">
      {days.map((d, i) => { const cx = gx * (i % cols) + gx / 2, cy = gy * Math.floor(i / cols) + gy / 2;
        return d.state === "done" ? <circle key={d.date} cx={cx} cy={cy} r={r} fill="var(--accent)" />
          : d.state === "partial" ? <circle key={d.date} cx={cx} cy={cy} r={r} fill="var(--accent)" opacity={0.45} />
          : d.state === "missed" ? <circle key={d.date} cx={cx} cy={cy} r={r - 0.6} fill="none" stroke="var(--danger)" strokeWidth={1.2} />
          : d.state === "today" ? <circle key={d.date} cx={cx} cy={cy} r={r - 0.6} fill="none" stroke="var(--accent)" strokeWidth={1.2} />
          : <circle key={d.date} cx={cx} cy={cy} r={r * 0.5} fill="var(--track)" />; })}
    </svg>
  );
}
type KpiKey = "week" | "load" | "compliance" | "fitness" | "ef" | "vo2";
const KPI_WINDOWS = [["4w", "4w", 28], ["12w", "12w", 84], ["6m", "6m", 182], ["all", "All", 3650]] as const;
/** A ring that fills with the share completed, the percent in its middle. */
function Ring({ pct, size = 64 }: { pct: number | null; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, f = pct == null ? 0 : Math.max(0, Math.min(1, pct / 100));
  return (
    <svg className="ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={pct == null ? "No sessions planned yet" : `${pct}% of sessions completed`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={6} />
      {pct != null && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.26} fontWeight={600} fill="var(--ink)">{pct == null ? "-" : `${pct}%`}</text>
    </svg>
  );
}
export function KpiRow() {
  const an = useAnalysis();
  const k = an.kpis();
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ key: KpiKey; left: number; top: number; w: number; h: number } | null>(null);
  const [win, setWin] = useState<(typeof KPI_WINDOWS)[number][0]>("12w");
  const days = KPI_WINDOWS.find((x) => x[0] === win)![2];
  const since = ymdOf(addDays(today(), -days));
  // the clicked card grows in place, on top of the others, to about 1.5 times its area; a second click shrinks it back
  const toggle = (key: KpiKey) => (e: React.MouseEvent | React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest(".info")) return;
    if (open?.key === key) { setOpen(null); return; }
    const g = grid.current?.getBoundingClientRect(), c = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (!g) return;
    const w = Math.min(g.width, Math.round(c.width * 1.5)), h = Math.round(c.height);
    const left = Math.max(0, Math.min(g.width - w, c.left - g.left));
    setOpen({ key, left, top: c.top - g.top, w, h });
  };
  const cardProps = (key: KpiKey) => ({ role: "button" as const, tabIndex: 0, "aria-expanded": open?.key === key, onClick: toggle(key), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(key)(e); } } });
  const pts = (v: number | null, unit = " pts", digits = 0) => (v == null ? <span className="delta muted">no baseline yet</span> : <span className="delta">{v > 0 ? "+" : v < 0 ? "−" : "±"}{Math.abs(v).toFixed(digits)}{unit}, 7 d</span>);
  const load = an.LOAD_SERIES.filter((p) => p.date >= since);
  const wk = an.currentWeek();
  const dayBars = Array.from({ length: 7 }, (_, i) => { const d = ymdOf(addDays(fromYmd(wk.start), i)); const plannedH = wk.sessions.filter((s) => s.date === d && s.sport !== "rest").reduce((x, s) => x + s.min, 0) / 60; const doneH = an.activitiesOn(d).reduce((x, a) => x + a.min, 0) / 60; const plannedL = wk.sessions.filter((s) => s.date === d).reduce((x, s) => x + plannedLoad(s), 0); const doneL = an.activitiesOn(d).reduce((x, a) => x + activityLoad(a), 0); return { date: d, plannedH, doneH, plannedL, doneL }; });
  const title: Record<KpiKey, string> = { week: "This week by day", load: "Load by day", compliance: "Last 28 days", fitness: "Fitness, fatigue, form", ef: "Run efficiency", vo2: "VO2max" };
  return (
    <div className="ax-kpis" ref={grid}>
      <div className="card kpi" {...cardProps("week")}><div className="k">This week<Info {...KPI_INFO.week} /></div><div className="row"><div className="v">{k.week.done}<small> / {k.week.total}</small></div></div><div className="u">{k.week.h.toFixed(1)} of {k.week.plannedH.toFixed(1)} h</div><Bars pts={k.week.bars} /></div>
      <div className="card kpi" {...cardProps("load")}><div className="k">Week load<Info {...KPI_INFO.load} /></div><div className="row"><div className="v">{k.load.v}<small> / {k.load.planned}</small></div></div><div className="u">{k.load.last != null ? `last week ${k.load.last}` : "first plan week"}</div><Bars pts={k.load.bars} /></div>
      <div className="card kpi ring-card" {...cardProps("compliance")}><div className="k">Completed<span className="at">28 d</span><Info {...KPI_INFO.compliance} /></div><div className="ring-row"><Ring pct={k.compliance.v} /><div className="u">{k.compliance.planned ? `${Math.round(k.compliance.done * 2) / 2} of ${k.compliance.planned} sessions` : "no sessions planned yet"}</div></div></div>
      <div className="card kpi" {...cardProps("fitness")}><div className="k">Fitness<Info {...KPI_INFO.fitness} /></div><div className="row"><div className="v">{k.fitness.v.toFixed(0)}</div>{pts(k.fitness.d)}</div><div className="u">42-day load</div><Spark pts={k.fitness.spark} /></div>
      <div className="card kpi gauge-card" {...cardProps("ef")}><div className="k">Run efficiency<Info {...KPI_INFO.ef} /></div><RatioGauge ratio={k.ef.ratio} /></div>
      <div className="card kpi" {...cardProps("vo2")}><div className="k">VO2max<Info title="VO2max" text="Your watch's estimate of the most oxygen your body can use per kilogram per minute, the usual measure of aerobic fitness. Change against the reading 4 weeks ago; the line shows the last readings." /></div><div className="row"><div className="v">{k.vo2.v != null ? k.vo2.v.toFixed(0) : "-"}</div>{k.vo2.v != null && (k.vo2.d != null ? <span className="delta">{k.vo2.d >= 0 ? "+" : "−"}{Math.abs(k.vo2.d).toFixed(0)}, 4 wk</span> : <span className="delta muted">first readings</span>)}</div><div className="u">{k.vo2.date ? `last reading ${dateLabel(k.vo2.date)}` : "no readings yet"}</div>{k.vo2.spark.length > 1 ? <Spark pts={k.vo2.spark} /> : null}</div>
      {open && (
        <div className="card kpi-zoom" style={{ left: open.left, top: open.top, width: open.w, minHeight: open.h }} role="dialog" aria-label={title[open.key]}>
          <div className="kd-head">
            <b>{title[open.key]}</b>
            {(open.key === "fitness" || open.key === "ef" || open.key === "vo2") && <div className="pill-group">{KPI_WINDOWS.map(([key, label]) => <button key={key} type="button" className={win === key ? "on" : ""} onClick={() => setWin(key)}>{label}</button>)}</div>}
            <button type="button" className="kd-close" aria-label="Close" onClick={() => setOpen(null)}>×</button>
          </div>
          {open.key === "week" && <DayBars bars={dayBars.map((d) => ({ date: d.date, planned: d.plannedH, done: d.doneH }))} fmt={(v) => `${v.toFixed(1)} h`} />}
          {open.key === "load" && <DayBars bars={dayBars.map((d) => ({ date: d.date, planned: d.plannedL, done: d.doneL }))} fmt={(v) => v.toFixed(0)} />}
          {open.key === "compliance" && <div className="kd-strip"><div className="ring-row"><Ring pct={k.compliance.v} size={84} /><div><b>{k.compliance.planned ? `${Math.round(k.compliance.done * 2) / 2} of ${k.compliance.planned} sessions` : "No sessions planned yet"}</b><p className="muted">{k.compliance.days.filter((d) => d.state === "done").length} days done, {k.compliance.days.filter((d) => d.state === "missed").length} missed, {k.compliance.days.filter((d) => d.state === "rest").length} with nothing planned</p></div></div><DayStrip days={k.compliance.days} w={360} h={44} /><div className="kd-legend"><span><i className="dot" />Done</span><span><i className="dot half" />Partial or another sport</span><span><i className="dot miss" />Missed</span><span><i className="dot rest" />Nothing planned</span></div></div>}
          {open.key === "fitness" && <LinesChart series={[{ k: "Fitness", color: "var(--accent)", pts: load.map((p) => ({ date: p.date, v: p.fitness })) }, { k: "Fatigue", color: "var(--ink)", pts: load.map((p) => ({ date: p.date, v: p.fatigue })) }, { k: "Form", color: "var(--muted)", pts: load.map((p) => ({ date: p.date, v: p.form })) }]} fmt={(v) => v.toFixed(0)} h={98} />}
          {open.key === "ef" && <LinesChart series={[{ k: "Efficiency", color: "var(--accent)", pts: k.ef.points.filter((p) => p.date >= since) }]} fmt={(v) => v.toFixed(2)} unit="m/min per bpm" h={98} />}
          {open.key === "vo2" && <LinesChart series={[{ k: "VO2max", color: "var(--accent)", pts: k.vo2.points.filter((p) => p.date >= since) }]} fmt={(v) => v.toFixed(0)} unit="ml/kg/min" h={98} />}
        </div>
      )}
    </div>
  );
}
/** Seven bars for this week, planned behind done, with the values. */
function DayBars({ bars, fmt }: { bars: { date: string; planned: number; done: number }[]; fmt: (v: number) => string }) {
  const [svgRef, W] = useWidth<SVGSVGElement>(560); const H = 100, L = 36, R = 8, T = 12, B = 22;
  const hi = Math.max(0.1, ...bars.map((b) => Math.max(b.planned, b.done)));
  const colW = (W - L - R) / 7, y = (v: number) => H - B - (v / hi) * (H - T - B);
  const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="This week, day by day">
      {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(hi * f)} y2={y(hi * f)} stroke="var(--grid)" /><text x={L - 6} y={y(hi * f) + 4} textAnchor="end">{fmt(hi * f)}</text></g>)}
      {bars.map((b, i) => { const x0 = L + i * colW + colW * 0.2, bw = colW * 0.6; return (
        <g key={b.date}>
          <rect x={x0} y={y(b.planned)} width={bw} height={Math.max(0, y(0) - y(b.planned))} fill="none" stroke="var(--accent)" strokeDasharray="3 3" rx={3} />
          <rect x={x0} y={y(b.done)} width={bw} height={Math.max(0, y(0) - y(b.done))} fill="var(--accent)" rx={3}><title>{`${DN[i]}: ${fmt(b.done)} of ${fmt(b.planned)} planned`}</title></rect>
          {b.done > 0 && <text x={x0 + bw / 2} y={y(b.done) - 4} textAnchor="middle" fontWeight={600} fill="var(--ink)">{fmt(b.done)}</text>}
          <text x={x0 + bw / 2} y={H - 6} textAnchor="middle">{DN[i]}</text>
        </g>); })}
    </svg>
  );
}
/** Lines with points over time; hover shows the date and each value. */
function LinesChart({ series, fmt, unit = "", h = 170 }: { series: { k: string; color: string; pts: { date: string; v: number }[] }[]; fmt: (v: number) => string; unit?: string; h?: number }) {
  const [svgRef, W] = useWidth<SVGSVGElement>(560); const H = h, L = 44, R = 8, T = 12, B = 24;
  const [hx, setHx] = useState<number | null>(null);
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Not enough readings"><text x={W / 2} y={H / 2} textAnchor="middle">{all.length ? "One reading in this window" : "No readings in this window"}</text></svg>;
  const t0 = Math.min(...all.map((p) => fromYmd(p.date).getTime())), t1 = Math.max(t0 + 1, ...all.map((p) => fromYmd(p.date).getTime()));
  const vs = all.map((p) => p.v); const nt = niceTicks(Math.min(...vs), Math.max(...vs), 4, "number");
  const x = (d: string) => L + ((fromYmd(d).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + ((nt.hi - v) / Math.max(1e-9, nt.hi - nt.lo)) * (H - T - B);
  const nl = W < 400 ? 3 : 5;
  const labels = axisPicks(nl, nl).map((i) => new Date(t0 + (i / (nl - 1)) * (t1 - t0)));
  const hoverT = hx == null ? null : t0 + ((hx - L) / (W - L - R)) * (t1 - t0);
  const near = hoverT == null ? [] : series.map((s) => { let best: { date: string; v: number } | null = null, bd = Infinity; for (const p of s.pts) { const dd = Math.abs(fromYmd(p.date).getTime() - hoverT); if (dd < bd) { bd = dd; best = p; } } return { k: s.k, color: s.color, p: best }; }).filter((n) => n.p);
  const cx = near.length && near[0].p ? x(near[0].p.date) / W : 0;
  return (
    <div className="ax-progwrap" onMouseLeave={() => setHx(null)}>
      <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.k).join(", ")} onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHx(((e.clientX - r.left) / r.width) * W); }}>
        {nt.ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>)}
        {series.map((s) => <g key={s.k}>
          <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.pts.map((p) => `${x(p.date)},${y(p.v)}`).join(" ")} />
          {s.pts.length <= 120 && s.pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r="3" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />)}
        </g>)}
        {labels.map((dd, i) => ({ i, t: shortDate(ymdOf(dd)) })).filter((l, j, arr) => j === 0 || l.t !== arr[j - 1].t).map(({ i, t }) => <text key={i} x={L + (i / (nl - 1)) * (W - L - R)} y={H - 6} textAnchor={i === 0 ? "start" : i === nl - 1 ? "end" : "middle"}>{t}</text>)}
        {near.length > 0 && near[0].p && <line x1={x(near[0].p.date)} y1={T} x2={x(near[0].p.date)} y2={H - B} stroke="var(--muted-2)" strokeDasharray="3 3" />}
        {near.map((n) => n.p ? <circle key={n.k} cx={x(n.p.date)} cy={y(n.p.v)} r={5.5} fill={n.color} stroke="var(--surface)" strokeWidth={2} /> : null)}
      </svg>
      {near.length > 0 && near[0].p && (
        <div className="ax-vtip" style={{ left: `${cx * 100}%`, transform: cx > 0.75 ? "translateX(-100%)" : cx < 0.2 ? "none" : "translateX(-50%)" }}>
          <div className="d">{dateLabel(near[0].p.date)}</div>
          {near.map((n) => n.p ? <div key={n.k}><span><i style={{ background: n.color }} />{n.k}</span><b>{fmt(n.p.v)} {unit}</b></div> : null)}
        </div>)}
    </div>
  );
}

// ---------- 2. Performance overview (fitness / fatigue / form) ----------
export function Overview({ range: master, firstDate }: { range: Range; firstDate: string }) {
  const { LOAD_SERIES } = useAnalysis();
  const [range, setRange] = useOwnRange(master);
  const pts = LOAD_SERIES.filter((p) => p.date >= range.from && p.date <= range.to);
  const [hover, setHover] = useState<number | null>(null);
  const i = hover ?? pts.length - 1;
  const [svgRef, W] = useWidth<SVGSVGElement>(760); const H = 230, L = 40, R = 16, T = 12, B = 28;
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
        <div><h2>Performance overview</h2></div>
        <div className="ax-tools">
          <span className="lgd"><span><i style={{ background: "var(--accent)" }} />Fitness</span><span><i style={{ background: "var(--ink)" }} />Fatigue</span><span><i style={{ background: "var(--muted)" }} />Form</span></span>
          <RangePills value={range} onChange={setRange} firstDate={firstDate} label="Performance overview range" />
        </div>
      </div>
      <div className="ax-overview">
        <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fitness, fatigue and form" onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const j = Math.round(((px - L) / (W - L - R)) * (pts.length - 1)); setHover(Math.max(0, Math.min(pts.length - 1, j))); }}>
          {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke={v === 0 ? "var(--line)" : "var(--grid)"} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
          <path d={area} fill="var(--accent-soft)" opacity={0.7} />
          <path d={line("form")} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="4 3" />
          <path d={line("fatigue")} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
          <path d={line("fitness")} fill="none" stroke="var(--accent)" strokeWidth={2.2} />
          {pts.map((q, j) => j % every === 0 || j === pts.length - 1 ? <circle key={q.date} cx={x(j)} cy={y(q.fitness)} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} /> : null)}
          <line x1={x(i)} y1={T} x2={x(i)} y2={H - B} stroke="var(--muted-2)" strokeDasharray="3 3" />
          <circle cx={x(i)} cy={y(p.fitness)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.fatigue)} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.form)} r={4} fill="var(--muted)" stroke="var(--surface)" strokeWidth={2} />
          {pts.map((q, j) => (j === pts.length - 1 || (j % every === 0 && j <= pts.length - 1 - every)) ? <text key={"l" + q.date} x={x(j)} y={H - 8} textAnchor={j === pts.length - 1 ? "end" : j === 0 ? "start" : "middle"}>{shortDate(q.date)}</text> : null)}
        </svg>
        <div className="ax-tip">
          <div className="d">{dateLabel(p.date)}</div>
          <div><span><i style={{ background: "var(--accent)" }} />Fitness</span><b>{p.fitness.toFixed(0)}</b></div>
          <div><span><i style={{ background: "var(--ink)" }} />Fatigue</span><b>{p.fatigue.toFixed(0)}</b></div>
          <div><span><i style={{ background: "var(--muted)" }} />Form</span><b>{sign(p.form)}</b></div>
          <div><span><i style={{ background: "var(--track)" }} />Day load</span><b>{p.load}</b></div>
        </div>
      </div>
    </section>
  );
}

// ---------- 3. Training volume ----------
type Grain = "day" | "week" | "month";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Done against planned, per day of this week, per week of the range, or per month. */
export function Volume({ range }: { range: Range }) {
  const an = useAnalysis();
  const [mode, setMode] = useState<"hours" | "distance" | "load">("hours");
  const [grain, setGrain] = useState<Grain>("day"); // opens on this week, day by day
  const [hov, setHov] = useState<number | null>(null);
  const cur = an.currentWeek();
  const weeks = an.weeks.filter((w) => w.week <= cur.week && w.start <= range.to && ymdOf(addDays(fromYmd(w.start), 6)) >= range.from);
  type Sess = (typeof weeks)[number]["sessions"][number];
  // one bucket per bar: its label, the planned sessions in it and the activities done in it
  type Bucket = { key: string; label: string; title: string; sessions: Sess[]; from: Date; to: Date };
  const buckets: Bucket[] = (() => {
    if (grain === "day") {
      const s0 = fromYmd(cur.start);
      const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return Array.from({ length: 7 }, (_, i) => { const d = addDays(s0, i); const key = ymdOf(d); return { key, label: `${DAY[d.getDay()]} ${d.getDate()}`, title: dateLabel(key), sessions: cur.sessions.filter((x) => x.date === key), from: d, to: addDays(d, 1) }; });
    }
    if (grain === "month") {
      const out: Bucket[] = [];
      for (const w of weeks) for (const x of w.sessions) {
        const d = fromYmd(x.date); const key = `${d.getFullYear()}-${d.getMonth()}`;
        let b = out.find((o) => o.key === key);
        if (!b) { const from = new Date(d.getFullYear(), d.getMonth(), 1); b = { key, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, sessions: [], from, to: new Date(d.getFullYear(), d.getMonth() + 1, 1) }; out.push(b); }
        b.sessions.push(x);
      }
      return out;
    }
    return weeks.map((w) => ({ key: w.start, label: shortDate(w.start), title: `Week ${w.week}, ${dateLabel(w.start)}`, sessions: w.sessions, from: fromYmd(w.start), to: addDays(fromYmd(w.start), 7) }));
  })();
  const per = (b: Bucket) => {
    const acts = an.activities.filter((a) => { const d = fromYmd(a.date); return d >= b.from && d < b.to; });
    const g = { swim: 0, bike: 0, run: 0, other: 0 };
    const hours = { swim: 0, bike: 0, run: 0, other: 0 }, count = { swim: 0, bike: 0, run: 0, other: 0 };
    for (const a of acts) {
      const k = a.sport === "swim" || a.sport === "bike" || a.sport === "run" ? a.sport : "other";
      g[k] += mode === "hours" ? a.min / 60 : mode === "load" ? activityLoad(a, an.athlete.lthr ?? undefined) : dist(a.sport === "swim" ? (a.yd ?? 0) / 1760 : a.mi ?? 0).v;
      hours[k] += a.min / 60; count[k]++;
    }
    const active = b.sessions.filter((x) => x.sport !== "rest");
    const plannedMin = active.reduce((t, x) => t + x.min, 0);
    const planned = mode === "hours" ? plannedMin / 60 : mode === "load" ? active.reduce((s2, x) => s2 + plannedLoad(x), 0) : null;
    return { b, g, planned, hours, count, activities: acts.length, hoursTotal: acts.reduce((t, a) => t + a.min, 0) / 60, plannedH: plannedMin / 60, plannedSessions: active.length };
  };
  const rows = buckets.map(per);
  const [svgRef, W] = useWidth<SVGSVGElement>(760); const H = 230, L = mode === "hours" ? 40 : 48, R = 10, T = 16, B = 26;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.g.swim + r.g.bike + r.g.run + r.g.other, r.planned ?? 0)));
  const nt = niceTicks(0, max, 4, mode === "hours" ? "hours" : "number");
  const nice = nt.hi || 1;
  const y = (v: number) => H - B - (v / nice) * (H - T - B);
  const gw = (W - L - R) / Math.max(1, rows.length), bw = Math.min(40, gw * 0.55);
  const ticks = nt.ticks;
  // the unit sits on the tick labels ("4 h", "20 mi"), never as a stray letter above the axis
  const tick = (v: number) => (mode === "hours" ? `${v} h` : mode === "distance" ? `${Math.round(v)} ${dist(0).u}` : String(Math.round(v)));
  return (
    <section className="card ax-panel" aria-label="Training volume">
      <div className="ax-head">
        <div><h2>Training volume</h2></div>
        <div className="ax-tools">
          <div className="pill-group">{(["day", "week", "month"] as const).map((g) => <button key={g} type="button" className={grain === g ? "on" : ""} onClick={() => { setGrain(g); setHov(null); }}>{g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}</button>)}</div>
          <div className="pill-group">{(["hours", "distance", "load"] as const).map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "hours" ? "Hours" : m === "distance" ? "Distance" : "Load"}</button>)}</div>
          <span className="lgd"><span><i style={{ background: "var(--swim)" }} />Swim</span><span><i style={{ background: "var(--bike)" }} />Bike</span><span><i style={{ background: "var(--run)" }} />Run</span><span><i style={{ background: "var(--strength-soft)", border: "1px solid var(--line)" }} />Other</span><span><i className="dash" />Planned</span></span>
        </div>
      </div>
      <div className="ax-volwrap" onMouseLeave={() => setHov(null)}>
        <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Training volume, done against planned">
          {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{tick(v)}</text></g>)}
          {rows.map((r, i) => {
            const cx = L + i * gw + gw / 2;
            const segs: [number, string][] = [[r.g.run, "var(--run)"], [r.g.bike, "var(--bike)"], [r.g.swim, "var(--swim)"], [r.g.other, "var(--strength-soft)"]];
            let acc = 0;
            return (
              <g key={r.b.key} onMouseEnter={() => setHov(i)} opacity={hov == null || hov === i ? 1 : 0.6}>
                <rect x={L + i * gw} y={T} width={gw} height={H - T - B} fill="transparent" />
                {r.planned != null && <rect x={cx - bw / 2 - 3} y={y(r.planned)} width={bw + 6} height={Math.max(0, y(0) - y(r.planned))} fill="none" stroke="var(--muted-2)" strokeDasharray="3 3" rx={3} />}
                {segs.map(([v, c], k) => { const el = v > 0 ? <rect key={k} x={cx - bw / 2} y={y(acc + v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={c} /> : null; acc += v; return el; })}
                <text x={cx} y={H - 8} textAnchor="middle" fontWeight={hov === i ? 600 : undefined}>{r.b.label}</text>
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
              <div className="d">{r.b.title}</div>
              <div className="tot"><b>{fmtHours(r.hoursTotal)}</b> done, <b>{r.activities}</b> {r.activities === 1 ? "activity" : "activities"}</div>
              <div className="sub">plan {fmtHours(r.plannedH)}, {r.plannedSessions} sessions</div>
              {line("swim", "Swim", "var(--swim)")}{line("bike", "Bike", "var(--bike)")}{line("run", "Run", "var(--run)")}{line("other", "Other", "var(--strength-soft)")}
              {!r.activities && <div className="sub">No activities logged</div>}
            </div>
          );
        })()}
      </div>
      {mode === "distance" && <div className="ax-foot muted">Swim {unitWords().long.swim} shown as {unitWords().long.dist}.</div>}
    </section>
  );
}

// ---------- 4. Load distribution ----------
export function LoadDistribution({ range }: { range: Range }) {
  const an = useAnalysis();
  const z = an.zoneDistribution(range.from, range.to);
  const colors = ["var(--z1)", "var(--z2)", "var(--z3)", "var(--z4)", "var(--z5)"];
  const r = 52, c = 2 * Math.PI * r;
  let off = 0;
  const easyDelta = z.prevEasy != null ? z.easy - z.prevEasy : null;
  return (
    <section className="card ax-panel" aria-label="Load distribution">
      <div className="ax-head"><div><h2>Load distribution</h2><p>{z.withHr} of {z.sessions} sessions have heart rate</p></div></div>
      <div className="ax-dist">
        <div className="donut-wrap">
          <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="Load by zone">
            {z.zones.map((zz, i) => { const len = (zz.pct / 100) * c; const el = <circle key={zz.z} cx="70" cy="70" r={r} fill="none" stroke={colors[i]} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />; off += len; return el; })}
            <text x="70" y="66" textAnchor="middle" className="ink" fontSize="24" fontWeight="600">{z.total}</text>
            <text x="70" y="84" textAnchor="middle">load, {range.key === "all" ? "all" : range.key === "custom" ? `${rangeDays(range)} d` : RANGE_LABEL[range.key].replace(" month", " mo")}</text>
          </svg>
          <table className="zones"><thead><tr><th>Zone<Info {...KPI_INFO.zones} /></th><th>Share</th><th>Load</th></tr></thead><tbody>{z.zones.map((zz, i) => <tr key={zz.z}><td><i style={{ background: colors[i] }} />Zone {zz.z}</td><td>{zz.pct}%</td><td className="muted">{zz.load}</td></tr>)}</tbody></table>
        </div>
        <div className="intensity">
          <div className="k">Intensity distribution<Info {...KPI_INFO.intensity} /></div>
          <div className="ibar"><i style={{ width: `${z.easy}%`, background: "var(--z2)" }} /><i style={{ width: `${z.moderate}%`, background: "var(--accent)" }} /><i style={{ width: `${z.hard}%`, background: "var(--run)" }} /></div>
          <div className="ilbl"><div><b>{z.easy}%</b><span>Easy (Z1-Z2)</span></div><div><b>{z.moderate}%</b><span>Moderate (Z3)</span></div><div><b>{z.hard}%</b><span>Hard (Z4-Z5)</span></div></div>
        </div>
        <div className={`note ${easyDelta != null && easyDelta >= 0 ? "ok" : ""}`}>
          <div className="t">Easy share {z.easy}%{easyDelta != null ? `, ${sign(easyDelta)} pts vs previous period` : ""}</div>
          <div className="s">Base-phase target: 75-80 % easy.</div>
        </div>
      </div>
    </section>
  );
}

// ---------- 5. Sport performance ----------
const ROW_INFO: Record<string, { title: string; text: string }> = {
  Pace: { title: "Pace", text: "Average pace of your last sessions, weighted by how long each one was. Lower is faster." },
  "Avg speed": { title: "Average speed", text: "Average speed of your last rides, weighted by how long each one was." },
  "Best pace": { title: "Best pace", text: "The fastest average pace among your last sessions that were long enough to count." },
  "Best speed": { title: "Best speed", text: "The fastest average speed among your last rides that were long enough to count." },
  "Heart rate": { title: "Heart rate", text: "Average heart rate of your last sessions, weighted by duration. Lower at the same pace means the work costs less." },
  "Longest swim": { title: "Longest swim", text: "The longest single swim among your last sessions." },
  "Longest ride": { title: "Longest ride", text: "The longest single ride among your last sessions." },
  "Longest run": { title: "Longest run", text: "The longest single run among your last sessions." },
};
/** Indexes of the x-axis labels for n points: the first, the last, and up to two in between, spread evenly. */
export function axisPicks(n: number, want = 4): number[] {
  if (n <= want) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let i = 0; i < want; i++) out.add(Math.floor((i * (n - 1)) / (want - 1)));
  return [...out];
}
/** An arc gauge with the score inside: the latest session of a sport, 0-100. */
function ScoreGauge({ sp }: { sp: Sp }) {
  const an = useAnalysis();
  const sc = an.sessionScore(sp);
  const w = 104, r = 44, cx = w / 2, cy = w / 2, c = 2 * Math.PI * r, arcLen = c * 0.75;
  const f = sc ? sc.score / 100 : 0;
  return (
    <div className={`sgauge${sc ? "" : " empty"}`}>
      <svg viewBox={`0 0 ${w} ${w}`} width={w} height={w} role="img" aria-label={sc ? `${sp} session score ${sc.score}` : `no ${sp} session yet`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-soft)" strokeWidth={10} strokeDasharray={`${arcLen} ${c - arcLen}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
        {sc && <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent)" strokeWidth={10} strokeDasharray={`${arcLen * f} ${c - arcLen * f}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />}
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize={28} fontWeight={600} fill="var(--ink)">{sc ? sc.score : "–"}</text>
      </svg>
      <span className="sg-sport"><SportIcon sport={sp} size={20} />{sp[0].toUpperCase() + sp.slice(1)}</span>
      <div className="sg-pop" role="tooltip">
        <b>Session score{sc ? `: ${sc.activity.name}, ${dateLabel(sc.activity.date)}` : ""}</b>
        <p>Your last {sp} session out of 100: how hard it was against your threshold (40), speed per heartbeat against your 4-week usual (30), and how long it was against your longest (30).</p>
        {sc && sc.parts.map((p) => <div key={p.k}><span>{p.k}</span><b>{p.pts} / {p.max}</b><small>{p.text}</small></div>)}
        {sc && sc.missing.length > 0 && <small className="muted">No {sc.missing.join(" or ")} for this session, so the score is scaled to the parts it has.</small>}
      </div>
    </div>
  );
}
const weekLabel = (q: { week: number }) => `W${q.week}`;
/** Hover on a small weekly chart: the nearest week's index from the pointer's x, cleared when the pointer leaves. */
function useChartHover(n: number, L: number, R: number, W: number) {
  const [i, setI] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => { if (n < 1) return; const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setI(Math.max(0, Math.min(n - 1, Math.round(((px - L) / Math.max(1, W - L - R)) * (n - 1))))); };
  return { i, onMove, onLeave: () => setI(null) };
}
function HoverMark({ i, x, y, v, W, H, T, B, label, value }: { i: number | null; x: (i: number) => number; y: (n: number) => number; v: number | null | undefined; W: number; H: number; T: number; B: number; label: string; value: string }) {
  if (i == null || v == null) return null;
  const cx = x(i) / W;
  return (
    <>
      <line x1={x(i)} y1={T} x2={x(i)} y2={H - B} stroke="var(--muted-2)" strokeDasharray="3 3" />
      <circle cx={x(i)} cy={y(v)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
      <foreignObject x={0} y={0} width={W} height={H} style={{ pointerEvents: "none", overflow: "visible" }}>
        <div className="mt-tip" style={{ left: `${cx * 100}%`, transform: cx > 0.7 ? "translateX(-100%)" : cx < 0.2 ? "none" : "translateX(-50%)" }}><span className="d">{label}</span>{value}</div>
      </foreignObject>
    </>
  );
}
function MiniTrend({ pts, kind, sp, label, info }: { pts: { week: number; start: string; v: number | null }[]; kind: "pace" | "speed" | "hr"; sp: Sp; label: string; info: string }) {
  const [svgRef, W] = useWidth<SVGSVGElement>(240); const H = 98, L = 44, R = 8, T = 14, B = 18;
  const disp = pts.map((q) => ({ ...q, v: q.v == null ? null : kind === "pace" ? paceDisp(sp, q.v) : kind === "speed" ? speed(q.v).v : q.v }));
  const v = disp.map((q) => q.v).filter((q): q is number => q != null);
  const lo = v.length ? Math.min(...v) : 0, hi = v.length ? Math.max(...v) : 1;
  const nt = evenTicks(lo, hi, kind);
  const inv = kind === "pace";
  const y = (n: number) => (inv ? T + ((n - nt.lo) / (nt.hi - nt.lo)) * (H - T - B) : H - B - ((n - nt.lo) / (nt.hi - nt.lo)) * (H - T - B));
  const x = (i: number) => L + (disp.length < 2 ? 0 : (i / (disp.length - 1)) * (W - L - R));
  const f = (n: number) => (kind === "pace" ? fmtPace(n) : kind === "speed" ? n.toFixed(1) : n.toFixed(0));
  const ft = (n: number) => fmtTick(kind, n, nt.step);
  let d = "", started = false;
  disp.forEach((q, i) => { if (q.v == null) { started = false; return; } d += `${started ? "L" : "M"}${x(i)} ${y(q.v)}`; started = true; });
  const cur = [...disp].reverse().find((q) => q.v != null);
  const unit = kind === "pace" ? (sp === "swim" ? `per 100 ${swimDist(0).u === "m" ? "metres" : "yards"}` : `per ${dist(0).u === "km" ? "km" : "mile"}`) : kind === "speed" ? speed(0).u : "bpm";
  const picks = axisPicks(disp.length);
  const hov = useChartHover(disp.length, L, R, W);
  return (
    <div className="insight">
      <div className="k"><span>{titleCase(label)} <small>({unit})</small></span><Info title={label} text={info} /><b>{cur?.v != null ? f(cur.v) : "-"}</b></div>
      <svg ref={svgRef} className="chart mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseMove={hov.onMove} onMouseLeave={hov.onLeave}>
        {v.length ? nt.ticks.map((g, i) => <g key={i}><line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="var(--grid)" /><text x={L - 5} y={y(g) + 3} textAnchor="end">{ft(g)}</text></g>) : null}
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        {disp.map((q, i) => q.v != null ? <circle key={i} cx={x(i)} cy={y(q.v)} r={2.4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1}><title>{`${weekLabel(q)}: ${f(q.v)} ${unit}`}</title></circle> : null)}
        {picks.map((i) => <text key={"w" + i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === disp.length - 1 ? "end" : "middle"}>{weekLabel(disp[i])}</text>)}
        {!v.length && <text x={W / 2} y={H / 2} textAnchor="middle">Needs sessions with {kind === "hr" || label.includes("heart") ? "heart rate" : "pace"}</text>}
        {hov.i != null && disp[hov.i] && <HoverMark i={hov.i} x={x} y={y} v={disp[hov.i].v} W={W} H={H} T={T} B={B} label={weekLabel(disp[hov.i])} value={disp[hov.i].v != null ? `${f(disp[hov.i].v!)} ${kind === "speed" ? speed(0).u : kind === "hr" ? "bpm" : unitOf(sp)}` : "-"} />}
      </svg>
    </div>
  );
}
function SportCard({ sp, expert }: { sp: Sp; expert: boolean }) {
  const an = useAnalysis();
  const p = an.sportPerformance(sp);
  const fmtRow = (kind: string, v: number | null) => v == null ? "-" : kind === "pace" ? `${fmtV(sp, paceDisp(sp, v))} ${unitOf(sp)}` : kind === "speed" ? fmtSpeed(v) : kind === "hr" ? `${v.toFixed(0)} bpm` : sp === "swim" ? `${swimDist(v).v.toLocaleString()} ${swimDist(0).u}` : fmtDist(v);
  const good = (kind: string) => (kind === "pace" || kind === "hr" ? "down" : "up");
  const [svgRef, W] = useWidth<SVGSVGElement>(240); const H = 98, L = 44, R = 8, T = 14, B = 18;
  const pts = p.trend.map((q) => ({ ...q, v: q.v == null ? q.v : paceDisp(sp, q.v) })); // in the athlete's units, so the ticks land on round numbers
  const v = pts.map((q) => q.v).filter((q): q is number => q != null);
  const lo = v.length ? Math.min(...v) : 0, hi = v.length ? Math.max(...v) : 1;
  const nt = evenTicks(lo, hi, sp === "bike" ? "speed" : "pace");
  const ylo = nt.lo, yhi = nt.hi;
  const inv = sp !== "bike";
  const y = (n: number) => (inv ? T + ((n - ylo) / (yhi - ylo)) * (H - T - B) : H - B - ((n - ylo) / (yhi - ylo)) * (H - T - B));
  const x = (i: number) => L + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * (W - L - R));
  let d = "", started = false;
  pts.forEach((q, i) => { if (q.v == null) { started = false; return; } d += `${started ? "L" : "M"}${x(i)} ${y(q.v)}`; started = true; });
  const guides = nt.ticks;
  const picks = axisPicks(pts.length);
  const unitLabel = sp === "bike" ? `(${speed(0).u})` : sp === "swim" ? `(per 100 ${swimDist(0).u === "m" ? "metres" : "yards"})` : `(per ${dist(0).u === "km" ? "km" : "mile"})`;
  const insights = expert ? an.sportInsights(sp) : [];
  const hov = useChartHover(pts.length, L, R, W);
  return (
    <div className="sport">
      <ScoreGauge sp={sp} />
      <div className="sh"><b>{p.sessions ? `Last ${p.sessions} Session${p.sessions === 1 ? "" : "s"}` : "No Sessions Yet"}</b></div>
      <table><tbody>{p.rows.map((r) => <tr key={r.k}><td><span className="info-row">{r.k}{ROW_INFO[r.k] && <Info {...ROW_INFO[r.k]} />}</span></td><td><b>{fmtRow(r.kind, r.cur)}</b></td><td><Delta v={r.cur != null && r.prev ? ((r.cur - r.prev) / r.prev) * 100 : null} good={good(r.kind)} /></td></tr>)}</tbody></table>
      <div className="k">{sp === "bike" ? "Weekly Average Speed" : "Weekly Average Pace"} {unitLabel}</div>
      <svg ref={svgRef} className="chart mini" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} weekly ${sp === "bike" ? "speed" : "pace"} trend`} onMouseMove={hov.onMove} onMouseLeave={hov.onLeave}>
        {v.length ? guides.map((g, i) => <g key={i}><line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="var(--grid)" /><text x={L - 5} y={y(g) + 3} textAnchor="end">{fmtTick(sp === "bike" ? "speed" : "pace", g, nt.step)}</text></g>) : null}
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        {pts.map((q, i) => q.v != null ? <circle key={i} cx={x(i)} cy={y(q.v)} r={2.4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1}><title>{`${weekLabel(q)}: ${fmtV(sp, q.v)}`}</title></circle> : null)}
        {picks.map((i) => <text key={"w" + i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}>{weekLabel(pts[i])}</text>)}
        {!v.length && <text x={W / 2} y={H / 2} textAnchor="middle">No {sp} sessions yet</text>}
        {hov.i != null && pts[hov.i] && <HoverMark i={hov.i} x={x} y={y} v={pts[hov.i].v} W={W} H={H} T={T} B={B} label={weekLabel(pts[hov.i])} value={pts[hov.i].v != null ? `${fmtV(sp, pts[hov.i].v!)} ${unitOf(sp)}` : "-"} />}
      </svg>
      {expert && insights.map((ins) => <MiniTrend key={ins.k} pts={ins.pts} kind={ins.kind} sp={sp} label={ins.label} info={ins.info} />)}
    </div>
  );
}
export function SportRow() {
  const [expert, setExpert] = useState(false);
  return (
    <section className="card ax-panel" aria-label="Sport performance">
      <div className="ax-head">
        <div><h2>Sport performance</h2></div>
        <div className="pill-group" role="group" aria-label="Detail"><button type="button" className={expert ? "" : "on"} onClick={() => setExpert(false)}>Basic</button><button type="button" className={expert ? "on" : ""} onClick={() => setExpert(true)}>Expert</button></div>
      </div>
      <div className="ax-sports"><SportCard sp="run" expert={expert} /><SportCard sp="bike" expert={expert} /><SportCard sp="swim" expert={expert} /></div>
    </section>
  );
}

// ---------- 6. Progress over time ----------
export function Progress({ range: master, firstDate, onPick }: { range: Range; firstDate: string; onPick: (id: string) => void }) {
  const [range, setRange] = useOwnRange(master);
  const an = useAnalysis();
  const [sp, setSp] = useState<Sp | "all">("run");
  const [m, setM] = useState<Metric>("pace");
  const days = rangeDays(range);
  const [svgRef, W] = useWidth<SVGSVGElement>(760); const H = 220, L = 46, R = 12, T = 14, B = 26;
  const COLORS: Record<Sp, string> = { swim: "var(--swim)", bike: "var(--bike)", run: "var(--run)" };
  const sports: Sp[] = sp === "all" ? ["swim", "bike", "run"] : [sp];
  // in "all" mode the sports have different units for pace and distance, so each is plotted as % of its first session
  const normalise = sp === "all" && (m === "pace" || m === "distance");
  // bike "pace" is a speed, so its ratio is flipped to keep "faster = up" consistent with run and swim
  const conv = (k: Sp, v: number) => (m === "pace" ? paceDisp(k, v) : m === "distance" ? distDisp(k, v) : v); // stored → the athlete's units
  const series = sports.map((k) => { const s = an.progressSeries(k, m, range.from, range.to); const base = s.pts[0]?.v ?? 1; return { k, ...s, plot: s.pts.map((q) => ({ ...q, y: normalise ? (m === "pace" && k === "bike" ? (base / q.v) * 100 : (q.v / base) * 100) : conv(k, q.v) })) }; });
  const all = series.flatMap((s) => s.plot);
  const inv = m === "pace" && sp !== "bike" && !normalise ? true : normalise && m === "pace";
  const vals = all.map((q) => q.y);
  const rawLo = vals.length ? Math.min(...vals) : 0, rawHi = vals.length ? Math.max(...vals) : 1;
  const floorZero = !(m === "pace" || m === "hr" || normalise);
  const nt = niceTicks(floorZero ? 0 : rawLo, rawHi, 4, normalise ? "percent" : m === "pace" && sp !== "bike" ? "pace" : m === "duration" ? "number" : "number");
  const lo = nt.lo, hi = nt.hi;
  const start = all.length ? fromYmd(all.reduce((a, q) => (q.date < a ? q.date : a), all[0].date)) : addDays(fromYmd(range.to), -days), end = fromYmd(range.to);
  const x = (dt: string) => L + ((fromYmd(dt).getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * (W - L - R);
  const y = (n: number) => (inv ? T + ((n - lo) / (hi - lo)) * (H - T - B) : H - B - ((n - lo) / (hi - lo)) * (H - T - B));
  const fmtFor = (k: Sp, n: number) => m === "pace" ? fmtV(k, n) : m === "hr" ? `${n.toFixed(0)}` : m === "distance" ? (k === "swim" ? `${Math.round(n)}` : n.toFixed(1)) : m === "duration" ? fmtHMS(n) : n.toFixed(0);
  const fmtAxis = (n: number) => normalise ? `${n.toFixed(0)}%` : sp === "all" ? (m === "duration" ? fmtHMS(n) : n.toFixed(0)) : fmtFor(sp as Sp, n);
  const unitFor = (k: Sp) => m === "pace" ? unitOf(k) : m === "hr" ? "bpm" : m === "distance" ? (k === "swim" ? swimDist(0).u : dist(0).u) : m === "duration" ? "" : "load";
  const goodDir = m === "pace" ? (sp === "bike" ? "up" : "down") : m === "hr" ? "down" : "up";
  const single = sp !== "all" ? series[0] : null;
  // hover: the nearest session by date on each series; date labels spread evenly across the range
  const [hoverX, setHoverX] = useState<number | null>(null);
  const span = Math.max(1, end.getTime() - start.getTime());
  const hoverDate = hoverX == null ? null : new Date(start.getTime() + ((hoverX - L) / (W - L - R)) * span);
  const nearest = hoverDate ? series.map((sr) => { let best: (typeof sr.plot)[number] | null = null, bd = Infinity; for (const q of sr.plot) { const dd = Math.abs(fromYmd(q.date).getTime() - hoverDate.getTime()); if (dd < bd) { bd = dd; best = q; } } return { k: sr.k, q: best }; }).filter((n) => n.q) : [];
  const labelDates = all.length ? axisPicks(6, 6).map((i) => new Date(start.getTime() + (i / 5) * span)) : [];
  return (
    <section className="card ax-panel" aria-label="Progress over time">
      <div className="ax-head">
        <div><h2>Progress over time</h2>{normalise && <p>% of each sport's first session in range</p>}</div>
        <div className="ax-tools">
          {sp === "all" && <span className="lgd">{sports.map((k) => <span key={k}><i style={{ background: COLORS[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</span>}
          <div className="pill-group">{(["all", "swim", "bike", "run"] as const).map((k) => <button key={k} type="button" className={sp === k ? "on" : ""} onClick={() => setSp(k)}>{k === "all" ? "All" : k[0].toUpperCase() + k.slice(1)}</button>)}</div>
          <RangePills value={range} onChange={setRange} firstDate={firstDate} label="Progress range" />
        </div>
      </div>
      <div className="tabs ax-tabs">{METRICS.map((t) => <button key={t.k} type="button" className={m === t.k ? "on" : ""} onClick={() => setM(t.k)}>{t.label}</button>)}</div>
      <div className="ax-progress">
        <div className="ax-progwrap" onMouseLeave={() => setHoverX(null)}>
        <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} ${m} over time`} onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHoverX(((e.clientX - r.left) / r.width) * W); }}>
          {nt.ticks.map((t, k) => <g key={k}><line x1={L} y1={y(t)} x2={W - R} y2={y(t)} stroke="var(--grid)" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{fmtAxis(t)}</text></g>)}
          {normalise && <line x1={L} y1={y(100)} x2={W - R} y2={y(100)} stroke="var(--muted-2)" strokeDasharray="4 4" />}
          {series.map((s) => (
            <g key={s.k}>
              {s.plot.length > 1 && sp !== "all" && <path d={`${s.plot.map((q, i) => `${i ? "L" : "M"}${x(q.date)} ${y(q.y)}`).join("")} L${x(s.plot[s.plot.length - 1].date)} ${y(inv ? hi : lo)} L${x(s.plot[0].date)} ${y(inv ? hi : lo)} Z`} fill="var(--accent-soft)" opacity={0.6} />}
              {s.plot.length > 1 && <path d={s.plot.map((q, i) => `${i ? "L" : "M"}${x(q.date)} ${y(q.y)}`).join("")} fill="none" stroke={sp === "all" ? COLORS[s.k] : "var(--accent)"} strokeWidth={2} />}
              {s.plot.map((q) => <circle key={q.id} cx={x(q.date)} cy={y(q.y)} r={4} fill={sp === "all" ? COLORS[s.k] : "var(--accent)"} stroke="var(--surface)" strokeWidth={1.5} style={{ cursor: "pointer" }} onClick={() => onPick(q.id)}><title>{`${s.k}, ${dateLabel(q.date)}, ${fmtFor(s.k, q.v)} ${unitFor(s.k)}`}</title></circle>)}
            </g>
          ))}
          {all.length ? labelDates.map((dd, i) => <text key={i} x={L + (i / 5) * (W - L - R)} y={H - 8} textAnchor={i === 0 ? "start" : i === 5 ? "end" : "middle"}>{shortDate(ymdOf(dd))}</text>) : <text x={W / 2} y={H / 2} textAnchor="middle">No sessions in range</text>}
          {nearest.length > 0 && nearest[0].q && <line x1={x(nearest[0].q.date)} y1={T} x2={x(nearest[0].q.date)} y2={H - B} stroke="var(--muted-2)" strokeDasharray="3 3" />}
          {nearest.map((n) => n.q ? <circle key={n.k} cx={x(n.q.date)} cy={y(n.q.y)} r={6} fill={sp === "all" ? COLORS[n.k] : "var(--accent)"} stroke="var(--surface)" strokeWidth={2} /> : null)}
        </svg>
        {nearest.length > 0 && nearest[0].q && (() => { const cx = x(nearest[0].q!.date) / W; return (
          <div className="ax-vtip" style={{ left: `${cx * 100}%`, transform: cx > 0.75 ? "translateX(-100%)" : cx < 0.2 ? "none" : "translateX(-50%)" }}>
            <div className="d">{dateLabel(nearest[0].q!.date)}</div>
            {nearest.map((n) => n.q ? <div key={n.k}><span><i style={{ background: sp === "all" ? COLORS[n.k] : "var(--accent)" }} />{n.k[0].toUpperCase() + n.k.slice(1)}</span><b>{fmtFor(n.k, n.q.v)} {unitFor(n.k)}</b><span className="n">{normalise ? `${n.q.y.toFixed(0)}%` : ""}</span></div> : null)}
          </div>); })()}
        </div>
        <div className="ax-current">
          {single ? (
            <>
              <div className="k">Current value</div>
              <div className="v">{single.cur != null ? fmtFor(single.k, single.cur) : "-"}<small> {unitFor(single.k)}</small></div>
              <Delta v={single.delta} good={goodDir} />
              <div className="u">vs first session in range</div>
            </>
          ) : (
            <div className="ax-all">
              <div className="k">Latest per sport</div>
              {series.map((s) => <div key={s.k} className="row"><i style={{ background: COLORS[s.k] }} /><span>{s.k[0].toUpperCase() + s.k.slice(1)}</span><b>{s.cur != null ? `${fmtFor(s.k, s.cur)} ${unitFor(s.k)}` : "-"}</b><Delta v={s.delta} good={m === "pace" ? (s.k === "bike" ? "up" : "down") : m === "hr" ? "down" : "up"} /></div>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- 7. Body ----------
/** One body value over time: round y gridlines, dates spread evenly along the x axis. */
function BodyChart({ pts, fmt, w = 300, h = 110, ariaLabel }: { pts: { date: string; v: number }[]; fmt: (v: number) => string; w?: number; h?: number; ariaLabel: string }) {
  const [svgRef, W] = useWidth<SVGSVGElement>(w); const H = h, L = 40, R = 8, T = 10, B = 22;
  if (pts.length < 2) return <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}><text x={W / 2} y={H / 2} textAnchor="middle">{pts.length ? "One reading so far" : "No readings in this range"}</text></svg>;
  const vs = pts.map((p) => p.v);
  const nt = niceTicks(Math.min(...vs), Math.max(...vs), 3, "number");
  const t0 = fromYmd(pts[0].date).getTime(), t1 = Math.max(t0 + 1, fromYmd(pts[pts.length - 1].date).getTime());
  const x = (d: string) => L + ((fromYmd(d).getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + ((nt.hi - v) / Math.max(1e-9, nt.hi - nt.lo)) * (H - T - B);
  const labels = axisPicks(4, 4).map((i) => new Date(t0 + (i / 3) * (t1 - t0)));
  return (
    <svg ref={svgRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {nt.ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--grid)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>)}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={pts.map((p) => `${x(p.date)},${y(p.v)}`).join(" ")} />
      {pts.length <= 60 && pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.v)} r="2.5" fill="var(--accent)"><title>{`${dateLabel(p.date)}: ${fmt(p.v)}`}</title></circle>)}
      {labels.map((dd, i) => <text key={i} x={L + (i / 3) * (W - L - R)} y={H - 6} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"}>{shortDate(ymdOf(dd))}</text>)}
    </svg>
  );
}
export function Recovery() {
  const an = useAnalysis();
  const [range, setRange] = useState<"1m" | "3m" | "all">("1m");
  const days = range === "all" ? 3650 : range === "3m" ? 91 : 30;
  const bodySummary = an.bodySummary;
  const w = bodySummary(7), p = bodySummary(7, 7);
  const lastOf = (k: "rhr" | "hrv" | "sleep_h" | "stress") => [...an.BODY].reverse().find((b) => b[k] != null)?.date;
  const pct = (a: number | null, b: number | null) => (a != null && b ? ((a - b) / b) * 100 : null);
  const tile = (label: string, v: string | null, delta: number | null, good: "up" | "down", k: "rhr" | "hrv" | "sleep_h" | "stress", fmt: (x: number) => string) => {
    const pts = an.bodySeries(k, days);
    return (
      <div className="rt">
        <div className="k">{label}</div>
        <div className="v">{v ?? "-"}</div>
        {v != null ? <Delta v={delta} good={good} /> : null}
        <div className="u">{v != null ? "7-day average" : lastOf(k) ? `Last data ${dateLabel(lastOf(k) as string)}` : "No data yet"}</div>
        <BodyChart pts={pts} fmt={fmt} w={220} h={96} ariaLabel={`${label} over time`} />
      </div>
    );
  };
  return (
    <section className="card ax-panel" aria-label="Body">
      <div className="ax-head">
        <div><h2>Body</h2></div>
        <div className="pill-group" role="group" aria-label="Body time range">{(["1m", "3m", "all"] as const).map((r) => <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>{RANGE_LABEL[r]}</button>)}</div>
      </div>
      <div className="ax-recovery">
        <div className="tiles">
          {tile("Sleep", w.sleep != null ? `${Math.floor(w.sleep)} h ${Math.round((w.sleep % 1) * 60)} m` : null, pct(w.sleep, p.sleep), "up", "sleep_h", (x) => `${x.toFixed(1)} h`)}
          {tile("HRV", w.hrv != null ? `${w.hrv.toFixed(0)} ms` : null, pct(w.hrv, p.hrv), "up", "hrv", (x) => x.toFixed(0))}
          {tile("Resting HR", w.rhr != null ? `${w.rhr.toFixed(0)} bpm` : null, pct(w.rhr, p.rhr), "down", "rhr", (x) => x.toFixed(0))}
          {tile("Stress", w.stress != null ? w.stress.toFixed(0) : null, pct(w.stress, p.stress), "down", "stress", (x) => x.toFixed(0))}
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
      <div className="ax-head"><div><h2>Recent activities vs plan</h2></div><Link href="/activities" className="link">View all activities →</Link></div>
      <table className="tbl small ax-quality">
        <thead><tr><th>Date</th><th>Activity</th><th className="num">Planned</th><th className="num">Done</th><th className="num">Load</th><th title="Completed = same sport, at least 70 % of the planned time">Status</th><th>Facts</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.a.id} className="row" onClick={() => onPick(r.a.id)}>
              <td className="nowrap">{dateLabel(r.a.date)}</td>
              <td><span className="sess"><SportIcon sport={r.a.sport} size={18} />{r.a.name}</span></td>
              <td className="num">{r.planned ? `${r.planned.min} min` : "-"}</td>
              <td className="num">{fmtHMS(r.a.min)}</td>
              <td className="num">{r.load}</td>
              <td><span className={`qstatus ${r.level}`}>{r.status}</span></td>
              <td className="facts"><CoachNote text={r.insight} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------- 9. Race projection ----------
export function RaceReadiness() {
  const an = useAnalysis();
  const ATHLETE = an.athlete;
  const r = an.raceWindow();
  const D = ATHLETE.raceDist;
  const h = (x: number | null | undefined) => (x == null ? "-" : fmtHMS(x * 60));
  const swimLabel = localize(D.swimYd >= 1760 ? `${(D.swimYd / 1760).toFixed(1)} mi` : `${D.swimYd.toLocaleString()} yd`);
  const legLabel = (k: Sp) => (k === "swim" ? `Swim ${swimLabel}` : k === "bike" ? localize(`Bike ${D.bikeMi} mi`) : localize(`Run ${D.runMi} mi`));
  if (!ATHLETE.hasRace) {
    return (
      <section className="card ax-panel" aria-label="Race projection">
        <div className="ax-head"><div><h2>Race projection</h2><p>No race set.</p></div><Link href="/plan/new" className="link">Set a race in the plan builder →</Link></div>
      </section>
    );
  }
  const countdown = r.daysToRace == null ? "" : r.daysToRace > 1 ? `${r.daysToRace} days to go` : r.daysToRace === 1 ? "Tomorrow" : r.daysToRace === 0 ? "Race day" : "Raced";
  const wk = r.daysToRace != null && r.daysToRace > 13 ? `${Math.floor(r.daysToRace / 7)} weeks` : null;
  // the window bar: every leg's window and the goal on one time axis
  const spanLo = Math.min(...r.legs.map((l) => l.lo ?? Infinity), r.goalTotal ?? Infinity, r.total.lo ?? Infinity);
  const spanHi = Math.max(...r.legs.map((l) => l.hi ?? 0), r.goalTotal ?? 0, r.total.hi ?? 0);
  const trendWord = (t: number) => (Math.abs(t) < 0.005 ? "flat" : t < 0 ? `trending ${Math.abs(t * 100).toFixed(0)}% faster` : `trending ${(t * 100).toFixed(0)}% slower`);
  return (
    <section className="card ax-panel" aria-label="Race projection">
      <div className="ax-head">
        <div><h2>Race projection</h2>{r.ready ? null : <p>Shows from the Build phase, or when long sessions reach half the race distance</p>}</div>
        <div className="race-count"><b>{countdown}</b>{wk && <span className="muted">{wk}, {dateLabel(ATHLETE.race.date)}</span>}<span className="badge">{ATHLETE.race.name}</span></div>
      </div>
      {!r.ready ? (
        <div className="ax-race">
          {r.legs.map((l) => <div key={l.k} className="leg"><SportIcon sport={l.k} size={22} /><div><div className="k">{legLabel(l.k)}</div><div className="v">{l.durability != null ? `${Math.round(l.durability * 100)}%` : "-"}</div><div className="u">longest session of the race distance</div></div></div>)}
        </div>
      ) : (
        <>
          <div className="ax-race">
            {r.legs.map((l) => <div key={l.k} className="leg"><SportIcon sport={l.k} size={22} /><div><div className="k">{legLabel(l.k)}</div><div className="v">{h(l.lo)}<small> to </small>{h(l.hi)}</div><div className="u">{trendWord(l.trend)}, 8 weeks</div></div></div>)}
            <div className="leg total"><div><div className="k">Finish window</div><div className="v">{h(r.total.lo)}<small> to </small>{h(r.total.hi)}</div>{r.transitions > 0 && <div className="u">incl. {h(r.transitions)} transitions</div>}</div></div>
            {r.goalTotal != null && r.total.mid != null && <div className="leg"><div><div className="k">Goal</div><div className="v">{h(r.goalTotal)}</div><div className="u">{r.goalTotal >= (r.total.lo ?? 0) && r.goalTotal <= (r.total.hi ?? 0) ? "inside the window" : r.goalTotal < (r.total.lo ?? 0) ? `${Math.round(((r.total.lo ?? 0) - r.goalTotal) * 60)} min faster than the window` : `${Math.round((r.goalTotal - (r.total.hi ?? 0)) * 60)} min inside the window`}</div></div></div>}
          </div>
          {isFinite(spanLo) && spanHi > spanLo && (
            <div className="race-bar" aria-hidden="true">
              {r.total.lo != null && r.total.hi != null && <div className="win" style={{ left: `${((r.total.lo - spanLo) / (spanHi - spanLo)) * 100}%`, width: `${((r.total.hi - r.total.lo) / (spanHi - spanLo)) * 100}%` }}><span>{h(r.total.lo)}</span><span>{h(r.total.hi)}</span></div>}
              {r.goalTotal != null && <div className="goal" style={{ left: `${((r.goalTotal - spanLo) / (spanHi - spanLo)) * 100}%` }}><i /><span>goal {h(r.goalTotal)}</span></div>}
            </div>
          )}
          <div className="race-facts">
            {r.legs.map((l) => <div key={l.k}><SportIcon sport={l.k} size={16} /><span>{l.near ? `${l.near.n} of ${l.near.of} sessions in 4 weeks near goal pace` : "no goal pace set"}</span><span className="muted">longest {l.durability != null ? `${Math.round(l.durability * 100)}%` : "-"} of race distance</span></div>)}
          </div>
        </>
      )}
    </section>
  );
}

// ---------- 10. Observations ----------
export function Observations() {
  const an = useAnalysis();
  const o = an.observations();
  return (
    <section className="card ax-panel" aria-label="Sunday review facts">
      <div className="ax-head"><div><h2>Sunday review<span className="at">facts</span></h2></div></div>
      <div className="ax-obs">{o.map((x, i) => <div key={x.title} className="ob"><span className="n">{i + 1}</span><div><b>{x.title}</b><p><CoachNote text={x.text} /></p></div></div>)}</div>
    </section>
  );
}
