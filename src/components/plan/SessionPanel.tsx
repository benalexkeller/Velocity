"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { RouteMap } from "../RouteMap";
import { LogActivity } from "../dashboard/LogActivity";
import { activityLoad, plannedLoad, type Session, type Sport } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { ATHLETE } from "@/lib/config";
import { dateLabel, fmtHMS, fmtPace } from "@/lib/format";
import { elev, fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";
import { workoutFor, zoneName, type Segment, type Zone } from "@/lib/workout";

const INTENSITIES = ["Zone 2", "Aerobic", "Technique", "Endurance", "Tempo", "Intervals", "Race"];
const SPORTS: Sport[] = ["swim", "bike", "run", "brick", "strength", "hike", "other", "rest"];

// Move: pick a new day and start time. Saves to the local store.
function MoveForm({ s, onDone }: { s: Session; onDone: () => void }) {
  const plan = usePlan();
  const [date, setDate] = useState(s.date);
  const [start, setStart] = useState(s.start ?? "06:30");
  return (
    <form className="sp-form" onSubmit={(e) => { e.preventDefault(); plan.moveSession(s.id, { date, start }); onDone(); }}>
      <label>Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Start<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></label>
      <div className="row"><button type="submit" className="btn">Move session</button><button type="button" className="btn ghost" onClick={onDone}>Cancel</button></div>
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

function targetOf(s: Session) {
  const sp = s.sport === "brick" ? "bike" : s.sport;
  const z = ATHLETE.zones[sp]?.[s.intensity];
  if (!z) return null;
  return { k: sp === "bike" ? "Target speed" : "Target pace", v: z, u: sp === "bike" ? "" : sp === "swim" ? "per 100 yd" : "per mile" };
}

const ZONE_FILL: Record<Zone, string> = { 1: "#DCE6FB", 2: "#A5C7FD", 3: "#2459FE", 4: "#0E2E8A", 5: "#101114" };

// Interval chart: time on the x axis, zone (effort) on the y axis; each block is one segment with its target pace.
function IntervalChart({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.min, 0) || 1;
  const W = 900, H = 170, L = 34, R = 10, T = 26, B = 28;
  const x = (m: number) => L + (m / total) * (W - L - R);
  const y = (z: number) => T + ((5 - z) / 5) * (H - T - B);
  let acc = 0;
  const tick = total <= 60 ? 10 : total <= 120 ? 15 : 30;
  const ticks: number[] = []; for (let m = 0; m <= total; m += tick) ticks.push(m);
  return (
    <svg className="chart sp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Session structure: time and target effort">
      {[1, 2, 3, 4, 5].map((z) => <g key={z}><line x1={L} y1={y(z)} x2={W - R} y2={y(z)} stroke="var(--grid)" /><text x={L - 6} y={y(z) + 4} textAnchor="end">Z{z}</text></g>)}
      {segments.map((s, i) => {
        const x0 = x(acc), x1 = x(acc + s.min); acc += s.min;
        const wide = x1 - x0 > 54;
        const el = (
          <g key={i}>
            <rect x={x0 + 0.5} y={y(s.zone)} width={Math.max(1, x1 - x0 - 1)} height={y(0) - y(s.zone)} fill={ZONE_FILL[s.zone]} rx={2} />
            {wide && <text x={(x0 + x1) / 2} y={y(s.zone) - 8} textAnchor="middle" className="ink" fontSize="11" fontWeight="600">{s.kind === "recovery" ? "recover" : s.label.replace(/^Rep \d+$/, "rep")}</text>}
            {wide && s.kind !== "recovery" && <text x={(x0 + x1) / 2} y={y(0) - 8} textAnchor="middle" fontSize="10.5" fill={s.zone >= 4 ? "#fff" : s.zone === 3 ? "#fff" : "var(--ink-2)"}>{s.target.replace(/ ?\/(mi|100 yd)$/, "")}</text>}
          </g>
        );
        return el;
      })}
      <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke="var(--line)" />
      {ticks.map((m) => <text key={m} x={x(m)} y={H - 8} textAnchor={m === 0 ? "start" : m >= total - tick / 2 ? "end" : "middle"}>{m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : `${m} min`}</text>)}
    </svg>
  );
}

// Large session view on the Plan page, under the calendar. Clicking any block swaps the session in.
export function SessionPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const plan = usePlan();
  const [mode, setMode] = useState<"view" | "log" | "move" | "edit">("view");
  const [toast, setToast] = useState<string | null>(null);
  const hit = plan.findSession(id);
  if (!hit) return null;
  const { s, w } = hit;
  const tgt = targetOf(s);
  const acts = plan.activitiesOn(s.date);
  const wk = workoutFor(s);
  const status = s.status === "done" ? "Completed" : s.status === "missed" ? "Missed" : "Planned";
  const zoneOfIntensity: Zone = s.intensity === "Tempo" ? 3 : s.intensity === "Intervals" || s.intensity === "Race" ? 4 : 2;
  return (
    <section className={`card session-panel ${s.status}`} aria-label="Session detail">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="sp-head">
        <SportIcon sport={s.sport} size={48} />
        <div>
          <div className="eyebrow">{dateLabel(s.date)}{s.start ? ` · ${s.start}` : ""} · Week {w.week} · {w.phaseShort}</div>
          <h2>{s.title}{s.sport !== "rest" && <span className="dim"> · {s.intensity}</span>}</h2>
        </div>
        <span className={`status ${s.status}`}>{s.status === "done" && "✓ "}{status}</span>
      </div>

      <div className="sp-grid">
        <div className="sp-left">
          {s.sport !== "rest" ? (
            <>
              <div className="stat"><div className="k">Duration</div><div className="v">{s.min} min</div></div>
              <div className="stat"><div className="k">Zone</div><div className="v">{zoneName(zoneOfIntensity).split(" · ")[0]}<small> · {s.intensity}</small></div></div>
              {tgt && <div className="stat"><div className="k">{tgt.k}</div><div className="v">{tgt.v}</div>{tgt.u && <div className="u">{tgt.u}</div>}</div>}
              <div className="stat"><div className="k">Planned load</div><div className="v">{plannedLoad(s)}</div></div>
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
                  <div className="t"><b>{a.name}</b><small>{a.start ? `${a.start} · ` : ""}{fmtHMS(a.min)}{a.sport === "swim" && a.yd ? ` · ${swimDist(a.yd).v.toLocaleString()} ${swimDist(0).u}` : a.mi ? ` · ${fmtDist(a.mi)}` : ""}{a.sport === "run" && a.pace_s ? ` · ${fmtPace(runPace(a.pace_s).s)}${runPace(0).u}` : a.sport === "bike" && a.mph ? ` · ${fmtSpeed(a.mph)}` : a.sport === "swim" && a.p100_s ? ` · ${fmtPace(swimPace(a.p100_s).s)}${swimPace(0).u}` : ""}{a.hr ? ` · ${a.hr} bpm` : ""}{a.elev_ft ? ` · ${elev(a.elev_ft).v} ${elev(0).u}` : ""} · load {activityLoad(a)}</small></div>
                  {a.route && <div className="thumb"><RouteMap route={a.route} height={40} bg="var(--surface-2)" pad={0.1} /></div>}
                </Link>
              ))}
            </div>
          )}
          {mode === "view" && (
            <div className="sp-actions">
              {s.sport !== "rest" && acts.length === 0 && <button type="button" className="btn" onClick={() => setMode("log")}><Icon name="plus" />Log activity</button>}
              <button type="button" className="btn ghost" onClick={() => setMode("move")}>Move</button>
              <button type="button" className="btn ghost" onClick={() => setMode("edit")}>Edit</button>
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
          <IntervalChart segments={wk.segments} />
        </div>
      )}
    </section>
  );
}
