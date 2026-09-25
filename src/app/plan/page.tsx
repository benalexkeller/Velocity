"use client";
import { useState } from "react";
import "./plan.css";
import { Icon } from "@/components/icons";
import { CoachRail } from "@/components/CoachRail";
import { WeekGrid, weekTitle } from "@/components/plan/WeekGrid";
import { MonthGrid } from "@/components/plan/MonthGrid";
import { RampChart } from "@/components/plan/RampChart";
import { PlanExplained } from "@/components/plan/PlanExplained";
import { COACH_THREAD, WEEKS, currentWeek, weekByNumber, weekStatus } from "@/lib/data";
import { ATHLETE } from "@/lib/config";
import { fromYmd, fmtHours } from "@/lib/format";

const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PlanPage() {
  const cur = currentWeek();
  const [wk, setWk] = useState(cur.week);
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

        {view === "week" ? <WeekGrid week={week} /> : <MonthGrid year={mo.y} month={mo.m} />}

        <section className="section">
          <div className="section-head">
            <h2>The road to {ATHLETE.race.distanceLabel}</h2>
            <span className="sub">{WEEKS.length} weeks · Build consistently. Arrive ready.</span>
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
            <span className="sub">A clear structure to build fitness, stay healthy and arrive ready on race day.</span>
          </div>
          <PlanExplained />
        </section>
      </div>

      <CoachRail thread={COACH_THREAD as never} summary={`Week ${week.week} · ${ws.done} of ${ws.total} sessions · ${fmtHours(ws.actualH)} of ${fmtHours(ws.plannedH)} · plan unchanged since Sunday`} />
    </main>
  );
}
