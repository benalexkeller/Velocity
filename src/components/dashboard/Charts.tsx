"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTIVITIES, actualByDiscipline, currentWeek, plannedByDiscipline, type Activity } from "@/lib/data";
import { fmtPace, fromYmd, shortDate, today, addDays, fmtHours } from "@/lib/format";
import { runPace, swimPace } from "@/lib/units";

type Sp = "swim" | "bike" | "run";
function paceOf(a: Activity, sp: Sp): number | null {
  if (sp === "run") return a.pace_s ? runPace(a.pace_s).s : null;
  if (sp === "swim") return a.p100_s ? swimPace(a.p100_s).s : null;
  return a.mph ?? null;
}
const UNIT: Record<Sp, string> = { run: `min${runPace(0).u}`, swim: `min${swimPace(0).u}`, bike: "mph" };

export function PaceChart() {
  const router = useRouter();
  const [sp, setSp] = useState<Sp>("run");
  const since = addDays(today(), -56);
  const pts = ACTIVITIES.filter((a) => a.sport === sp && fromYmd(a.date) >= since).map((a) => ({ date: a.date, v: paceOf(a, sp), min: a.min })).filter((p): p is { date: string; v: number; min: number } => p.v != null);
  const inv = sp !== "bike"; // pace: faster (lower seconds) plotted higher, like the mock
  const W = 420, H = 190, L = 44, R = 10, T = 12, B = 26;
  let lo = pts.length ? Math.min(...pts.map((p) => p.v)) : 0, hi = pts.length ? Math.max(...pts.map((p) => p.v)) : 1;
  const pad = (hi - lo) * 0.25 || (sp === "bike" ? 2 : 30);
  lo -= pad; hi += pad;
  const x = (i: number) => L + (pts.length < 2 ? (W - L - R) / 2 : (i / (pts.length - 1)) * (W - L - R));
  const y = (v: number) => (inv ? T + ((v - lo) / (hi - lo)) * (H - T - B) : H - B - ((v - lo) / (hi - lo)) * (H - T - B));
  const ticks = 4;
  const fmt = (v: number) => (sp === "bike" ? v.toFixed(1) : fmtPace(v));
  const wk = currentWeek();
  const thisWeek = pts.filter((p) => fromYmd(p.date) >= fromYmd(wk.start));
  const wavg = (arr: typeof pts) => (arr.length ? arr.reduce((s, p) => s + p.v * p.min, 0) / arr.reduce((s, p) => s + p.min, 0) : null);
  const last4 = pts.filter((p) => fromYmd(p.date) >= addDays(today(), -28));
  const tw = wavg(thisWeek), m4 = wavg(last4);
  const best = last4.length ? (sp === "bike" ? Math.max(...last4.map((p) => p.v)) : Math.min(...last4.map((p) => p.v))) : null;

  return (
    <div className="card chartcard linked" role="link" tabIndex={0} onClick={() => router.push("/analysis")} onKeyDown={(e) => { if (e.key === "Enter") router.push("/analysis"); }} aria-label="Average pace — open analysis">
      <div className="head">
        <span className="eyebrow">Average pace</span>
        <div className="pill-group" onClick={(e) => e.stopPropagation()}>
          {(["swim", "bike", "run"] as Sp[]).map((k) => <button key={k} type="button" className={sp === k ? "on" : ""} onClick={() => setSp(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}
        </div>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>{UNIT[sp]}</div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sp} pace over the last eight weeks`}>
          {Array.from({ length: ticks + 1 }, (_, k) => lo + ((hi - lo) * k) / ticks).map((v, k) => (
            <g key={k}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
            </g>
          ))}
          <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--line)" />
          {pts.length > 1 && <path d={pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.v)}`).join("")} fill="none" stroke="var(--accent)" strokeWidth={2} />}
          {pts.map((p, i) => <circle key={p.date + i} cx={x(i)} cy={y(p.v)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />)}
          {pts.map((p, i) => (i === 0 || i === pts.length - 1 || i % Math.max(1, Math.ceil(pts.length / 4)) === 0) && <text key={"l" + i} x={x(i)} y={H - 8} textAnchor="middle">{shortDate(p.date)}</text>)}
          {!pts.length && <text x={W / 2} y={H / 2} textAnchor="middle">No {sp} activities yet</text>}
        </svg>
      </div>
      <div className="side">
        <div><div className="k">This week</div><div className="v">{tw != null ? fmt(tw) : "—"}</div><div className="u">{UNIT[sp]}</div></div>
        <div><div className="k">Best · 4 weeks</div><div className="v">{best != null ? fmt(best) : "—"}</div><div className="u">{UNIT[sp]} · {last4.length} sessions</div></div>
        <div><div className="k">4-week avg</div><div className="v">{m4 != null ? fmt(m4) : "—"}</div><div className="u">{UNIT[sp]}</div></div>
      </div>
    </div>
  );
}

export function VolumeChart() {
  const router = useRouter();
  const wk = currentWeek();
  const a = actualByDiscipline(wk), p = plannedByDiscipline(wk);
  const rows = [["Swim", a.swim, p.swim], ["Bike", a.bike, p.bike], ["Run", a.run, p.run]] as const;
  const W = 420, H = 190, L = 34, R = 10, T = 12, B = 26;
  const max = Math.max(2, Math.ceil(Math.max(...rows.flatMap((r) => [r[1], r[2]])) / 2) * 2);
  const y = (h: number) => H - B - (h / max) * (H - T - B);
  const gw = (W - L - R) / 3, bw = 40;
  const totalA = a.swim + a.bike + a.run + a.other, totalP = wk.plannedMin / 60;
  return (
    <div className="card chartcard linked" role="link" tabIndex={0} onClick={() => router.push("/analysis")} onKeyDown={(e) => { if (e.key === "Enter") router.push("/analysis"); }} aria-label="Weekly volume — open analysis">
      <div className="head">
        <span className="eyebrow">Weekly volume vs plan</span>
        <span className="lgd"><span><i style={{ background: "var(--accent)" }} />Actual</span><span><i className="hollow" />Planned</span></span>
      </div>
      <div>
        <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>Hours</div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="This week's hours by discipline, actual versus planned">
          {Array.from({ length: max / 2 + 1 }, (_, k) => k * 2).map((h) => (
            <g key={h}><line x1={L} y1={y(h)} x2={W - R} y2={y(h)} stroke="var(--grid)" /><text x={L - 8} y={y(h) + 4} textAnchor="end">{h}</text></g>
          ))}
          <line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--line)" />
          {rows.map(([k, av, pv], i) => {
            const cx = L + i * gw + gw / 2;
            return (
              <g key={k}>
                <rect x={cx - bw - 2} y={y(av)} width={bw} height={y(0) - y(av)} fill="var(--accent)" rx={2} />
                <rect x={cx + 2} y={y(pv)} width={bw} height={y(0) - y(pv)} fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity={0.5} rx={2} />
                <text x={cx} y={H - 8} textAnchor="middle">{k}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="side">
        <div><div className="k">This week</div><div className="v">{fmtHours(totalA)}</div><div className="u">of {fmtHours(totalP, 0)} plan</div></div>
        <div className="rows">
          {rows.map(([k, av, pv]) => (
            <div key={k} className="drow">
              <div className="l"><span>{k}</span><b>{fmtHours(av)}</b></div>
              <div className="progress"><i style={{ width: `${pv ? Math.min(100, (av / pv) * 100) : 0}%` }} /></div>
              <div className="u">of {fmtHours(pv)} planned</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
