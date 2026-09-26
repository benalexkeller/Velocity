"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import "./plan.css";
import { Icon } from "@/components/icons";
import { CoachRail } from "@/components/CoachRail";
import { WeekGrid, weekTitle } from "@/components/plan/WeekGrid";
import { SessionPanel, findSession } from "@/components/plan/SessionPanel";
import { MonthGrid } from "@/components/plan/MonthGrid";
import { RampChart } from "@/components/plan/RampChart";
import { PlanExplained } from "@/components/plan/PlanExplained";
import { COACH_THREAD, WEEKS, currentWeek, weekByNumber, weekStatus } from "@/lib/data";
import { ATHLETE } from "@/lib/config";
import { dateLabel, fromYmd, fmtHours } from "@/lib/format";

const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PlanPage() {
  return <Suspense fallback={null}><Plan /></Suspense>;
}

function Plan() {
  const params = useSearchParams();
  const fromUrl = params.get("session");
  const cur = currentWeek();
  const [sel, setSel] = useState<string | null>(fromUrl);
  const [wk, setWk] = useState(findSession(fromUrl)?.w.week ?? cur.week);
  useEffect(() => { if (fromUrl) { setSel(fromUrl); const hit = findSession(fromUrl); if (hit) setWk(hit.w.week); } }, [fromUrl]);
  const [view, setView] = useState<"week" | "month">("week");
  const week = weekByNumber(wk);
  const ws = weekStatus(week);
  const monthDate = fromYmd(week.start);
  const [mo, setMo] = useState({ y: monthDate.getFullYear(), m: monthDate.getMonth() });

  return (
    <main className="main with-coach">
      <div className="plan">
        <div className="plan-head">
          <button className="back" type="button" aria-label="Previous week" onClick={() => (view === "week" ? setWk(Math.max(1, wk - 1)) : setMo(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })))}>
            <Icon name="back" />
          </button>
          <h1>
            {view === "week" ? weekTitle(week) : `${M[mo.m]} ${mo.y}`}
          </h1>
          <button className="back" type="button" aria-label="Next week" onClick={() => (view === "week" ? setWk(Math.min(WEEKS.length, wk + 1)) : setMo(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })))}>
            <Icon name="chevron" />
          </button>
          <span className="grow" />
          <div className="pill-group" role="tablist">
            <button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Week</button>
            <button type="button" className={view === "month" ? "on" : ""} onClick={() => setView("month")}>Month</button>
          </div>
          <span className="badge"><span className="ok">✓</span>Google Calendar <span className="muted">connected</span></span>
          <button className="btn" type="button"><Icon name="plus" />Add workout</button>
        </div>

        <SessionPanel id={sel} onClose={() => setSel(null)} />
        {view === "week" ? <WeekGrid week={week} selectedId={sel} onPick={(x) => { setSel(x.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} /> : <MonthGrid year={mo.y} month={mo.m} />}

        <section className="section">
          <div className="section-head">
            <h2>The road to {ATHLETE.race.distanceLabel}</h2>
            <span className="sub">{WEEKS.length} weeks · 7 phases · race {dateLabel(ATHLETE.race.date)} 2027</span>
            <span className="legend">
              <span><i style={{ background: "var(--swim)" }} />Swim</span>
              <span><i style={{ background: "var(--bike)" }} />Bike</span>
              <span><i style={{ background: "var(--run)" }} />Run</span>
            </span>
          </div>
          <RampChart />
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Your plan explained</h2>
            <span className="sub">Each phase: what changes and the milestones to hit.</span>
          </div>
          <PlanExplained />
        </section>
      </div>

      <CoachRail thread={COACH_THREAD as never} summary={`Week ${week.week} · ${ws.done} of ${ws.total} sessions · ${fmtHours(ws.actualH)} of ${fmtHours(ws.plannedH)} · plan unchanged since Sunday`} />
    </main>
  );
}
