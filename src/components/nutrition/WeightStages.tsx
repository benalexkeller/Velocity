"use client";
// Staged weight targets on top of the training timeline: the chart (planned hours per week + the weight path)
// is shared by the set-up form (editable stages) and the Guide tab (with logged weights and the projection).
import { useMemo, useState } from "react";
import { usePlan, type PlanStore } from "@/lib/store";
import type { WeightStage } from "@/lib/nutrition/types";
import { addDays, fromYmd, shortDate, today, ymd } from "@/lib/format";

const DAY = 86400000;
const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const kgToLb = (kg: number) => kg * 2.20462, lbToKg = (lb: number) => lb / 2.20462;
const byDate = (a: WeightStage, b: WeightStage) => a.date.localeCompare(b.date);

export interface TimelineWeek { week: number; start: string; hours: number; phase: string; race: boolean }
export interface WPoint { date: string; kg: number; label: string; kind: "now" | "stage" | "race" }

/** One column per training week: planned hours from the plan, or empty weeks from this Monday to race day when there is no plan yet. */
export function timelineOf(plan: PlanStore, raceDate: string | null): TimelineWeek[] {
  if (plan.hasPlan) return plan.weeks.map((w) => ({ week: w.week, start: w.start, hours: Math.max(0, w.plannedMin) / 60, phase: w.phaseShort, race: w.race }));
  const t = today();
  const mon = addDays(t, -((t.getDay() + 6) % 7));
  const end = raceDate ? fromYmd(raceDate) : addDays(mon, 83);
  const n = Math.min(60, Math.max(4, Math.floor((end.getTime() - mon.getTime()) / (7 * DAY)) + 1));
  return Array.from({ length: n }, (_, i) => {
    const s = addDays(mon, i * 7), e = addDays(s, 6);
    const w = plan.weekOf(s);
    return { week: i + 1, start: ymd(s), hours: Math.max(0, w?.plannedMin ?? 0) / 60, phase: "", race: !!raceDate && fromYmd(raceDate) >= s && fromYmd(raceDate) <= e };
  });
}

/** Index of the timeline week that holds a date (clamped to the ends). */
export function weekIndexOf(tl: TimelineWeek[], date: string) {
  const ms = fromYmd(date).getTime();
  const i = tl.findIndex((w) => { const s = fromYmd(w.start).getTime(); return ms >= s && ms < s + 7 * DAY; });
  if (i >= 0) return i;
  return ms < fromYmd(tl[0].start).getTime() ? 0 : tl.length - 1;
}

/** Weekly rate between two points, kg per week (negative = losing). */
export function ratePerWeek(a: { date: string; kg: number }, b: { date: string; kg: number }) {
  const weeks = Math.max(0.25, (fromYmd(b.date).getTime() - fromYmd(a.date).getTime()) / (7 * DAY));
  return (b.kg - a.kg) / weeks;
}

// ---------- chart ----------
export function WeightChart({ timeline, path, logged = [], proj = null, imperial, raceDate, height = 230 }: {
  timeline: TimelineWeek[]; path: WPoint[]; logged?: { date: string; kg: number }[]; proj?: { from: { date: string; kg: number }; to: { date: string; kg: number } } | null;
  imperial: boolean; raceDate: string | null; height?: number;
}) {
  const showW = (kg: number) => (imperial ? `${fmt(kgToLb(kg), 1)} lb` : `${fmt(kg, 1)} kg`);
  const W = 720, H = height, L = 36, R = 54, T = 36, B = 22;
  const plotW = W - L - R, plotH = H - T - B;
  const sorted = [...path].sort((a, b) => a.date.localeCompare(b.date));
  const tNow = ymd(today());
  const ms = (d: string) => fromYmd(d).getTime();
  const starts = [...timeline.map((w) => ms(w.start)), ...sorted.map((p) => ms(p.date)), ...logged.map((l) => ms(l.date)), ms(tNow)];
  const ends = [...timeline.map((w) => ms(w.start) + 7 * DAY), ...sorted.map((p) => ms(p.date) + DAY), ...logged.map((l) => ms(l.date) + DAY), ...(raceDate ? [ms(raceDate) + DAY] : []), ms(tNow) + DAY];
  const startMs = Math.min(...starts), endMs = Math.max(...ends);
  const x = (t: number) => L + ((t - startMs) / Math.max(DAY, endMs - startMs)) * plotW;
  const kgs = [...sorted.map((p) => p.kg), ...logged.map((l) => l.kg), ...(proj ? [proj.from.kg, proj.to.kg] : [])];
  const lo = (kgs.length ? Math.min(...kgs) : 70) - 1.5, hi = (kgs.length ? Math.max(...kgs) : 80) + 1.5;
  const yW = (kg: number) => T + ((hi - kg) / (hi - lo)) * plotH * 0.6;
  const maxH = Math.max(1, ...timeline.map((w) => w.hours));
  const yH = (h: number) => H - B - (h / maxH) * plotH * 0.48;
  // phase bands across the top
  const bands: { phase: string; from: number; to: number }[] = [];
  for (const w of timeline) { const last = bands[bands.length - 1]; if (w.phase && last && last.phase === w.phase) last.to = ms(w.start) + 7 * DAY; else if (w.phase) bands.push({ phase: w.phase, from: ms(w.start), to: ms(w.start) + 7 * DAY }); }
  const step = Math.max(1, Math.ceil(timeline.length / 8));
  const stroke = (p: WPoint) => (p.kind === "stage" ? "var(--surface)" : "var(--accent)");
  return (
    <svg className="chart nu-wchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Planned training hours per week with the weight path">
      {bands.map((b) => <g key={b.phase + b.from}><line x1={x(b.from) + 2} y1={15} x2={x(b.to) - 2} y2={15} stroke="var(--line)" strokeWidth={2}><title>{b.phase}</title></line>{x(b.to) - x(b.from) >= b.phase.length * 6.2 + 4 && <text x={(x(b.from) + x(b.to)) / 2} y={10} textAnchor="middle" fontSize={10.5}>{b.phase}</text>}</g>)}
      {timeline.map((w) => { const x0 = x(ms(w.start)), x1 = x(ms(w.start) + 7 * DAY); return <rect key={w.start} x={x0 + 1} y={yH(w.hours)} width={Math.max(1, x1 - x0 - 2)} height={H - B - yH(w.hours)} rx={2} fill={w.race ? "var(--accent-soft)" : "var(--track)"}><title>{`Week ${w.week} · ${shortDate(w.start)} · ${fmt(w.hours, 1)} h planned`}</title></rect>; })}
      {timeline.map((w, i) => (i % step === 0 ? <text key={"t" + w.start} x={(x(ms(w.start)) + x(ms(w.start) + 7 * DAY)) / 2} y={H - 6} textAnchor="middle">W{w.week}</text> : null))}
      {[maxH, maxH / 2].map((h) => <text key={h} x={L - 4} y={yH(h) + 4} textAnchor="end">{fmt(h, 0)} h</text>)}
      {kgs.length > 0 && [hi - 1.5, (hi + lo) / 2, lo + 1.5].map((v) => <text key={v} x={W - R + 6} y={yW(v) + 4} textAnchor="start">{imperial ? fmt(kgToLb(v), 0) : fmt(v, 1)}</text>)}
      <line x1={x(ms(tNow))} y1={T - 4} x2={x(ms(tNow))} y2={H - B} stroke="var(--muted-2)" strokeDasharray="2 3" />
      <text x={x(ms(tNow)) + 4} y={T - 7} textAnchor="start" fontSize={10.5}>Today</text>
      {raceDate && <><line x1={x(ms(raceDate))} y1={T - 4} x2={x(ms(raceDate))} y2={H - B} stroke="var(--accent)" strokeDasharray="2 3" /><text x={x(ms(raceDate)) - 4} y={T - 7} textAnchor="end" fontSize={10.5} fill="var(--accent)">Race</text></>}
      {sorted.length > 1 && <path d={sorted.map((p, i) => `${i ? "L" : "M"}${x(ms(p.date))} ${yW(p.kg)}`).join("")} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />}
      {logged.length > 1 && <path d={logged.map((l, i) => `${i ? "L" : "M"}${x(ms(l.date))} ${yW(l.kg)}`).join("")} fill="none" stroke="var(--run)" strokeWidth={2} />}
      {logged.map((l) => <circle key={l.date} cx={x(ms(l.date))} cy={yW(l.kg)} r={3} fill="var(--run)"><title>{`${shortDate(l.date)} · ${showW(l.kg)} logged`}</title></circle>)}
      {proj && <line x1={x(ms(proj.from.date))} y1={yW(proj.from.kg)} x2={x(ms(proj.to.date))} y2={yW(proj.to.kg)} stroke="var(--muted-2)" strokeDasharray="3 4" strokeWidth={1.5} />}
      {sorted.map((p) => <g key={p.kind + p.date}><circle cx={x(ms(p.date))} cy={yW(p.kg)} r={p.kind === "stage" ? 5 : 4.5} fill={stroke(p)} stroke="var(--accent)" strokeWidth={2}><title>{`${p.label || "Stage"} · ${shortDate(p.date)} · ${showW(p.kg)}`}</title></circle><text x={x(ms(p.date))} y={yW(p.kg) - 10} textAnchor={x(ms(p.date)) > W - R - 34 ? "end" : x(ms(p.date)) < L + 34 ? "start" : "middle"} fontSize={11} fontWeight={600} fill="var(--ink)">{showW(p.kg)}</text></g>)}
      {!timeline.length && !sorted.length && <text x={W / 2} y={H / 2} textAnchor="middle">No plan and no target yet</text>}
    </svg>
  );
}

// ---------- editor (set-up form) ----------
export function StageEditor({ stages, onChange, nowKg, raceKg, imperial, raceDate }: {
  stages: WeightStage[]; onChange: (s: WeightStage[]) => void; nowKg: number | null; raceKg: number | null; imperial: boolean; raceDate: string | null;
}) {
  const plan = usePlan();
  const tl = useMemo(() => timelineOf(plan, raceDate), [plan, raceDate]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const n = tl.length;
  const unit = imperial ? "lb" : "kg";
  const showW = (kg: number) => (imperial ? `${fmt(kgToLb(kg), 1)} lb` : `${fmt(kg, 1)} kg`);
  const disp = (kg: number) => fmt(imperial ? kgToLb(kg) : kg, 1);
  const tNow = ymd(today());
  const todayIdx = weekIndexOf(tl, tNow);
  const raceIdx = raceDate ? (fromYmd(raceDate).getTime() >= fromYmd(tl[n - 1].start).getTime() + 7 * DAY ? n : weekIndexOf(tl, raceDate)) : n;
  const minIdx = Math.min(n - 1, todayIdx + 1), maxIdx = Math.max(minIdx, raceIdx - 1);
  const ordered = stages.map((s, i) => ({ s, i })).sort((a, b) => byDate(a.s, b.s));
  const nowPt = nowKg ? { date: tNow, kg: nowKg } : null;
  const prevOf = (i: number) => { const k = ordered.findIndex((o) => o.i === i); return k > 0 ? { date: ordered[k - 1].s.date, kg: ordered[k - 1].s.weight_kg } : nowPt; };
  const rateText = (from: { date: string; kg: number } | null, to: { date: string; kg: number }) => { if (!from) return ""; const r = ratePerWeek(from, to); const v = imperial ? kgToLb(r) : r; return `${v > 0 ? "+" : ""}${fmt(v, 2)} ${unit}/week${r < -1 ? " · over 1 kg a week" : ""}`; };
  const set = (i: number, patch: Partial<WeightStage>) => onChange(stages.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const add = () => {
    const last = ordered.length ? ordered[ordered.length - 1].s : null;
    const fromIdx = last ? weekIndexOf(tl, last.date) : todayIdx;
    const idx = Math.min(maxIdx, Math.max(minIdx, Math.round((fromIdx + raceIdx) / 2)));
    const fromKg = last?.weight_kg ?? nowKg ?? raceKg ?? 75, toKg = raceKg ?? fromKg;
    onChange([...stages, { date: tl[idx].start, weight_kg: +((fromKg + toKg) / 2).toFixed(2), label: tl[idx].phase }]);
    setDrafts({});
  };
  const remove = (i: number) => { onChange(stages.filter((_, j) => j !== i)); setDrafts({}); };
  const path: WPoint[] = [...(nowPt ? [{ ...nowPt, label: "Now", kind: "now" as const }] : []), ...stages.filter((s) => s.weight_kg > 0).map((s) => ({ date: s.date, kg: s.weight_kg, label: s.label || "Stage", kind: "stage" as const })), ...(raceKg && raceDate ? [{ date: raceDate, kg: raceKg, label: "Race day", kind: "race" as const }] : [])];
  const racePt = raceKg && raceDate ? { date: raceDate, kg: raceKg } : null;
  const lastPt = ordered.length ? { date: ordered[ordered.length - 1].s.date, kg: ordered[ordered.length - 1].s.weight_kg } : nowPt;

  return (
    <div className="nu-stages">
      <div className="row fixed"><span className="who">Now</span><input type="range" min={0} max={Math.max(0, n - 1)} value={todayIdx} disabled aria-hidden /><span className="when">Week {tl[todayIdx].week} · {shortDate(tNow)}</span><span className="w">{nowKg ? showW(nowKg) : "enter your weight above"}</span><span className="rate" /><span /></div>
      {stages.map((s, i) => {
        const idx = weekIndexOf(tl, s.date), w = tl[idx];
        return (
          <div className="row" key={i}>
            <span className="who">Stage {ordered.findIndex((o) => o.i === i) + 1}</span>
            <input type="range" min={minIdx} max={maxIdx} value={Math.min(maxIdx, Math.max(minIdx, idx))} onChange={(e) => { const k = +e.target.value; set(i, { date: tl[k].start, label: tl[k].phase }); }} aria-label={`Week for stage ${i + 1}`} />
            <span className="when">Week {w.week} · {shortDate(w.start)}{w.phase ? ` · ${w.phase}` : ""}</span>
            <span className="unit-in small"><input value={drafts[i] ?? (s.weight_kg ? disp(s.weight_kg) : "")} onChange={(e) => { setDrafts((d) => ({ ...d, [i]: e.target.value })); const v = parseFloat(e.target.value); set(i, { weight_kg: v > 0 ? +(imperial ? lbToKg(v) : v).toFixed(2) : 0 }); }} onBlur={() => setDrafts((d) => { const c = { ...d }; delete c[i]; return c; })} inputMode="decimal" aria-label={`Target weight for stage ${i + 1}`} /><span className="units"><span>{unit}</span></span></span>
            <span className="rate">{s.weight_kg > 0 ? rateText(prevOf(i), { date: s.date, kg: s.weight_kg }) : ""}</span>
            <button type="button" className="x" onClick={() => remove(i)} aria-label="Remove stage">×</button>
          </div>
        );
      })}
      {raceDate && <div className="row fixed"><span className="who">Race day</span><input type="range" min={0} max={Math.max(0, n - 1)} value={Math.min(n - 1, raceIdx)} disabled aria-hidden /><span className="when">{shortDate(raceDate)}</span><span className="w">{racePt ? showW(racePt.kg) : "set the target weight above"}</span><span className="rate">{racePt ? rateText(lastPt, racePt) : ""}</span><span /></div>}
      <div className="acts"><button type="button" className="add" onClick={add}>+ Add a stage</button><span className="hint">Drag a slider to pick the week, type the weight you want to be at by then. Calories aim at the next stage, not race day.</span></div>
      <WeightChart timeline={tl} path={path} imperial={imperial} raceDate={raceDate} height={210} />
    </div>
  );
}
