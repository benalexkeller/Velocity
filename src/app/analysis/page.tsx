"use client";
import "./analysis.css";
import { useState } from "react";
import { CoachBar } from "@/components/CoachBar";
import { ActivityAnalyzer, ActivityPanel, BodyPanel, LoadChart, PaceCorridor, ScoreRow, TotalsPanel, VolumeStack, type Range } from "@/components/analysis/Panels";

export default function AnalysisPage() {
  const [range, setRange] = useState<Range>(12);
  const [sel, setSel] = useState<string | null>(null);
  return (
    <main className="main">
      <div className="an">
        <div className="page-head">
          <div>
            <div className="eyebrow muted">Am I getting fitter?</div>
            <h1>Analysis</h1>
          </div>
          <span className="grow" />
          <ActivityAnalyzer selectedId={sel} onSelect={setSel} />
          <div className="pill-group" role="group" aria-label="Time range">
            {([4, 12, 99] as Range[]).map((r) => <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === 99 ? "All" : `${r} wk`}</button>)}
          </div>
        </div>

        <ActivityPanel id={sel} onClose={() => setSel(null)} />
        <ScoreRow />
        <div className="an-charts">
          <LoadChart range={range} />
          <VolumeStack range={range} />
        </div>
        <PaceCorridor range={range} onPick={(id) => { setSel(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        <BodyPanel />
        <TotalsPanel />
        <section className="card an-how" aria-label="How the scores are calculated">
          <div className="eyebrow">How the numbers are calculated</div>
          <div className="cols">
            <p><b>Race capability</b> = 0.40 run + 0.35 bike + 0.15 swim + 0.10 durability. Each part: 70 at your plan-start pace, 100 at the race-day target pace (4-week duration-weighted average). Durability: 70 at 60% compliance, 100 at 100%.</p>
            <p><b>Health</b> = 0.50 VO2max + 0.25 resting HR + 0.25 HRV, 7-day averages from Garmin. 70 at the start values (52 · 46 · 77), 100 at the targets (60 · 38 · 96).</p>
            <p><b>Load</b> = minutes × intensity factor (heart-rate based; exertion when there is no HR). Fitness = 42-day weighted load, Fatigue = 7-day, Form = Fitness − Fatigue. A week-over-week ramp above 10% is flagged.</p>
          </div>
        </section>
        <CoachBar id="an-coach" />
      </div>
    </main>
  );
}
