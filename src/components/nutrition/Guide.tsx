"use client";
import { useMemo, useState } from "react";
import { Cubes } from "../Cubes";
import { SportIcon } from "../SportIcon";
import { useNutrition } from "@/lib/nutrition/store";
import { usePlan } from "@/lib/store";
import { bmrOf, stagesOf, nextStage, targetsFor } from "@/lib/nutrition/targets";
import { SUPPLEMENT_MAP } from "@/lib/nutrition/supplements";
import { NUTRITION } from "@/lib/content/nutrition";
import type { Session } from "@/lib/data";
import { addDays, shortDate, today, ymd } from "@/lib/format";
import { NutritionSetup } from "./Setup";
import { WeightChart, ratePerWeek, timelineOf, type WPoint } from "./WeightStages";

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
const kgToLb = (kg: number) => kg * 2.20462;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const mk = (sport: Session["sport"], min: number, intensity: string): Session => ({ id: "x", date: "", dayIndex: 0, min, sport, title: sport, detail: "", text: "", intensity, why: "", status: "planned" });
const GOAL_LABEL = { maintain: "Maintain weight", lose: "Lose weight", gain: "Gain weight", race_weight: "Reach a target weight" } as const;

/** Guide: the nutrition plan on top, then weight and where it is heading, energy needs by day type, this week's fuelling, then the reference topics. */
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
  const tNow = ymd(today());
  const todayTargets = nut.day(tNow).targets;

  // timeline (planned hours per week), the staged weight path, logged weights, projection
  const timeline = useMemo(() => timelineOf(plan, raceDate), [plan, raceDate]);
  const stages = p.goal === "race_weight" ? stagesOf(p, raceDate ?? undefined) : [];
  const next = p.goal === "race_weight" ? nextStage(p, raceDate ?? undefined) : null;
  const path: WPoint[] = p.goal === "race_weight" && current != null ? [{ date: tNow, kg: current, label: "Now", kind: "now" }, ...stages.map((s) => ({ date: s.date, kg: s.weight_kg, label: s.label || "Stage", kind: (s.date === raceDate ? "race" : "stage") as WPoint["kind"] }))] : [];
  const end = raceDate ?? ymd(addDays(today(), 84));
  const projEnd = current != null && proj ? current + proj.kgPerWeek * ((new Date(end).getTime() - today().getTime()) / (7 * 86400000)) : null;
  const projLine = current != null && projEnd != null ? { from: { date: tNow, kg: current }, to: { date: end, kg: projEnd } } : null;
  const needRate = next && current != null ? ratePerWeek({ date: tNow, kg: current }, { date: next.date, kg: next.weight_kg }) : null;
  const rateW = (kgPerWeek: number) => `${kgPerWeek > 0 ? "+" : ""}${imperial ? `${fmt(kgToLb(kgPerWeek), 2)} lb` : `${fmt(kgPerWeek, 2)} kg`}/week`;

  const types: [string, Session[]][] = [["Rest day", []], ["Light (45 min easy)", [mk("run", 45, "Zone 2")]], ["Moderate (2 h)", [mk("bike", 120, "Aerobic")]], ["Long (4 h)", [mk("bike", 240, "Endurance")]]];
  const week = plan.currentWeek();
  const weekSessions = week.sessions.filter((s) => s.sport !== "rest");
  const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const goalText = p.goal === "race_weight" ? (p.goal_weight_kg ? `${showW(p.goal_weight_kg)} by race day` : "target weight not set") : p.goal === "lose" ? "−400 kcal/day" : p.goal === "gain" ? "+300 kcal/day" : "no calorie adjustment";
  const stageText = stages.filter((s) => s.date !== raceDate).map((s) => `${showW(s.weight_kg)} by ${shortDate(s.date)}`).join(" · ");

  return (
    <div className="nu-guide">
      <section className="card nu-plan" aria-label="Your nutrition plan">
        <div className="hd"><div><div className="k">Your nutrition plan</div>{!p.setup_done && <div className="sub muted small">Add your weight to get daily targets.</div>}</div><button type="button" className="btn small" onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit plan"}</button></div>
        {editing ? <NutritionSetup edit onDone={() => setEditing(false)} /> : (
          <div className="grid">
            <div><span className="k">Body</span><b>{p.weight_kg ? showW(p.weight_kg) : "—"}</b><span className="d">{[p.height_cm ? (imperial ? `${Math.round(p.height_cm / 2.54)} in` : `${p.height_cm} cm`) : null, age ? `${age} y` : null, p.sex === "male" ? "male" : p.sex === "female" ? "female" : null].filter(Boolean).join(" · ") || "height, age, sex not set"}</span></div>
            <div><span className="k">Goal</span><b>{GOAL_LABEL[p.goal]}</b><span className="d">{goalText}{stageText ? ` · stages: ${stageText}` : ""}</span></div>
            <div><span className="k">Rest-day calories</span><b>{todayTargets ? `${fmt(todayTargets.base)} kcal` : "—"}</b><span className="d">{!todayTargets ? "add your weight to calculate" : p.base_kcal != null ? "your own number" : `resting ${fmt(bmrOf(p))} kcal × 1.4`}{todayTargets?.goalAdj ? ` · ${todayTargets.goalAdj > 0 ? "+" : ""}${fmt(todayTargets.goalAdj)} kcal today for the goal` : ""}</span></div>
            <div><span className="k">Today</span><b>{todayTargets ? `${fmt(todayTargets.kcal)} kcal` : "—"}</b><span className="d">{todayTargets ? `${fmt(todayTargets.carbs)} g carbs · ${fmt(todayTargets.protein)} g protein · ${fmt(todayTargets.fat)} g fat · ${(todayTargets.fluid_ml / 1000).toFixed(1)} L` : "no targets without a body weight"}</span></div>
            <div><span className="k">Bottle</span><b>{p.bottle_ml >= 1000 ? `${p.bottle_ml / 1000} L` : `${p.bottle_ml} ml`}</b><span className="d" /></div>
            <div><span className="k">Supplements</span><b>{p.supplements.length ? p.supplements.length : "none"}</b><span className="d">{p.supplements.map((s) => `${SUPPLEMENT_MAP[s.id]?.name ?? s.id} ${s.dose} ${s.time}`).join(" · ") || "add from the Supplements tab"}</span></div>
          </div>
        )}
      </section>

      <div className="nu-cols guide">
        <section className="card nu-weight" aria-label="Weight">
          <div className="hd"><div><div className="k">Body weight</div><div className="v"><b>{current != null ? showW(current) : "—"}</b>{next ? <span className="muted"> · next {showW(next.weight_kg)} by {shortDate(next.date)}</span> : p.goal_weight_kg ? <span className="muted"> · target {showW(p.goal_weight_kg)}</span> : null}</div></div>
            <form className="logw" onSubmit={(e) => { e.preventDefault(); const v = parseFloat(wIn); if (!v) return; nut.logWeight(tNow, +(imperial ? v / 2.20462 : v).toFixed(1)); setWIn(""); }}><input value={wIn} onChange={(e) => setWIn(e.target.value)} inputMode="decimal" placeholder={imperial ? "lb" : "kg"} aria-label="Today's weight" /><button type="submit" className="btn small">Log today</button></form>
          </div>
          <WeightChart timeline={timeline} path={path} logged={weights.map((w) => ({ date: w.date, kg: w.weight_kg }))} proj={projLine} imperial={imperial} raceDate={raceDate} />
          <div className="nu-lgd"><span><i className="bar" /> planned hours per week</span>{path.length > 1 && <span><i className="tgt" /> weight targets</span>}<span><i className="dot" /> logged weight</span>{projLine && <span><i className="proj" /> projection</span>}</div>
          <div className="u">
            {next && needRate != null ? <>Next target {showW(next.weight_kg)} by {shortDate(next.date)}: {rateW(needRate)} from today's weight. </> : null}
            {proj ? <>Last 14 logged days: {proj.avgBalance > 0 ? "+" : ""}{fmt(proj.avgBalance)} kcal/day vs target → {rateW(proj.kgPerWeek)}{projEnd != null ? ` → ${showW(projEnd)} by ${raceDate ? "race day" : "12 weeks"}` : ""} if nothing changes. 7,700 kcal ≈ 1 kg.</> : "Projection after three logged days."}
          </div>
        </section>

        <section className="card nu-needs" aria-label="Energy needs">
          <div className="hd"><div className="k">Your energy needs</div></div>
          <table className="tbl small">
            <thead><tr><th>Day type</th><th className="num">kcal</th><th className="num">Carbs g</th><th className="num">Protein g</th><th className="num">Fat g</th><th className="num">Fluid L</th></tr></thead>
            <tbody>{types.map(([label, ss]) => { const t = targetsFor(p, ss, { raceDate: raceDate ?? undefined }); return <tr key={label}><td>{label}</td><td className="num">{t ? fmt(t.kcal) : "—"}</td><td className="num">{t ? fmt(t.carbs) : "—"}</td><td className="num">{t ? fmt(t.protein) : "—"}</td><td className="num">{t ? fmt(t.fat) : "—"}</td><td className="num">{t ? (t.fluid_ml / 1000).toFixed(1) : "—"}</td></tr>; })}</tbody>
          </table>
          <details className="u how"><summary>How targets are calculated</summary>Resting energy {fmt(bmrOf(p))} kcal (Mifflin–St Jeor) × 1.4 for daily life, plus the session's energy (MET × kg × hours){p.goal !== "maintain" ? `, ${p.goal === "gain" ? "plus a surplus to gain" : p.goal === "lose" ? "minus a deficit to lose" : next ? "adjusted to reach the next weight stage by its date" : "adjusted to reach the target weight by race day"}` : ""}. Carbohydrate 3.5 g/kg on rest days, rising with training hours (≈ 6 g/kg for 2 h, ≈ 8.5 g/kg for 4 h, at most 12), 10 g/kg on the two carb-load days before a race; protein 1.7 g/kg (1.9 in Build and Peak, 2.2 in a deficit); fat 0.8–1.2 g/kg. No deficit on long days, in the taper or race week. Fluid 35 ml/kg plus what is drunk during sessions (at most 0.8 L/h).</details>
        </section>
      </div>

      <section className="card nu-weekfuel" aria-label="This week's fuel">
        <div className="hd"><div className="k">This week's fuel · Week {week.week}</div></div>
        {weekSessions.length ? (
          <table className="tbl small">
            <thead><tr><th>Day</th><th>Session</th><th>Before</th><th>During</th><th>After</th></tr></thead>
            <tbody>{weekSessions.map((s) => { const f = nut.fuelFor(s); return <tr key={s.id}><td>{DAYS[s.dayIndex]} {shortDate(s.date)}</td><td><span className="sess"><SportIcon sport={s.sport} size={16} />{s.title} · {s.intensity} · {s.min} min</span></td><td>{f.before ? `${f.before} g carbs, 1–2 h before` : "—"}</td><td>{f.perHour ? `${f.perHour} g/h · ${f.during} g total` : "water"}</td><td>{f.after.carbs ? `${f.after.carbs} g carbs + ${f.after.protein} g protein ${f.window}` : `${f.after.protein} g protein at the next meal`}</td></tr>; })}</tbody>
          </table>
        ) : <div className="muted small">No sessions this week.</div>}
      </section>

      <div className="section-head" style={{ marginTop: 8 }}><h2>Reference</h2><span className="sub">{NUTRITION.length} topics · the numbers behind the targets</span></div>
      <Cubes items={NUTRITION} openId={open} onOpen={(id) => { setOpen(id); if (id) setTimeout(() => document.querySelector(".nu-guide .cube-open")?.scrollIntoView({ block: "start", behavior: "smooth" }), 0); }} columns={4} />
    </div>
  );
}
