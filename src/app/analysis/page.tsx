"use client";
import "./analysis.css";
import { useState } from "react";
import Link from "next/link";
import { CoachBar } from "@/components/CoachBar";
import { ActivityAnalyzer, ActivityPanel } from "@/components/analysis/Panels";
import { KpiRow, Observations, Overview, Progress, Quality, RaceReadiness, Recovery, SportRow, Volume, type Range } from "@/components/analysis/Analytics";
import { addDays, dateFull, rangeLabel, today, ymd } from "@/lib/format";
import { usePlan } from "@/lib/store";

// New athlete: one card that says what is missing, instead of ten panels of zeros (V-090).
function NeedsData() {
  const plan = usePlan();
  const a = plan.athlete;
  const rows: [string, string, string | null, string | null][] = [
    ["Plan", plan.hasPlan ? `✓ ${plan.weeks.length} weeks` : "No plan", plan.hasPlan ? null : "Build a plan", plan.hasPlan ? null : "/plan/new"],
    ["Sessions", `${plan.activities.length} logged`, "Log one", "/dashboard"],
    ["Thresholds", a.lthr ? `LTHR ${a.lthr}${a.ftp ? ` · FTP ${a.ftp}` : ""}` : "Not set · load uses a default", a.lthr ? null : "Set in Plan settings", a.lthr ? null : "/plan/new?edit=1"],
    ["Body data", plan.body.length ? `${plan.body.length} days` : "Not connected", null, null],
  ];
  return (
    <section className="card ax-panel ax-empty" aria-label="Analysis needs data">
      <div className="ax-head"><div><h2>Analysis needs data</h2><p>Charts appear after the first logged session.</p></div></div>
      <dl>{rows.map(([k, v, cta, href]) => <div key={k}><dt>{k}</dt><dd>{v}{cta && href && <> · <Link href={href}>{cta} →</Link></>}</dd></div>)}</dl>
    </section>
  );
}

export default function AnalysisPage() {
  const plan = usePlan();
  const ATHLETE = plan.athlete;
  const empty = plan.ready && plan.activities.length === 0 && plan.body.length === 0;
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
          </div>
          <span className="grow" />
          <div className="pill-group" role="group" aria-label="Time range">
            {([4, 12, 99] as Range[]).map((r) => <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r === 99 ? "All" : `Last ${r} weeks`}</button>)}
          </div>
          <span className="badge muted">{range === 99 ? `Since ${dateFull(ATHLETE.planStart)}` : rangeLabel(ymd(from), ymd(today()))}</span>
          <ActivityAnalyzer selectedId={sel} onSelect={setSel} />
        </div>

        <ActivityPanel id={sel} onClose={() => setSel(null)} />
        {empty ? <NeedsData /> : (
          <>
            {/* this week and the Sunday facts first, then trends, then each recent activity against the plan */}
            <KpiRow />
            <Observations />
            <Overview range={range} />
            <Volume range={range} />
            <SportRow />
            <Progress range={range} onPick={pick} />
            <Quality onPick={pick} />
            <Recovery />
            <RaceReadiness />
          </>
        )}
        <CoachBar id="an-coach" />
      </div>
    </main>
  );
}
