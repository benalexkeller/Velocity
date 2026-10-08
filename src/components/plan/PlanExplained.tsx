"use client";
// Phases of the plan: one row of phase buttons, and the facts of the selected phase, all derived from the
// plan's own sessions (dates, hours, longest sessions, quality sessions, bricks). Works for any plan.
import { addDays, fromYmd, ymd } from "@/lib/format";
import { usePlan } from "@/lib/store";
import { isRaceDay, type Phase, type Session } from "@/lib/data";

// quality = anything above easy: tempo, threshold, intervals, race or IM effort (by intensity label or the session text)
const QUALITY = /tempo|interval|threshold|race pace|race effort|@ ?im\b|im (run )?effort|70\.3 effort|vo2|sweet ?spot/i;
// minutes on the bike: rides, and the ride part of a brick ("Long ride 5:15 + BRICK 0:15")
function bikeMin(s: Session) {
  if (s.sport === "bike") return s.min;
  if (s.sport !== "brick") return 0;
  const m = s.text.match(/(?:ride|bike)\s+(\d+):(\d{2})/i);
  return m ? +m[1] * 60 + +m[2] : Math.round(s.min * 0.8);
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (d: string) => { const x = fromYmd(d); return `${x.getDate()} ${MON[x.getMonth()]}`; };
const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;

function factsOf(p: Phase) {
  const real = (s: Session) => s.sport !== "rest" && !isRaceDay(s.text); // race day itself is not training
  const longest = (sport: string, ss: Session[]) => Math.max(0, ...ss.filter(real).map((s) => (sport === "bike" ? bikeMin(s) : s.sport === sport ? s.min : 0)));
  const first = p.weeks[0], last = p.weeks[p.weeks.length - 1];
  const all = p.weeks.flatMap((w) => w.sessions.filter(real));
  const range = (sport: string) => {
    const a = longest(sport, first.sessions), b = Math.max(...p.weeks.map((w) => longest(sport, w.sessions)));
    if (!b) return null;
    return a && a !== b ? `${hm(a)} → ${hm(b)}` : hm(b);
  };
  const hours = p.weeks.map((w) => w.plannedMin / 60);
  const lo = Math.min(...hours), hi = Math.max(...hours);
  const hard = all.filter((s) => s.intensity === "Tempo" || s.intensity === "Intervals" || s.intensity === "Race" || QUALITY.test(s.text)).length / p.weeks.length;
  const bricks = all.filter((s) => /brick|off the bike/i.test(s.text)).length;
  return {
    dates: `${short(first.start)} – ${short(ymd(addDays(fromYmd(last.start), 6)))}`,
    hours: lo.toFixed(1) === hi.toFixed(1) ? `${hi.toFixed(1)} h` : `${lo.toFixed(1)} – ${hi.toFixed(1)} h`,
    ride: range("bike"), run: range("run"), swim: range("swim"),
    hard: hard ? `${Math.round(hard * 2) / 2} per week` : "none",
    bricks,
    // concrete milestones only (the ones with a number in them)
    milestones: p.goals.map((g) => g.desc).filter((d) => /\d/.test(d)),
  };
}

export function PhaseDetail({ selected, onSelect, onOpenWeek }: { selected: string | null; onSelect: (short: string) => void; onOpenWeek: (week: number) => void }) {
  const plan = usePlan();
  const phases = plan.phases;
  if (!phases.length) return null;
  const cur = plan.currentWeek().week;
  const nowPhase = phases.find((p) => cur >= p.from && cur <= p.to) ?? phases[0];
  const p = phases.find((x) => x.short === selected) ?? nowPhase;
  const f = factsOf(p);
  const isNow = p === nowPhase && cur >= p.from && cur <= p.to;
  const stats: [string, string | null][] = [["Hours per week", f.hours], ["Long ride", f.ride], ["Long run", f.run], ["Long swim", f.swim], ["Quality sessions", f.hard], ["Bricks", f.bricks ? String(f.bricks) : null]];
  return (
    <div className="card phd">
      <div className="pill-group phd-tabs" role="tablist" aria-label="Phases">
        {phases.map((x) => (
          <button key={x.short} type="button" role="tab" aria-selected={x === p} className={x === p ? "on" : ""} onClick={() => onSelect(x.short)}>
            {x.short}{x === nowPhase && cur >= x.from && <i className="now" aria-label="current phase" />}
          </button>
        ))}
      </div>
      <div className="phd-head">
        <b>{p.short}</b>
        <span className="muted">Weeks {p.from}{p.to !== p.from ? `–${p.to}` : ""} · {f.dates}{isNow ? ` · week ${cur - p.from + 1} of ${p.to - p.from + 1}` : ""}</span>
        <button type="button" className="linkbtn" onClick={() => onOpenWeek(isNow ? cur : p.from)}>Open week {isNow ? cur : p.from} →</button>
      </div>
      {p.purpose && <p className="phd-purpose">{p.purpose}</p>}
      <dl className="phd-stats">
        {stats.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {f.milestones.length > 0 && <ul className="phd-ms">{f.milestones.map((m) => <li key={m}>{m}</li>)}</ul>}
    </div>
  );
}
