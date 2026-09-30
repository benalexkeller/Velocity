"use client";
import { useMemo, useState } from "react";
import { Cubes } from "../Cubes";
import { SportIcon } from "../SportIcon";
import { useNutrition } from "@/lib/nutrition/store";
import { usePlan } from "@/lib/store";
import { bmrOf, targetsFor } from "@/lib/nutrition/targets";
import { NUTRITION } from "@/lib/content/nutrition";
import type { Session } from "@/lib/data";
import { addDays, dateLabel, fromYmd, shortDate, today, ymd } from "@/lib/format";
import { NutritionSetup } from "./Setup";

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const kgToLb = (kg: number) => kg * 2.20462;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mk = (sport: Session["sport"], min: number, intensity: string): Session => ({ id: "x", date: "", dayIndex: 0, min, sport, title: sport, detail: "", text: "", intensity, why: "", status: "planned" });

/** Guide: weight and where it is heading, energy needs by day type, this week's fuelling, then the reference topics. */
export function Guide() {
  const nut = useNutrition();
  const plan = usePlan();
  const imperial = plan.athlete.units === "imperial";
  const showW = (kg: number) => (imperial ? `${fmt(kgToLb(kg), 1)} lb` : `${fmt(kg, 1)} kg`);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [wIn, setWIn] = useState("");
  const p = nut.profile;
  const weights = nut.weights;
  const current = weights.length ? weights[weights.length - 1].weight_kg : p.weight_kg;
  const proj = nut.projection();
  const raceDate = plan.athlete.hasRace ? plan.athlete.race.date : null;

  // chart: logged weights + projection to race day (or 12 weeks) from the average balance
  const chart = useMemo(() => {
    const pts = weights.map((w) => ({ date: w.date, kg: w.weight_kg }));
    const start = pts.length ? fromYmd(pts[0].date) : today();
    const end = raceDate ? fromYmd(raceDate) : addDays(today(), 84);
    const projEnd = current != null && proj ? current + proj.kgPerWeek * ((end.getTime() - today().getTime()) / (7 * 86400000)) : null;
    const W = 720, H = 200, L = 44, R = 16, T = 14, B = 26;
    const all = [...pts.map((q) => q.kg), ...(projEnd != null ? [projEnd] : []), ...(p.goal_weight_kg ? [p.goal_weight_kg] : [])];
    const lo = (all.length ? Math.min(...all) : 70) - 2, hi = (all.length ? Math.max(...all) : 80) + 2;
    const x = (d: Date) => L + ((d.getTime() - start.getTime()) / Math.max(1, end.getTime() - start.getTime())) * (W - L - R);
    const y = (kg: number) => T + ((hi - kg) / (hi - lo)) * (H - T - B);
    return { pts, start, end, projEnd, W, H, L, R, T, B, lo, hi, x, y };
  }, [weights, current, proj, raceDate, p.goal_weight_kg]);

  const types: [string, Session[]][] = [["Rest day", []], ["Light (45 min easy)", [mk("run", 45, "Zone 2")]], ["Moderate (2 h)", [mk("bike", 120, "Aerobic")]], ["Long (4 h)", [mk("bike", 240, "Endurance")]]];
  const week = plan.currentWeek();
  const weekSessions = week.sessions.filter((s) => s.sport !== "rest");

  return (
    <div className="nu-guide">
      <div className="nu-cols guide">
        <section className="card nu-weight" aria-label="Weight">
          <div className="hd"><div><div className="k">Body weight</div><div className="v"><b>{current != null ? showW(current) : "—"}</b>{p.goal_weight_kg ? <span className="muted"> · race weight {showW(p.goal_weight_kg)}</span> : null}</div></div>
            <form className="logw" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(wIn); if (!v) return; nut.logWeight(ymd(today()), +(imperial ? v / 2.20462 : v).toFixed(1)); setWIn(""); }}><input value={wIn} onChange={(e) => setWIn(e.target.value)} inputMode="decimal" placeholder={imperial ? "lb" : "kg"} aria-label="Today's weight" /><button type="submit" className="btn small">Log today</button></form>
          </div>
          <svg className="chart" viewBox={`0 0 ${chart.W} ${chart.H}`} role="img" aria-label="Logged weight and projection">
            {[chart.lo + 1, (chart.lo + chart.hi) / 2, chart.hi - 1].map((v) => <g key={v}><line x1={chart.L} y1={chart.y(v)} x2={chart.W - chart.R} y2={chart.y(v)} stroke="var(--grid)" /><text x={chart.L - 6} y={chart.y(v) + 4} textAnchor="end">{imperial ? fmt(kgToLb(v)) : fmt(v, 1)}</text></g>)}
            {p.goal_weight_kg && <line x1={chart.L} y1={chart.y(p.goal_weight_kg)} x2={chart.W - chart.R} y2={chart.y(p.goal_weight_kg)} stroke="var(--run)" strokeDasharray="4 4" />}
            {chart.pts.length > 1 && <path d={chart.pts.map((q, i) => `${i ? "L" : "M"}${chart.x(fromYmd(q.date))} ${chart.y(q.kg)}`).join("")} fill="none" stroke="var(--accent)" strokeWidth={2} />}
            {chart.pts.map((q) => <circle key={q.date} cx={chart.x(fromYmd(q.date))} cy={chart.y(q.kg)} r={3.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5}><title>{`${dateLabel(q.date)} · ${showW(q.kg)}`}</title></circle>)}
            {current != null && chart.projEnd != null && <line x1={chart.x(today())} y1={chart.y(current)} x2={chart.x(chart.end)} y2={chart.y(chart.projEnd)} stroke="var(--muted-2)" strokeDasharray="3 4" strokeWidth={1.5} />}
            <text x={chart.L} y={chart.H - 8} textAnchor="start">{shortDate(ymd(chart.start))}</text>
            <text x={chart.W - chart.R} y={chart.H - 8} textAnchor="end">{raceDate ? `Race ${shortDate(raceDate)}` : shortDate(ymd(chart.end))}</text>
            {!chart.pts.length && <text x={chart.W / 2} y={chart.H / 2} textAnchor="middle">Log a weight to start the line</text>}
          </svg>
          <div className="u">
            {proj ? <>Last 14 logged days: {proj.avgBalance > 0 ? "+" : ""}{fmt(proj.avgBalance)} kcal/day vs target → about {proj.kgPerWeek > 0 ? "+" : ""}{imperial ? `${fmt(kgToLb(proj.kgPerWeek), 1)} lb` : `${fmt(proj.kgPerWeek, 2)} kg`} per week{chart.projEnd != null ? ` → ${showW(chart.projEnd)} by ${raceDate ? "race day" : "12 weeks"}` : ""} if nothing changes. 7,700 kcal ≈ 1 kg.</> : "After three logged days the projection appears here: average calorie balance per day × days to race ÷ 7,700 kcal per kg."}
          </div>
        </section>

        <section className="card nu-needs" aria-label="Energy needs">
          <div className="hd"><div className="k">Your energy needs</div><button type="button" className="linkbtn" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit body data"}</button></div>
          {editing ? <NutritionSetup edit onDone={() => setEditing(false)} /> : (
            <>
              <table className="tbl small">
                <thead><tr><th>Day type</th><th className="num">kcal</th><th className="num">Carbs g</th><th className="num">Protein g</th><th className="num">Fat g</th><th className="num">Fluid L</th></tr></thead>
                <tbody>{types.map(([label, ss]) => { const t = targetsFor(p, ss, raceDate ?? undefined); return <tr key={label}><td>{label}</td><td className="num">{fmt(t.kcal)}</td><td className="num">{fmt(t.carbs)}</td><td className="num">{fmt(t.protein)}</td><td className="num">{fmt(t.fat)}</td><td className="num">{(t.fluid_ml / 1000).toFixed(1)}</td></tr>; })}</tbody>
              </table>
              <div className="u">Resting energy {fmt(bmrOf(p))} kcal (Mifflin–St Jeor) × 1.4 for daily life, plus the session's energy (MET × kg × hours){p.goal !== "maintain" ? `, ${p.goal === "gain" ? "+300" : p.goal === "lose" ? "−400" : "adjusted for the race weight"} kcal for the goal` : ""}. Carbohydrate 3.5 g/kg on rest days up to 8 g/kg on long days; protein 1.7 g/kg; fat fills the rest, never under 0.8 g/kg. Fluid 35 ml/kg + 0.5 L per training hour.</div>
            </>
          )}
        </section>
      </div>

      <section className="card nu-weekfuel" aria-label="This week's fuel">
        <div className="hd"><div className="k">This week's fuel · Week {week.week}</div><span className="muted small">Before / during / after each session, from your weight and the session's length and intensity.</span></div>
        {weekSessions.length ? (
          <table className="tbl small">
            <thead><tr><th>Day</th><th>Session</th><th>Before</th><th>During</th><th>After</th></tr></thead>
            <tbody>{weekSessions.map((s) => { const f = nut.fuelFor(s); return <tr key={s.id}><td>{DAYS[s.dayIndex]} {shortDate(s.date)}</td><td><span className="sess"><SportIcon sport={s.sport} size={16} />{s.title} · {s.intensity} · {s.min} min</span></td><td>{f.before ? `${f.before} g carbs, 1–2 h before` : "—"}</td><td>{f.perHour ? `${f.perHour} g/h · ${f.during} g total` : "water"}</td><td>{f.after.carbs ? `${f.after.carbs} g carbs + ${f.after.protein} g protein ${f.window}` : `${f.after.protein} g protein at the next meal`}</td></tr>; })}</tbody>
          </table>
        ) : <div className="muted small">No sessions this week.</div>}
      </section>

      <div className="section-head" style={{ marginTop: 8 }}><h2>Reference</h2><span className="sub">{NUTRITION.length} topics · the numbers behind the targets</span></div>
      <Cubes items={NUTRITION} openId={open} onOpen={(id) => { setOpen(id); if (id) window.scrollTo({ top: 0, behavior: "smooth" }); }} columns={4} />
    </div>
  );
}
