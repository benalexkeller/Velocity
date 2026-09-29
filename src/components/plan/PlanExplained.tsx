"use client";
import { usePlan } from "@/lib/store";

export function PlanExplained({ limit }: { limit?: number }) {
  const PHASES = usePlan().phases;
  const phases = limit ? PHASES.slice(0, limit) : PHASES;
  if (!phases.length) return <div className="card muted" style={{ padding: 18, fontSize: 13.5 }}>No plan yet. The coach service that builds a plan from your race and schedule isn't connected; until then, add workouts in the calendar above.</div>;
  return (
    <div className="pe">
      {phases.map((p) => (
        <div key={p.short} className="pe-phase">
          <div className="pe-head">
            <h3>{p.short}</h3>
            <span className="muted">Weeks {p.from}{p.to !== p.from ? ` – ${p.to}` : ""}</span>
          </div>
          <p className="muted">{p.purpose}</p>
          <ol>
            {p.goals.map((g) => (
              <li key={g.n}>
                <span className="n">{g.n}</span>
                <b>{g.title}</b>
                <span className="muted">{g.desc}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
