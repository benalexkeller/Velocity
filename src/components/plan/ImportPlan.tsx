"use client";
// Upload a plan from a spreadsheet: download the template, fill one row per session, drop the file, check the preview, use it.
import { useState } from "react";
import { Icon } from "../icons";
import { usePlan } from "@/lib/store";
import { dateLabel } from "@/lib/format";
import { TEMPLATE_CSV, parsePlanFile, type ImportResult } from "@/lib/plan/importPlan";

export function ImportPlan({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const plan = usePlan();
  const [res, setRes] = useState<ImportResult | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const read = async (f: File | undefined) => {
    if (!f) return;
    setErr(null); setBusy(true); setName(f.name);
    try { setRes(await parsePlanFile(f)); } catch (x) { setErr(x instanceof Error ? x.message : "Could not read the file."); setRes(null); }
    setBusy(false);
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" })); a.download = "velocity-plan-template.csv"; a.click(); URL.revokeObjectURL(a.href); };
  const use = async () => { if (!res?.weeks.length) return; setBusy(true); try { await plan.replacePlan(res.weeks); onDone(); } catch (x) { setErr(x instanceof Error ? x.message : "Could not save."); setBusy(false); } };
  const total = res ? res.weeks.reduce((s, w) => s + w.days.reduce((a, d) => a + (/^Race day/.test(d.text) ? 0 : d.min), 0), 0) / 60 : 0;

  return (
    <div className="pb">
      <div className="pb-head"><div><div className="eyebrow muted">Your plan</div><h1>Upload your own plan</h1></div></div>
      <section className="card pb-card form pb-import">
        <div className="pb-q"><h2>1 · Get the template</h2><span className="hint">One row per session: Date, Sport, Minutes, Description, then Intensity and Phase if you want them. Excel or CSV. Days without a row are rest days.</span></div>
        <div className="row"><button type="button" className="btn ghost" onClick={download}>Download the template (.csv)</button><span className="hint">Open it in Excel or Numbers, fill it in, save as .xlsx or .csv.</span></div>
        <div className="pb-q"><h2>2 · Upload it</h2></div>
        <label className={`pb-drop${drag ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void read(e.dataTransfer.files[0]); }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => void read(e.target.files?.[0])} />
          <Icon name="note" /><b>{name || "Drop the file here or click to choose"}</b><span className="hint">.xlsx, .xls or .csv</span>
        </label>
        {busy && !res && <div className="hint">Reading…</div>}
        {err && <div className="err">{err}</div>}
        {res && (
          <>
            <div className="pb-q"><h2>3 · Check it</h2></div>
            {res.issues.length > 0 && <div className="err">{res.issues.slice(0, 5).join(" · ")}{res.issues.length > 5 ? ` · +${res.issues.length - 5} more` : ""}</div>}
            {res.weeks.length > 0 && (
              <>
                <div className="pb-recap"><ul>
                  <li><b>{res.weeks.length} weeks</b> · {dateLabel(res.weeks[0].start)} → {dateLabel(res.weeks[res.weeks.length - 1].start)} · {res.days} days with a session · {total.toFixed(1)} h in total</li>
                  <li>Phases: {[...new Set(res.weeks.map((w) => w.phase))].join(" · ")}{res.weeks.some((w) => w.race) ? " · race week found" : " · no race day row (add one with Sport = Race)"}</li>
                </ul></div>
                <table className="tbl small pb-preview">
                  <thead><tr><th>Week</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th></tr></thead>
                  <tbody>{res.weeks.slice(0, 6).map((w) => <tr key={w.week}><td><b>W{w.week}</b><br /><span className="muted">{w.start.slice(5)}</span></td>{w.days.map((d, i) => <td key={i} className={d.min ? "" : "muted"}>{d.min ? `${d.text.split(" — ")[0].split(" (")[0]}` : "Rest"}</td>)}</tr>)}</tbody>
                </table>
                {res.weeks.length > 6 && <span className="hint">…and {res.weeks.length - 6} more weeks.</span>}
              </>
            )}
          </>
        )}
        <div className="row pb-nav"><button type="button" className="btn ghost" onClick={onBack}><Icon name="back" />Back to the questions</button><span className="grow" /><button type="button" className="btn" disabled={!res?.weeks.length || busy} onClick={use}>Use this plan<Icon name="arrow" /></button></div>
      </section>
    </div>
  );
}
