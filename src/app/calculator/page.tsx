"use client";
import "./calculator.css";
import { useMemo, useState } from "react";
import { CoachBar } from "@/components/CoachBar";
import { Icon } from "@/components/icons";
import { CALCULATORS } from "@/lib/content/calculators";

// Layout: 1/3 column on the left (search + the list of calculators), 2/3 on the right
// (the chosen calculator: inputs on the left, the result view on the right).
export default function CalculatorPage() {
  const [q, setQ] = useState("");
  const [id, setId] = useState(CALCULATORS[0].id);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return CALCULATORS.filter((c) => !t || c.title.toLowerCase().includes(t) || (c.tag ?? "").toLowerCase().includes(t) || c.summary.toLowerCase().includes(t));
  }, [q]);
  const cur = CALCULATORS.find((c) => c.id === id) ?? CALCULATORS[0];
  return (
    <main className="main">
      <div className="page" style={{ display: "grid", gap: 16, paddingTop: 10 }}>
        <div className="page-head">
          <div>
            <h1>Calculator</h1>
          </div>
        </div>
        <div className="calc-layout">
          <aside className="card calc-side" aria-label="Calculators">
            <label className="search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calculators…" aria-label="Search calculators" /></label>
            <div className="calc-list" role="tablist" aria-orientation="vertical">
              {list.map((c) => (
                <button key={c.id} type="button" role="tab" aria-selected={c.id === cur.id} className={c.id === cur.id ? "on" : ""} onClick={() => setId(c.id)}>
                  <span className="eyebrow muted">{c.tag}</span>
                  <span className="t">{c.title}</span>
                  <span className="s">{c.summary}</span>
                </button>
              ))}
              {!list.length && <div className="muted" style={{ padding: 12 }}>No calculator matches.</div>}
            </div>
          </aside>
          <section className="card calc-main" aria-label={cur.title}>
            <div className="calc-head">
              <div className="eyebrow muted">{cur.tag}</div>
              <h2>{cur.title}</h2>
              <p className="muted">{cur.summary}</p>
            </div>
            <div className="calc-body">{cur.render()}</div>
          </section>
        </div>
        <CoachBar id="calc-coach" />
      </div>
    </main>
  );
}
