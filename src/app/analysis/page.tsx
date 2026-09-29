"use client";
import "./analysis.css";
import { useState } from "react";
import { CoachBar } from "@/components/CoachBar";
import { ActivityAnalyzer, ActivityPanel } from "@/components/analysis/Panels";
import { KpiRow, LoadDistribution, Observations, Overview, Progress, Quality, RaceReadiness, Recovery, SportRow, Volume, type Range } from "@/components/analysis/Analytics";
import { addDays, dateLabel, today } from "@/lib/format";
import { usePlan } from "@/lib/store";

export default function AnalysisPage() {
  const ATHLETE = usePlan().athlete;
  const [range, setRange] = useState<Range>(12);
  const [sel, setSel] = useState<string | null>(null);
  const pick = (id: string) => { setSel(id); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const from = addDays(today(), -(range === 99 ? 365 : range * 7));
  return (
    <main className="main">
      <div className="ax">
        <div className="page-head ax-top">
          <div>
            <h1>Analysis</h1>
            <div className="muted sub">{ATHLETE.firstName}{ATHLETE.hasRace ? ` · ${ATHLETE.race.name}` : ""}</div>
          </div>
          <span className="grow" />
          <div className="pill-group" role="group" aria-label="Time range">
            {([4, 12, 99] as Range[]).map((r) => <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === 99 ? "All" : `Last ${r} weeks`}</button>)}
          </div>
          <span className="badge muted">{range === 99 ? `Since ${dateLabel(ATHLETE.planStart)}` : `${dateLabel(from.toISOString().slice(0, 10))} – ${dateLabel(today().toISOString().slice(0, 10))}`}</span>
          <ActivityAnalyzer selectedId={sel} onSelect={setSel} />
        </div>

        <ActivityPanel id={sel} onClose={() => setSel(null)} />
        <KpiRow />
        <Overview range={range} />
        <Volume range={range} />
        <LoadDistribution range={range} />
        <SportRow />
        <Progress range={range} onPick={pick} />
        <Recovery />
        <Quality onPick={pick} />
        <RaceReadiness />
        <Observations />
        <CoachBar id="an-coach" />
      </div>
    </main>
  );
}
