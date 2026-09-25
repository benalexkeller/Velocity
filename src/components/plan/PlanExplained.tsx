import { PHASES } from "@/lib/data";

export function PlanExplained({ limit }: { limit?: number }) {
  const phases = limit ? PHASES.slice(0, limit) : PHASES;
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
