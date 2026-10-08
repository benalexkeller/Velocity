"use client";
import { niceTicks, useWidth } from "@/lib/ticks";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { RouteMap } from "../RouteMap";
import { LogActivity } from "../dashboard/LogActivity";
import { FuelBlock } from "../nutrition/SessionFuel";
import { useNutrition } from "@/lib/nutrition/store";
import { STATUS_LABEL, activityLoad, plannedLoad, type Session, type Sport } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { dateLabel, fmtDur, fmtHMS, fmtPace, today, ymd } from "@/lib/format";
import { elev, fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";
import { hardestStep, workoutFor, zoneName, type Segment, type Zone } from "@/lib/workout";

const INTENSITIES = ["Zone 2", "Aerobic", "Technique", "Endurance", "Tempo", "Threshold", "Intervals", "Race"];
const SPORTS: Sport[] = ["swim", "bike", "run", "brick", "strength", "hike", "other", "rest"];

// Move: pick a new day and start time. Saves to the local store.
function MoveForm({ s, onDone }: { s: Session; onDone: () => void }) {
  const plan = usePlan();
  const [date, setDate] = useState(s.date);
  const [start, setStart] = useState(s.start ?? "06:30");
  const r = plan.planRange;
  const outside = !!r && (date < r.start || date > r.end);
  return (
    <form className="sp-form" onSubmit={(e) => { e.preventDefault(); if (outside) return; plan.moveSession(s.id, { date, start }); onDone(); }}>
      <label>Day<input type="date" value={date} min={r?.start} max={r?.end} onChange={(e) => setDate(e.target.value)} />{outside && r && <small className="err">Outside the plan · {dateLabel(r.start)} – {dateLabel(r.end)}</small>}</label>
      <label>Start<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <div className="row"><button type="submit" className="btn" disabled={outside}>Move session</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
    </form>
  );
}
// Edit: sport, duration, intensity, description. Delete removes it from the plan.
function EditForm({ s, onDone }: { s: Session; onDone: () => void }) {
  const plan = usePlan();
  const [sport, setSport] = useState<Sport>(s.sport);
  const [min, setMin] = useState(String(s.min));
  const [intensity, setIntensity] = useState(s.intensity);
  const [text, setText] = useState(s.text);
  return (
    <form className="sp-form" onSubmit={(e) => { e.preventDefault(); plan.editSession(s.id, { sport, min: Math.max(0, parseInt(min) || 0), intensity, text }); onDone(); }}>
      <div className="two">
        <label>Sport<select value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
        <label>Duration (min)<input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" /></label>
      </div>
      <label>Intensity<select value={intensity} onChange={(e) => setIntensity(e.target.value)}>{INTENSITIES.map((k) => <option key={k}>{k}</option>)}</select></label>
      <label>Session description<input value={text} onChange={(e) => setText(e.target.value)} /></label>
      <div className="row"><button type="submit" className="btn">Save changes</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button><span className="grow" /><button type="button" className="btn ghost danger" onClick={() => { if (confirm("Remove this session from the plan?")) { plan.deleteSession(s.id); onDone(); } }}>Delete</button></div>
    </form>
  );
}

// The target in the stats column is the target of the hardest work in the steps, so the two always match.
function targetOf(s: Session, seg: Segment | undefined, zones: Record<string, Record<string, string>>) {
  let v = seg?.target, sp = s.sport === "brick" ? "bike" : s.sport;
  if (seg && /\/mi$/.test(seg.target)) sp = "run"; else if (seg && /\/100 yd$/.test(seg.target)) sp = "swim"; else if (seg && /mph|W$/.test(seg.target)) sp = "bike";
  if (!v || !/\d/.test(v)) v = zones[sp]?.[s.intensity];
  if (!v) return null;
  v = v.replace(/\s*\/(mi|100 yd)$/, "");
  return { k: sp === "bike" ? (/W$/.test(v) ? "Target power" : "Target speed") : "Target pace", v, u: sp === "bike" ? "" : sp === "swim" ? "per 100 yd" : "per mile" };
}

// one zone palette for the whole app (tokens in globals.css)
export const ZONE_FILL: Record<Zone, string> = { 1: "var(--z1)", 2: "var(--z2)", 3: "var(--z3)", 4: "var(--z4)", 5: "var(--z5)" };

// Interval chart: time on the x axis, effort zone on the y axis. Repeats are drawn as one labelled set; pace labels
// only appear where they fit. Under the axis, a fuel lane shows what to take before, when to feed during, and after.
type Fuel = { before: number; beforeAt: string; perHour: number; fluidLh: number; after: { carbs: number; protein: number }; window: string } | null;
const textW = (t: string, px = 12) => t.length * px * 0.56 + 6; // rough width of Inter text, enough to avoid collisions
function IntervalChart({ segments, fuel }: { segments: Segment[]; fuel: Fuel }) {
  const total = segments.reduce((s, x) => s + x.min, 0) || 1;
  const feeds: number[] = [];
  if (fuel && fuel.perHour > 0) for (let m = 20; m <= total - 10; m += 20) feeds.push(m);
  const showFuel = !!fuel && (fuel.before > 0 || feeds.length > 0 || fuel.after.carbs > 0);
  const [svgRef, W] = useWidth<SVGSVGElement>(900);
  const H = showFuel ? 214 : 170, L = 40, R = 12, T = 28, B = showFuel ? 72 : 28;
  const x = (m: number) => L + (m / total) * (W - L - R);
  const y = (z: number) => T + ((5 - z) / 5) * (H - T - B);
  const tick = [5, 10, 15, 20, 30, 60, 90, 120].find((t) => (t / total) * (W - L - R) >= 64) ?? 120;
  const ticks: number[] = []; for (let m = 0; m <= total; m += tick) ticks.push(m);
  // group repeats: a set starts at a work segment; "Rep n" segments and recoveries join it
  const groups: { label: string; target: string; from: number; to: number; segs: { s: Segment; at: number }[] }[] = [];
  let acc = 0;
  for (const sg of segments) {
    const isRep = /^Rep \d+$/.test(sg.label) || sg.kind === "recovery";
    if (!isRep || !groups.length) groups.push({ label: sg.label, target: sg.target.replace(/ ?\/(mi|100 yd)$/, ""), from: acc, to: acc + sg.min, segs: [] });
    const g = groups[groups.length - 1];
    g.segs.push({ s: sg, at: acc }); g.to = acc + sg.min; acc += sg.min;
  }
  const laneY = H - B + 46;
  const perFeed = fuel && feeds.length ? Math.round((fuel.perHour * 20) / 60) : 0;
  // long labels when they fit side by side, short ones ("60 g" / "90 g + 30 g") on narrow screens
  const longB = fuel && fuel.before ? `${fuel.before} g before` : "";
  const longA = fuel ? (fuel.after.carbs ? `${fuel.after.carbs} g carbs + ${fuel.after.protein} g protein after` : `${fuel.after.protein} g protein after`) : "";
  const roomy = textW(longB) + textW(longA) + 40 < x(total) - x(0);
  const beforeText = roomy ? longB : fuel && fuel.before ? `${fuel.before} g` : "";
  const afterText = roomy ? longA : fuel ? (fuel.after.carbs ? `${fuel.after.carbs} g + ${fuel.after.protein} g` : `${fuel.after.protein} g`) : "";
  const beforeSub = fuel ? (roomy ? `by ${fuel.beforeAt}` : `before, by ${fuel.beforeAt}`) : "";
  const afterSub = fuel ? (roomy ? fuel.window : `after · ${fuel.window}`) : "";
  const beforeEnd = x(0) + 10 + (beforeText ? textW(beforeText) : 0), afterStart = x(total) - 10 - textW(afterText);
  return (
    <svg ref={svgRef} className="chart sp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Session structure: time, target effort and fuel">
      {[1, 2, 3, 4, 5].map((z) => <g key={z}><line x1={L} y1={y(z)} x2={W - R} y2={y(z)} stroke="var(--grid)" /><text x={L - 8} y={y(z) + 4} textAnchor="end">Z{z}</text></g>)}
      {groups.map((g, gi) => {
        const x0 = x(g.from), x1 = x(g.to), span = x1 - x0;
        const work = g.segs.filter((q) => q.s.kind !== "recovery");
        const isSet = work.length > 1;
        const top = Math.min(...g.segs.map((q) => y(q.s.zone)));
        const title = isSet ? `${g.label} · ${g.target}` : g.segs[0].s.kind === "recovery" ? "" : g.label;
        const titleFits = title && textW(title) <= span + 8;
        return (
          <g key={gi}>
            {g.segs.map((q, i) => {
              const a0 = x(q.at), a1 = x(q.at + q.s.min);
              const paceFits = !isSet && q.s.kind !== "recovery" && textW(g.target) <= a1 - a0 - 6;
              return (
                <g key={i}>
                  <rect x={a0 + 0.5} y={y(q.s.zone)} width={Math.max(1, a1 - a0 - 1)} height={y(0) - y(q.s.zone)} fill={ZONE_FILL[q.s.zone]} rx={2} />
                  {paceFits && <text x={(a0 + a1) / 2} y={y(0) - 8} textAnchor="middle" style={{ fill: q.s.zone >= 3 ? "#fff" : "var(--ink-2)" }}>{g.target}</text>}
                </g>
              );
            })}
            {isSet && <path d={`M${x0 + 1} ${top - 6}v-4H${x1 - 1}v4`} fill="none" stroke="var(--muted)" />}
            {titleFits && <text x={(x0 + x1) / 2} y={top - (isSet ? 14 : 8)} textAnchor="middle" className="ink" fontWeight="600">{title}</text>}
          </g>
        );
      })}
      <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke="var(--line)" />
      {ticks.map((m) => <text key={m} x={x(m)} y={y(0) + 18} textAnchor={m === 0 ? "start" : m >= total - tick / 2 ? "end" : "middle"}>{total >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : `${m} min`}</text>)}
      {showFuel && fuel && (
        <g aria-label="Fuel">
          <text x={L - 8} y={laneY + 4} textAnchor="end" className="ink" fontWeight="600">Fuel</text>
          <line x1={x(0)} y1={laneY} x2={x(total)} y2={laneY} stroke="var(--line)" strokeDasharray="2 3" />
          {beforeText && <g><circle cx={x(0)} cy={laneY} r={4} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5} /><text x={x(0) + 10} y={laneY - 8}>{beforeText}</text><text x={x(0) + 10} y={laneY + 18}>{beforeSub}</text></g>}
          {feeds.map((m) => {
            const cx = x(m), label = textW(`${perFeed} g`);
            const show = cx - label / 2 > beforeEnd && cx + label / 2 < afterStart;
            return <g key={m}><circle cx={cx} cy={laneY} r={4} fill="var(--accent)" />{show && <text x={cx} y={laneY - 8} textAnchor="middle">{perFeed} g</text>}</g>;
          })}
          {afterText && <g><circle cx={x(total)} cy={laneY} r={4} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5} /><text x={x(total) - 10} y={laneY - 8} textAnchor="end">{afterText}</text><text x={x(total) - 10} y={laneY + 18} textAnchor="end">{afterSub}</text></g>}
        </g>
      )}
    </svg>
  );
}

// Large session view on the Plan page, under the calendar. Clicking any block swaps the session in.
export function SessionPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const plan = usePlan();
  const nut = useNutrition();
  const [mode, setMode] = useState<"view" | "log" | "move" | "edit">("view");
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);
  const hit = plan.findSession(id);
  if (!hit) return null;
  const { s, w } = hit;
  const acts = plan.activitiesOn(s.date);
  const wk = workoutFor(s, plan.athlete.zones);
  const fuel = nut.ready && nut.hasWeight && s.sport !== "rest" ? nut.fuelFor(s) : null;
  const status = STATUS_LABEL[s.status];
  // the zone shown in the header is the key work in the steps, so the two never disagree (V-014)
  const key = hardestStep(s, plan.athlete.zones);
  const zoneOfIntensity: Zone = key ? key.zone : s.intensity === "Tempo" ? 3 : s.intensity === "Intervals" || s.intensity === "Race" ? 4 : 2;
  const tgt = targetOf(s, key?.seg, plan.athlete.zones);
  const raceDay = /^race day/i.test(s.text);
  return (
    <section className={`card session-panel ${s.status}`} aria-label="Session detail">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="sp-head">
        <SportIcon sport={s.sport} size={48} />
        <div>
          <div className="eyebrow">{dateLabel(s.date)}{s.start ? ` · ${s.start}` : ""}<span className="sp-wk"> · Week {w.week} · {w.phaseShort}</span></div>
          <h2>{raceDay ? "Race day" : s.title}{s.sport !== "rest" && !raceDay && <span className="dim"> · {s.intensity}</span>}</h2>
        </div>
        {s.locked && s.status !== "done" && <span className="status locked" title="Locked: drag and Move are off until you unlock it"><Icon name="lock" />Locked</span>}
        <span className={`status ${s.status}`}>{s.status === "done" && "✓ "}{status}{s.status === "partial" && s.actual ? ` · ${Math.round(s.actual.min)} of ${s.min} min` : ""}</span>
      </div>

      <div className="sp-grid">
        <div className="sp-left">
          {s.sport !== "rest" ? (
            <>
              <div className="stat"><div className="k">Duration</div><div className="v">{s.min >= 120 ? fmtDur(s.min) : `${s.min} min`}</div></div>
              <div className="stat"><div className="k">Zone</div><div className="v">{zoneName(zoneOfIntensity).split(" · ")[0]}<small> · {zoneName(zoneOfIntensity).split(" · ")[1]}</small></div></div>
              {tgt && <div className="stat"><div className="k">{tgt.k}</div><div className="v">{tgt.v}</div><div className="u">{tgt.u}{plan.athlete.zonesSource === "intake" ? `${tgt.u ? " · " : ""}from your answers` : plan.athlete.zonesSource === "default" ? `${tgt.u ? " · " : ""}default zones` : ""}</div></div>}
              <div className="stat"><div className="k">Planned load</div><div className="v">{plannedLoad(s)}</div></div>
              {s.actual && (s.actual.sport !== s.sport || Math.abs(s.actual.min - s.min) >= 5) && <div className="stat actual"><div className="k">Done as</div><div className="v">{s.actual.sport[0].toUpperCase() + s.actual.sport.slice(1)} {s.actual.min} min</div><div className="u">planned {s.title} {s.min} min</div></div>}
            </>
          ) : (
            <div className="stat"><div className="k">Rest day</div><div className="v">No session</div></div>
          )}
        </div>
        <div className="sp-right">
          <div className="eyebrow muted">Training program</div>
          <p className="txt">{s.text}</p>
          <ol className="steps">{wk.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
          {wk.note && <p className="why">{wk.note}</p>}
          {acts.length > 0 && (
            <div className="sp-acts">
              <div className="eyebrow muted">Logged that day</div>
              {acts.map((a) => (
                <Link key={a.id} href={`/activities?a=${a.id}`} className="sp-act">
                  <SportIcon sport={a.sport} size={22} />
                  <div className="t"><b>{a.name}</b><small>{a.start ? `${a.start} · ` : ""}{fmtHMS(a.min)}{a.sport === "swim" && a.yd ? ` · ${swimDist(a.yd).v.toLocaleString()} ${swimDist(0).u}` : a.mi ? ` · ${fmtDist(a.mi)}` : ""}{a.sport === "run" && a.pace_s ? ` · ${fmtPace(runPace(a.pace_s).s)}${runPace(0).u}` : a.sport === "bike" && a.mph ? ` · ${fmtSpeed(a.mph)}` : a.sport === "swim" && a.p100_s ? ` · ${fmtPace(swimPace(a.p100_s).s)}${swimPace(0).u}` : ""}{a.hr ? ` · ${a.hr} bpm` : ""}{a.elev_ft ? ` · ${elev(a.elev_ft).v} ${elev(0).u}` : ""} · load {activityLoad(a, plan.athlete.lthr ?? undefined)}</small></div>
                  {a.route && <div className="thumb"><RouteMap route={a.route} height={40} bg="var(--surface-2)" pad={0.1} /></div>}
                </Link>
              ))}
            </div>
          )}
          {mode === "view" && (
            <div className="sp-actions">
              {s.sport !== "rest" && acts.length === 0 && (s.date <= ymd(today()) ? <button type="button" className="btn" onClick={() => setMode("log")}><Icon name="plus" />Log activity</button> : <span className="sp-toast">Log it once it is done · {dateLabel(s.date)}</span>)}
              {!s.locked && s.status !== "done" && <button type="button" className="btn ghost" onClick={() => setMode("move")}>Move</button>}
              <button type="button" className="btn ghost" onClick={() => setMode("edit")}>Edit</button>
              {s.status !== "done" && <button type="button" className={`btn ghost${s.locked ? " on" : ""}`} onClick={() => { plan.toggleLock(s.id); setToast(s.locked ? "Unlocked · can be moved again" : "Locked · stays where it is"); }}><Icon name={s.locked ? "lock" : "unlock"} />{s.locked ? "Unlock" : "Lock"}</button>}
              {toast && <span className="sp-toast">✓ {toast}</span>}
            </div>
          )}
          {mode === "move" && <MoveForm s={s} onDone={() => { setMode("view"); setToast("Session moved"); }} />}
          {mode === "edit" && <EditForm s={s} onDone={() => { setMode("view"); setToast("Saved"); }} />}
          {mode === "log" && (
            <div className="sp-log">
              <LogActivity inline open onClose={() => setMode("view")} initial={{ sport: s.sport === "brick" ? "bike" : s.sport === "rest" ? "other" : s.sport, date: s.date, time: s.start ?? "06:30", min: s.min, name: `${s.title} · ${s.intensity}` }} onSaved={(a) => { plan.logActivity(a); setMode("view"); setToast(`Logged · ${a.name}`); }} />
            </div>
          )}
        </div>
      </div>

      {wk.segments.length > 0 && (
        <div className="sp-intervals">
          <div className="sp-int-head"><span className="eyebrow muted">Intervals and target {s.sport === "bike" || s.sport === "brick" ? "speed" : "pace"}</span><span className="lgd">{([1, 2, 3, 4, 5] as Zone[]).map((z) => <span key={z}><i style={{ background: ZONE_FILL[z] }} />{zoneName(z)}</span>)}</span></div>
          <IntervalChart segments={wk.segments} fuel={fuel} />
          <FuelBlock s={s} />
        </div>
      )}
    </section>
  );
}
