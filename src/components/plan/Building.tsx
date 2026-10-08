"use client";
// The build screen: the plan is generated and saved at once, then shown being laid out week by week for
// about half a minute — phases, hours ramp, long sessions — before it opens.
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlan } from "@/lib/store";
import { dateLabel } from "@/lib/format";
import { eventType, type Intake } from "@/lib/plan/intake";
import { generatePlan, type PlanSummary } from "@/lib/plan/generate";
import { availabilityFromIntake, raceFromIntake } from "./Builder";
import { niceTicks, useWidth } from "@/lib/ticks";

const TOTAL = 32; // seconds on screen, minimum
const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmtH = (h: number) => `${h.toFixed(1)} h`;

export function Building({ intake, edit, onOpen }: { intake: Intake; edit: boolean; onOpen: () => void }) {
  const plan = usePlan();
  const result = useMemo(() => generatePlan(intake, undefined, plan.athlete.units !== "metric"), [intake, plan.athlete.units]);
  const { weeks, summary } = result;
  const [t, setT] = useState(0);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t0 = useRef<number>(0);
  useEffect(() => {
    t0.current = performance.now();
    const id = setInterval(() => setT((performance.now() - t0.current) / 1000), 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let on = true;
    plan.buildPlan(intake, weeks, raceFromIntake(intake), availabilityFromIntake(intake)).then(() => { if (on) setSaved(true); }).catch((e) => { if (on) setErr(e instanceof Error ? e.message : "Could not save the plan."); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const et = eventType(intake.goal.type);
  const kind = et.kind;
  const N = summary.weeks;
  const barsFrom = 5, barsTo = 28;
  const shown = Math.max(0, Math.min(N, Math.floor(((t - barsFrom) / (barsTo - barsFrom)) * N) + (t >= barsFrom ? 1 : 0)));
  const long1 = weeks.find((w) => w.days.some((d) => /^Long|^Brick|^Race sim/.test(d.text)));
  const longDay = (re: RegExp) => { const w = weeks[Math.min(weeks.length - 1, 8)] ?? long1; const i = w?.days.findIndex((d) => re.test(d.text)) ?? -1; return i >= 0 ? DAY[i] : null; };
  const rideDay = longDay(/Long ride|Brick|Race sim/), runDay = longDay(/Long run/), swimDay = longDay(/Long swim/), sessDay = longDay(/Long session/);
  const phaseText = summary.phases.map((p) => `${p.name.split(" — ")[0]} ${p.to - p.from + 1} wk`).join(" · ");
  const blackouts = intake.time.blackouts.filter((b) => b.from && b.to).length;
  const steps: { at: number; text: string }[] = [
    { at: 0.4, text: "Reading your answers" },
    { at: 2.5, text: `${N} weeks to race week · plan starts ${dateLabel(summary.start)}` },
    { at: 5.5, text: `Phases: ${phaseText}` },
    { at: 9.5, text: `Hours: ${fmtH(summary.startHours)} a week now → ${fmtH(summary.peakHours)} in the biggest week · at most +10 % a week · every 4th week lighter${summary.peakHours < summary.targetPeak * 0.9 ? ` · your days fit ${fmtH(summary.peakHours)}, not ${fmtH(summary.targetPeak)}: add a day to train more` : ""}` },
    { at: 14, text: kind === "tri" ? `Long ride ${rideDay ?? "—"} · long run ${runDay ?? "—"} · brick sessions from the build phase` : kind === "run" ? `Long run ${runDay ?? "—"} · one tempo and one interval session a week from the build phase` : kind === "bike" ? `Long ride ${rideDay ?? "—"} · tempo and intervals from the build phase` : kind === "swim" ? `Long swim ${swimDay ?? "—"} · threshold sets from the build phase` : `Long session ${sessDay ?? "—"} · quality mid-week from the build phase` },
    { at: 19, text: `${summary.sessions} sessions placed on your ${intake.time.days.length} days${intake.strength ? " · strength twice a week" : ""}` },
    { at: 23.5, text: blackouts ? `${blackouts} blackout period${blackouts === 1 ? "" : "s"} turned into rest days` : `Race week: short openers, rest the day before, ${intake.goal.event || et.label} on ${dateLabel(intake.goal.date)}` },
    { at: 27.5, text: "Rules: 80 / 20 easy-hard · no long session +10 % over the last 30 days · 41–60 % taper with intensity kept" },
  ];
  const ready = t >= TOTAL && saved;
  const pct = Math.min(100, Math.round((t / TOTAL) * 100));

  return (
    <div className="pb pb-building" aria-live="polite">
      <div className="pb-head"><div><div className="eyebrow muted">{edit ? "Rebuilding" : "Building"}</div><h1>{ready ? "Your plan is ready" : `${intake.goal.event || et.label} · ${N} weeks`}</h1></div></div>
      <section className="card pb-card pb-build">
        <div className="pb-build-left">
          <ol className="pb-log">{steps.map((s) => <li key={s.at} className={t >= s.at ? "on" : ""}><span className="ck">{t >= s.at ? "✓" : ""}</span>{s.text}</li>)}
            <li className={saved && t >= 30 ? "on" : ""}><span className="ck">{saved && t >= 30 ? "✓" : ""}</span>{err ? `Not saved: ${err}` : "Plan saved"}</li>
          </ol>
          {!ready && <div className="pb-progress"><div className="bar"><i style={{ width: `${pct}%` }} /></div><span className="muted small">{shown < N ? `Placing week ${Math.max(1, shown)} of ${N}` : "Checking the ramp"} · {pct}%</span></div>}
          {ready && (
            <div className="pb-ready">
              <div className="tiles">
                <div><span className="k">Weeks</span><b>{N}</b></div>
                <div><span className="k">Sessions</span><b>{summary.sessions}</b></div>
                <div><span className="k">Peak week</span><b>{fmtH(summary.peakHours)}</b></div>
                {summary.longest.ride > 0 && <div><span className="k">Longest ride</span><b>{hm(summary.longest.ride)}</b></div>}
                {summary.longest.run > 0 && <div><span className="k">Longest run</span><b>{hm(summary.longest.run)}</b></div>}
                {summary.longest.swim > 0 && <div><span className="k">Longest swim</span><b>{hm(summary.longest.swim)}</b></div>}
              </div>
              <button type="button" className="btn" onClick={onOpen}>Open the plan</button>
            </div>
          )}
        </div>
        <div className="pb-build-right">
          <RampBuild summary={summary} shown={shown} />
        </div>
      </section>
    </div>
  );
}

const hm = (h: number) => { const m = Math.round(h * 60 / 5) * 5; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };

/** Weekly hours drawn in one bar at a time, phase brackets on top, race flag at the end. */
function RampBuild({ summary, shown }: { summary: PlanSummary; shown: number }) {
  const [svgRef, W] = useWidth<SVGSVGElement>(760); const H = 340, L = 40, R = 16, T = 54, B = 34;
  const N = summary.weeks;
  const maxH = Math.max(1, ...summary.hours);
  const x = (i: number) => L + (i / N) * (W - L - R);
  const bw = (W - L - R) / N;
  const y = (h: number) => T + (1 - h / maxH) * (H - T - B);
  const ticks = [maxH, maxH / 2];
  return (
    <svg ref={svgRef} className="chart pb-ramp" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weekly hours being laid out">
      {summary.phases.filter((p) => p.from <= shown).map((p) => { const label = p.name.split(" — ")[0]; const x0 = x(p.from - 1) + 2, x1 = x(p.to) - 2; return <g key={p.name} className="ph"><line x1={x0} y1={T - 22} x2={x(Math.min(p.to, shown)) - 2} y2={T - 22} stroke="var(--line)" strokeWidth={2} />{x1 - x0 >= label.length * 6.5 && <text x={(x0 + x1) / 2} y={T - 28} textAnchor="middle" fontWeight={600} fill="var(--ink-2)">{label}</text>}</g>; })}
      {ticks.map((h) => <g key={h}><line x1={L} y1={y(h)} x2={W - R} y2={y(h)} stroke="var(--grid)" /><text x={L - 6} y={y(h) + 4} textAnchor="end">{h.toFixed(0)} h</text></g>)}
      <line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke="var(--line)" />
      {summary.hours.map((h, i) => {
        if (i >= shown) return null;
        const last = i === N - 1;
        const fill = last ? "var(--accent)" : i + 1 >= summary.phases.find((p) => p.name.startsWith("Taper"))!.from ? "var(--swim)" : "var(--bike)";
        return <rect key={i} className="bar" x={x(i) + 1} y={y(h)} width={Math.max(1, bw - 2)} height={y(0) - y(h)} rx={2} fill={fill} opacity={i === shown - 1 ? 1 : 0.85}><title>{`Week ${i + 1} · ${h.toFixed(1)} h`}</title></rect>;
      })}
      {shown >= N && <g><line x1={x(N - 0.5)} y1={y(0) + 4} x2={x(N - 0.5)} y2={T - 6} stroke="var(--accent)" strokeDasharray="3 3" /><text x={x(N - 0.5) - 6} y={y(0) - 6} textAnchor="end" fontWeight={700} fill="var(--accent)">RACE</text></g>}
      {Array.from({ length: N }, (_, i) => i).filter((i) => i % Math.max(1, Math.ceil(N / 10)) === 0).map((i) => <text key={i} x={x(i) + bw / 2} y={H - 10} textAnchor="middle">W{i + 1}</text>)}
      {shown > 0 && shown <= N && <text x={x(shown - 1) + bw / 2} y={y(summary.hours[shown - 1]) - 6} textAnchor="middle" fontWeight={600} fill="var(--ink)">{summary.hours[shown - 1].toFixed(1)}</text>}
    </svg>
  );
}
