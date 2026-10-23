"use client";
import { useState } from "react";
import { Icon } from "../icons";
import { useNutrition } from "@/lib/nutrition/store";
import { GRADE_LABEL, NO_EVIDENCE, SUPPLEMENTS, type Grade, type Supplement } from "@/lib/nutrition/supplements";

type Filter = "all" | Grade;

/** Evidence-graded cards; each opens into the full explanation with the studies. */
export function Supplements() {
  const nut = useNutrition();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const list = SUPPLEMENTS.filter((s) => filter === "all" || s.grade === filter);
  const mine = (id: string) => nut.profile.supplements.some((s) => s.id === id);
  const toggle = (s: Supplement) => (mine(s.id) ? nut.removeSupplement(s.id) : nut.addSupplement({ id: s.id, dose: s.defaultDose, time: s.defaultTime }));
  const openS = open ? SUPPLEMENTS.find((s) => s.id === open) : null;
  return (
    <div className="nu-supplements">
      <p className="muted small">Not medical advice. Use third-party tested products (NSF Certified for Sport, Informed Sport). Grades: IOC consensus (2018), AIS framework.</p>
      <div className="pill-group nu-filter" role="tablist">
        {([["all", "All"], ["A", "Strong evidence"], ["B", "Some evidence"], ["C", "Limited evidence"]] as [Filter, string][]).map(([k, l]) => <button key={k} type="button" className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}
      </div>

      {openS && (
        <section className="card nu-supp-open" aria-label={openS.name}>
          <button className="close" type="button" onClick={() => setOpen(null)} aria-label="Close"><Icon name="close" /></button>
          <div className="top"><h2>{openS.name}</h2><span className={`grade g${openS.grade}`}>{openS.grade} · {GRADE_LABEL[openS.grade]}</span><button type="button" className={`btn small${mine(openS.id) ? " ghost" : ""}`} onClick={() => toggle(openS)}>{mine(openS.id) ? "✓ In my daily list · remove" : "+ Add to my daily list"}</button></div>
          <div className="cols">
            <div>
              <h3>Background</h3><p>{openS.background}</p>
              <h3>How it works</h3><p>{openS.mechanism}</p>
              <h3>What the evidence shows</h3><ul>{openS.benefits.map((b, i) => <li key={i}>{b}</li>)}</ul>
              <h3>Watch out for</h3><ul>{openS.caveats.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </div>
            <div>
              <div className="kv"><span>What it does</span><span>{openS.what}</span><span>Dose</span><span>{openS.dose}</span><span>When</span><span>{openS.when}</span><span>Who</span><span>{openS.who}</span></div>
              <h3>Studies</h3>
              <ol className="studies">{openS.studies.map((st, i) => <li key={i}><b>{st.ref}</b><span>{st.finding}</span></li>)}</ol>
            </div>
          </div>
        </section>
      )}

      <div className="nu-supp-grid">
        {list.map((s) => (
          <article key={s.id} className={`card nu-supp${open === s.id ? " on" : ""}`}>
            <div className="top"><h3>{s.name}</h3><span className={`grade g${s.grade}`}>{s.grade} · {GRADE_LABEL[s.grade]}</span></div>
            <div className="kv"><span>What it does</span><span>{s.what}</span><span>Dose</span><span>{s.dose}</span><span>When</span><span>{s.when}</span><span>Who</span><span>{s.who}</span></div>
            <div className="acts">
              <button type="button" className="linkbtn" onClick={() => { setOpen(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Full explanation and studies →</button>
              <button type="button" className={`btn small${mine(s.id) ? " ghost" : ""}`} onClick={() => toggle(s)}>{mine(s.id) ? "✓ In my list" : "+ Add to my list"}</button>
            </div>
          </article>
        ))}
        {(filter === "all" || filter === "C") && (
          <article className="card nu-supp none">
            <div className="top"><h3>{NO_EVIDENCE.title}</h3><span className="grade gC">C · No evidence</span></div>
            <div className="kv">{NO_EVIDENCE.items.map(([k, v]) => <span key={k} style={{ display: "contents" }}><span>{k}</span><span>{v}</span></span>)}</div>
          </article>
        )}
      </div>
    </div>
  );
}
