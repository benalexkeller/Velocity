"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "./plan.css";
import { Icon } from "@/components/icons";
import { SportIcon } from "@/components/SportIcon";
import { CoachRail } from "@/components/CoachRail";
import { WeekGrid, weekRange } from "@/components/plan/WeekGrid";
import { SessionPanel } from "@/components/plan/SessionPanel";
import { MonthGrid } from "@/components/plan/MonthGrid";
import { RampChart } from "@/components/plan/RampChart";
import { PlanExplained } from "@/components/plan/PlanExplained";
import { COACH_THREAD, plannedByDiscipline, plannedLoad, type Sport, type Week } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { dateLabel, fromYmd, fmtHours, addDays, ymd } from "@/lib/format";
import { METHOD } from "@/lib/plan/rules";

const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const INTENSITIES = ["Zone 2", "Aerobic", "Technique", "Endurance", "Tempo", "Intervals", "Race"];
const SPORTS: Sport[] = ["swim", "bike", "run", "brick", "strength", "hike", "other"];

export default function PlanPage() {
  return <Suspense fallback={null}><Plan /></Suspense>;
}

// "+ Add session": creates a session in the local plan.
function AddWorkout({ week, onDone }: { week: Week; onDone: (id: string | null) => void }) {
  const plan = usePlan();
  const [sport, setSport] = useState<Sport>("run");
  const [date, setDate] = useState(week.start);
  const [start, setStart] = useState("06:30");
  const [min, setMin] = useState("45");
  const [intensity, setIntensity] = useState("Zone 2");
  const [text, setText] = useState("");
  return (
    <form className="card sp-form add-workout" onSubmit={(e) => { e.preventDefault(); const id = plan.addSession({ sport, date, start, min: Math.max(5, parseInt(min) || 45), intensity, text: text.trim() || `${sport[0].toUpperCase() + sport.slice(1)} ${min} min ${intensity}` }); if (id) onDone(id); }}>
      <div className="eyebrow">Add session</div>
      <div className="two">
        <label>Sport<select value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
        <label>Intensity<select value={intensity} onChange={(e) => setIntensity(e.target.value)}>{INTENSITIES.map((k) => <option key={k}>{k}</option>)}</select></label>
      </div>
      <div className="two">
        <label>Day<input type="date" value={date} min={plan.planRange?.start} max={plan.planRange?.end} onChange={(e) => setDate(e.target.value)} />{plan.planRange && (date < plan.planRange.start || date > plan.planRange.end) && <small className="err">Outside the plan · {dateLabel(plan.planRange.start)} – {dateLabel(plan.planRange.end)}</small>}</label>
        <label>Start<input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></label>
      </div>
      <div className="two">
        <label>Duration (min)<input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" /></label>
        <label>Description<input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Run 0:45 EZ + 4x20s strides" /></label>
      </div>
      <div className="row"><button type="submit" className="btn">Add to plan</button><button type="button" className="btn ghost" onClick={() => onDone(null)}>Cancel</button></div>
    </form>
  );
}

// Overview of a week picked on the road-to-race chart: hours per sport, sessions, load, phase.
function WeekOverview({ week, onClose, onOpenWeek }: { week: Week; onClose: () => void; onOpenWeek: () => void }) {
  const plan = usePlan();
  const p = plannedByDiscipline(week);
  const st = plan.weekStatus(week);
  const phase = plan.phases.find((x) => week.week >= x.from && week.week <= x.to);
  const sessions = week.sessions.filter((s) => s.sport !== "rest");
  const count = (sp: string) => sessions.filter((s) => s.sport === sp).length;
  const n = (k: number) => `${k} session${k === 1 ? "" : "s"}`;
  const load = week.sessions.reduce((a, s) => a + plannedLoad(s), 0);
  const past = fromYmd(week.start) < new Date();
  const longest = sessions.reduce<typeof sessions[number] | null>((m, s) => (!m || s.min > m.min ? s : m), null);
  return (
    <section className="card week-overview" aria-label={`Week ${week.week} overview`}>
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="wo-head">
        <div>
          <div className="eyebrow">{phase?.short ?? week.phaseShort} · Week {week.week} of {plan.weeks.length}</div>
          <h3>{dateLabel(week.start)} – {dateLabel(ymd(addDays(fromYmd(week.start), 6)))}{week.recovery ? " · recovery week" : ""}{week.race ? " · race week" : ""}</h3>
          <p className="muted">{week.focus}{phase ? ` · ${phase.purpose}` : ""}</p>
        </div>
        <button type="button" className="btn ghost" onClick={onOpenWeek}>Open week in calendar →</button>
      </div>
      <div className="wo-grid">
        <div><div className="k">Sessions</div><div className="v">{sessions.length}</div><div className="u">{count("swim")} swim · {count("bike") + count("brick")} bike · {count("run")} run{count("strength") ? ` · ${count("strength")} strength` : ""}</div></div>
        <div><div className="k">Planned hours</div><div className="v">{fmtHours(week.plannedMin / 60)}</div><div className="u">{past ? `${fmtHours(st.actualH)} done` : "planned"}</div></div>
        <div><SportIcon sport="swim" size={18} /><div className="k">Swim</div><div className="v">{fmtHours(p.swim)}</div><div className="u">{past ? `${fmtHours(st.bySport.swim)} done` : n(count("swim"))}</div></div>
        <div><SportIcon sport="bike" size={18} /><div className="k">Bike</div><div className="v">{fmtHours(p.bike)}</div><div className="u">{past ? `${fmtHours(st.bySport.bike)} done` : n(count("bike") + count("brick"))}</div></div>
        <div><SportIcon sport="run" size={18} /><div className="k">Run</div><div className="v">{fmtHours(p.run)}</div><div className="u">{past ? `${fmtHours(st.bySport.run)} done` : n(count("run"))}</div></div>
        <div><div className="k">Planned load</div><div className="v">{load}</div><div className="u">{past ? `${st.done} of ${st.total} sessions done` : longest ? `longest: ${longest.title} ${longest.min} min` : ""}</div></div>
      </div>
      <ul className="wo-list">
        {week.sessions.map((s) => <li key={s.id}><span className={`d ${s.status}`}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][s.dayIndex]}</span><SportIcon sport={s.sport} size={16} /><span className="t">{s.sport === "rest" ? "Rest day" : s.text}</span><span className="m">{s.sport === "rest" ? "" : `${s.min} min`}</span></li>)}
      </ul>
    </section>
  );
}

function Plan() {
  const plan = usePlan();
  const params = useSearchParams();
  const fromUrl = params.get("session");
  const cur = plan.currentWeek();
  const [sel, setSel] = useState<string | null>(fromUrl);
  const [wk, setWk] = useState(plan.findSession(fromUrl)?.w.week ?? cur.week);
  const [view, setView] = useState<"week" | "month">("week");
  const [adding, setAdding] = useState(false);
  const [overview, setOverview] = useState<number | null>(null);
  const [calInfo, setCalInfo] = useState(false);
  useEffect(() => { if (fromUrl) { setSel(fromUrl); const hit = plan.findSession(fromUrl); if (hit) setWk(hit.w.week); } }, [fromUrl, plan]);
  useEffect(() => { if (plan.ready && !fromUrl) setWk(plan.currentWeek().week); }, [plan.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = plan.weekByNumber(wk);
  const ws = plan.weekStatus(week);
  const monthDate = fromYmd(week.start);
  const [mo, setMo] = useState({ y: monthDate.getFullYear(), m: monthDate.getMonth() });
  const pick = (id: string) => { setSel(id); const hit = plan.findSession(id); if (hit) setWk(hit.w.week); };

  return (
    <main className="main with-coach">
      <div className="plan">
        <div className="plan-head">
          <button className="back" type="button" aria-label="Previous week" onClick={() => (view === "week" ? setWk(Math.max(1, wk - 1)) : setMo(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })))}>
            <Icon name="back" />
          </button>
          <h1>{view === "week" ? `Week ${week.week}` : M[mo.m]}</h1>
          <button className="back" type="button" aria-label="Next week" onClick={() => (view === "week" ? setWk(Math.min(plan.weeks.length, wk + 1)) : setMo(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })))}>
            <Icon name="chevron" />
          </button>
          <span className="range">{view === "week" ? weekRange(week) : mo.y}</span>
          {wk !== cur.week && view === "week" && <button type="button" className="btn ghost small" onClick={() => setWk(cur.week)}>Today</button>}
          <span className="grow" />
          <div className="pill-group" role="tablist">
            <button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Week</button>
            <button type="button" className={view === "month" ? "on" : ""} onClick={() => setView("month")}>Month</button>
          </div>
          <span style={{ position: "relative" }}>
            <button type="button" className="badge" aria-expanded={calInfo} onClick={() => setCalInfo((o) => !o)} title={`Google Calendar sync ${plan.calendar ? "on" : "off"}`}><span className={plan.calendar ? "ok" : "ok off"}>{plan.calendar ? "✓" : "–"}</span>Calendar</button>
            {calInfo && (
              <div className="menu" role="dialog">
                <div className="small"><b>Google Calendar</b><br />The Google connection isn't built yet. This switch records whether sessions should be written to your calendar once it is.</div>
                <button type="button" onClick={() => { plan.toggleCalendar(); setCalInfo(false); }}>{plan.calendar ? "Turn sync off" : "Turn sync on"}</button>
              </div>
            )}
          </span>
          {!plan.hasPlan && <Link href="/plan/new" className="btn ghost">Build plan</Link>}
          <button className="btn" type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding}><Icon name="plus" />Add session</button>
        </div>

        {!plan.hasPlan && (
          <section className="card no-plan" aria-label="No plan yet">
            <div><div className="eyebrow">No plan yet</div><h3>Answer five screens of questions and the plan is built for your race, your hours and your days.</h3><p className="muted">Or upload a plan you already have as a spreadsheet. Either way every session can be moved, edited or locked afterwards.</p></div>
            <div className="row"><Link href="/plan/new" className="btn">Build my plan<Icon name="arrow" /></Link><Link href="/plan/new?import=1" className="btn ghost">Upload a plan</Link></div>
          </section>
        )}

        {adding && <AddWorkout week={week} onDone={(id) => { setAdding(false); if (id) { setSel(id); const hit = plan.findSession(id); if (hit) setWk(hit.w.week); } }} />}

        {view === "week" ? <WeekGrid week={week} selectedId={sel} onPick={(x) => setSel(x.id)} /> : <MonthGrid year={mo.y} month={mo.m} selectedId={sel} onPick={(x) => { pick(x.id); setView("week"); }} />}
        <SessionPanel key={sel ?? "none"} id={sel} onClose={() => setSel(null)} />

        <section className="section">
          <div className="section-head">
            <h2>{plan.hasPlan ? `The road to ${plan.athlete.race.distanceLabel || plan.athlete.race.name}` : "The road to race day"}</h2>
            <span className="sub">{plan.hasPlan ? `${plan.weeks.length} weeks · ${plan.phases.length} phases · race ${dateLabel(plan.athlete.race.date)} ${plan.athlete.race.date.slice(0, 4)} · click a week` : plan.athlete.hasRace ? `${plan.athlete.race.name} · ${dateLabel(plan.athlete.race.date)} ${plan.athlete.race.date.slice(0, 4)} · no plan yet` : "No race set · build a plan to add one"}</span>
            <span className="legend">
              <span><i style={{ background: "var(--swim)" }} />Swim</span>
              <span><i style={{ background: "var(--bike)" }} />Bike</span>
              <span><i style={{ background: "var(--run)" }} />Run</span>
              {plan.hasPlan && <Link href={plan.intake ? "/plan/new?edit=1" : "/plan/new"} className="settings" title={plan.intake ? "Change the answers and rebuild the plan" : "Build a new plan from a few questions"}>Plan settings →</Link>}
            </span>
          </div>
          <RampChart selected={overview} onPick={(n) => setOverview(n === overview ? null : n)} />
          {overview && <WeekOverview week={plan.weekByNumber(overview)} onClose={() => setOverview(null)} onOpenWeek={() => { setWk(overview); setView("week"); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Your plan explained</h2>
            <span className="sub">Each phase: what changes and the milestones to hit.</span>
          </div>
          <PlanExplained />
        </section>

        {plan.intake && (
          <section className="section">
            <div className="section-head">
              <h2>How this plan is built</h2>
              <span className="sub">The rules the builder follows and where they come from.</span>
            </div>
            <ol className="method">
              {METHOD.map((m) => <li key={m.url + m.rule.slice(0, 12)}><b>{m.rule}</b><span><a href={m.url} target="_blank" rel="noreferrer">{m.source}</a></span></li>)}
            </ol>
          </section>
        )}
      </div>

      <CoachRail thread={COACH_THREAD as never} summary={`Week ${week.week} · ${ws.done} of ${ws.total} sessions · ${fmtHours(ws.actualH)} of ${fmtHours(ws.plannedH)}${plan.changes ? ` · ${plan.changes} local change${plan.changes === 1 ? "" : "s"}` : " · plan unchanged since Sunday"}`} />
    </main>
  );
}
