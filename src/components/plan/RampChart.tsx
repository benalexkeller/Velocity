"use client";
import { plannedByDiscipline, sumH, type Week } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { useWidth } from "@/lib/ticks";

/** Weekly hours: planned hours per week stacked by discipline; the last bar is race day. Phase brackets select a phase. */
export function RampChart({ selected, phase, onPick, onPhase }: { selected?: number | null; phase?: string | null; onPick?: (week: number) => void; onPhase?: (short: string) => void }) {
  const plan = usePlan();
  const WEEKS = plan.weeks;
  const PHASES = plan.phases;
  const ATHLETE = plan.athlete;
  const cur = plan.currentWeek().week;
  const selPhase = selected ? PHASES.find((p) => selected >= p.from && selected <= p.to) : phase ? PHASES.find((p) => p.short === phase) : null;
  const actualOf = (w: Week) => plan.weekStatus(w).bySport;
  const [svgRef, W] = useWidth<SVGSVGElement>(1180); const H = 250, L = 46, R = 40, T = 56, B = 30;
  const n = WEEKS.length; // 33 incl. race week
  const gw = (W - L - R) / (n + 1); // +1 slot for the race bar
  const bw = gw * 0.62;
  const maxH = 16;
  const y = (h: number) => H - B - (h / maxH) * (H - T - B);
  const rs = ATHLETE.raceSplits;
  const raceTotal = rs.swim + rs.bike + rs.run + rs.transitions;

  const bars = WEEKS.map((w) => ({ w, p: plannedByDiscipline(w), a: actualOf(w) }));
  const x = (i: number) => L + i * gw + (gw - bw) / 2;

  if (!plan.hasPlan) return <div className="card muted" style={{ padding: 18, fontSize: 14 }}>No plan yet.</div>;
  return (
    <div className="ramp-wrap">
    <svg ref={svgRef} className="chart ramp" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Planned weekly training hours by discipline across the plan, ending in the race">
      {/* y axis */}
      <text x={L - 6} y={T - 6} textAnchor="end">Hours</text>
      {[5, 10, 15].map((h) => (
        <g key={h}>
          <line x1={L} y1={y(h)} x2={W - R} y2={y(h)} stroke="var(--grid)" />
          <text x={L - 8} y={y(h) + 4} textAnchor="end">{h}</text>
        </g>
      ))}
      {/* phase brackets */}
      {PHASES.map((p) => {
        const x0 = L + (p.from - 1) * gw + 4, x1 = L + p.to * gw - 4;
        const on = selPhase?.short === p.short;
        return (
          <g key={p.short} style={{ cursor: onPhase || onPick ? "pointer" : undefined }} onClick={() => (onPhase ? onPhase(p.short) : onPick?.(p.from))}>
            {on && <rect x={x0 - 4} y={T - 40} width={x1 - x0 + 8} height={H - B - T + 40} fill="var(--accent-soft)" opacity={0.55} rx={6} />}
            <line x1={x0} y1={T - 20} x2={x1} y2={T - 20} stroke={on ? "var(--accent)" : "var(--line)"} strokeWidth={on ? 2 : 1} />
            <line x1={x0} y1={T - 26} x2={x0} y2={T - 20} stroke={on ? "var(--accent)" : "var(--line)"} />
            {x1 - x0 >= p.short.length * 6.5 && <text x={(x0 + x1) / 2} y={T - 30} textAnchor="middle" className={on ? "accent" : "ink"} fontWeight={600} fontSize="12">{p.short}</text>}
            {x1 - x0 >= 60 && <text x={(x0 + x1) / 2} y={T - 17 + 12} textAnchor="middle">Weeks {p.from}{p.to !== p.from ? ` – ${p.to}` : ""}</text>}
            <title>{`${p.name} · weeks ${p.from}${p.to !== p.from ? `–${p.to}` : ""}`}</title>
          </g>
        );
      })}
      {/* bars */}
      {bars.map(({ w, p, a }, i) => {
        const isCur = w.week === cur, done = w.week < cur, isSel = w.week === selected;
        const stack = done ? a : p;
        const total = sumH(stack);
        let acc = 0;
        const segs = [["run", stack.run, "var(--run)"], ["bike", stack.bike, "var(--bike)"], ["swim", stack.swim, "var(--swim)"]] as const;
        return (
          <g key={w.week} opacity={done || isCur ? 1 : 0.9} style={{ cursor: onPick ? "pointer" : undefined }} onClick={() => onPick?.(w.week)}>
            <rect x={x(i) - (gw - bw) / 2} y={T - 8} width={gw} height={H - B - T + 8} fill="transparent" />
            {isSel && !isCur && <rect x={x(i) - 3} y={y(Math.max(total, 0.5)) - 3} width={bw + 6} height={y(0) - y(Math.max(total, 0.5)) + 6} fill="none" stroke="var(--ink)" strokeWidth={1.5} rx={4} />}
            {segs.map(([k, h, col]) => {
              const y1 = y(acc + h), y0 = y(acc);
              acc += h;
              return h > 0 ? <rect key={k} x={x(i)} y={y1} width={bw} height={Math.max(0, y0 - y1 - 1)} fill={col} rx={1.5} /> : null;
            })}
            {isCur && (
              <>
                <rect x={x(i) - 3} y={y(total) - 3} width={bw + 6} height={y(0) - y(total) + 6} fill="none" stroke="var(--accent)" strokeWidth={1.5} rx={4} />
                <line x1={x(i) + bw / 2} y1={y(total) - 4} x2={x(i) + bw / 2} y2={y(total) - 16} stroke="var(--accent)" />
                <circle cx={x(i) + bw / 2} cy={y(total) - 17} r={3} fill="var(--accent)" />
                <text x={x(i) + bw / 2} y={y(total) - 23} textAnchor="middle" className="accent" fontWeight={700}>NOW</text>
              </>
            )}
            <text x={x(i) + bw / 2} y={H - 10} textAnchor="middle" className={isSel ? "ink" : undefined} fontWeight={isSel ? 700 : undefined}>{w.week}</text>
          </g>
        );
      })}
      {/* race bar */}
      {(() => {
        const i = n;
        let acc = 0;
        const segs = [["run", rs.run, "var(--run)"], ["bike", rs.bike, "var(--bike)"], ["swim", rs.swim, "var(--swim)"], ["t", rs.transitions, "var(--muted-2)"]] as const;
        return (
          <g>
            <line x1={x(i) + bw / 2} y1={T - 8} x2={x(i) + bw / 2} y2={y(0)} stroke="var(--accent)" strokeDasharray="3 3" />
            {segs.map(([k, h, col]) => {
              const y1 = y(acc + h), y0 = y(acc);
              acc += h;
              return <rect key={k} x={x(i)} y={y1} width={bw} height={Math.max(0, y0 - y1 - 1)} fill={col} opacity={0.35} rx={1.5} />;
            })}
            <circle cx={x(i) + bw / 2} cy={T - 8} r={3} fill="var(--accent)" />
            <text x={x(i) + bw / 2} y={T - 30} textAnchor="middle" className="accent" fontWeight={700} fontSize="12">RACE</text>
            <text x={x(i) + bw / 2} y={T - 17} textAnchor="middle" className="accent" fontWeight={700}>{formatH(raceTotal)}</text>
          </g>
        );
      })()}
    </svg>
    </div>
  );
}
function formatH(h: number) { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${H}:${String(M).padStart(2, "0")}`; }
