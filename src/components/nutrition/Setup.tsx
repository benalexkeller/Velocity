"use client";
import { useState } from "react";
import { useNutrition } from "@/lib/nutrition/store";
import { usePlan } from "@/lib/store";
import { SUPPLEMENTS, GRADE_LABEL } from "@/lib/nutrition/supplements";
import type { Goal, SupplementPick } from "@/lib/nutrition/types";

const BOTTLES = [500, 600, 750, 1000];
const kgToLb = (kg: number) => kg * 2.20462, lbToKg = (lb: number) => lb / 2.20462;
const cmToIn = (cm: number) => cm / 2.54, inToCm = (i: number) => i * 2.54;

/** First-use pop-up: body data, goal, bottle size, supplements. Also the "Edit" form on the Guide tab. */
export function NutritionSetup({ onDone, edit = false }: { onDone: () => void; edit?: boolean }) {
  const nut = useNutrition();
  const plan = usePlan();
  const imperial = plan.athlete.units === "imperial";
  const p = nut.profile;
  const [wUnit, setWUnit] = useState<"kg" | "lb">(imperial ? "lb" : "kg");
  const [weight, setWeight] = useState(p.weight_kg ? String(Math.round(imperial ? kgToLb(p.weight_kg) : p.weight_kg)) : "");
  const [hUnit, setHUnit] = useState<"cm" | "in">(imperial ? "in" : "cm");
  const [height, setHeight] = useState(p.height_cm ? String(Math.round(imperial ? cmToIn(p.height_cm) : p.height_cm)) : "");
  const [birth, setBirth] = useState(p.birth_year ? String(p.birth_year) : "");
  const [sex, setSex] = useState<"male" | "female" | "">(p.sex === "male" || p.sex === "female" ? p.sex : "");
  const [goal, setGoal] = useState<Goal>(p.goal);
  const [goalW, setGoalW] = useState(p.goal_weight_kg ? String(Math.round(imperial ? kgToLb(p.goal_weight_kg) : p.goal_weight_kg)) : "");
  const [bottle, setBottle] = useState<number>(p.bottle_ml);
  const [custom, setCustom] = useState(BOTTLES.includes(p.bottle_ml) ? "" : String(p.bottle_ml));
  const [picks, setPicks] = useState<SupplementPick[]>(p.supplements);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) => {
    const s = SUPPLEMENTS.find((x) => x.id === id)!;
    setPicks((cur) => (cur.some((x) => x.id === id) ? cur.filter((x) => x.id !== id) : [...cur, { id, dose: s.defaultDose, time: s.defaultTime }]));
  };
  const setPick = (id: string, patch: Partial<SupplementPick>) => setPicks((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const w = parseFloat(weight), h = parseFloat(height), by = parseInt(birth);
    if (!w || w < 30 || w > 250) return setErr("Enter your body weight.");
    const weight_kg = +(wUnit === "lb" ? lbToKg(w) : w).toFixed(1);
    const height_cm = h ? Math.round(hUnit === "in" ? inToCm(h) : h) : null;
    const gw = parseFloat(goalW);
    const bottle_ml = custom ? Math.max(100, parseInt(custom) || 750) : bottle;
    setBusy(true);
    try {
      await nut.saveProfile({ weight_kg, height_cm, birth_year: by && by > 1900 ? by : null, sex: sex || null, goal, goal_weight_kg: goal === "race_weight" && gw ? +(wUnit === "lb" ? lbToKg(gw) : gw).toFixed(1) : null, bottle_ml, supplements: picks, setup_done: true });
      if (!edit) nut.logWeight(new Date().toISOString().slice(0, 10), weight_kg);
      onDone();
    } catch (x) { setErr(x instanceof Error ? x.message : "Could not save."); }
    setBusy(false);
  }

  return (
    <form className="form nu-setup" onSubmit={submit}>
      <section>
        <h3>About you</h3>
        <p className="hint">Calories and carbohydrate targets are computed from these and from each day's training.</p>
        <div className="three">
          <label><b>Body weight</b><span className="unit-in"><input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" required placeholder={wUnit === "lb" ? "165" : "75"} /><span className="units">{(["kg", "lb"] as const).map((u) => <button key={u} type="button" className={wUnit === u ? "on" : ""} onClick={() => { if (u !== wUnit && weight) setWeight(String(Math.round(u === "lb" ? kgToLb(+weight) : lbToKg(+weight)))); setWUnit(u); }}>{u}</button>)}</span></span></label>
          <label><b>Height</b><span className="unit-in"><input value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" placeholder={hUnit === "in" ? "70" : "178"} /><span className="units">{(["cm", "in"] as const).map((u) => <button key={u} type="button" className={hUnit === u ? "on" : ""} onClick={() => { if (u !== hUnit && height) setHeight(String(Math.round(u === "in" ? cmToIn(+height) : inToCm(+height)))); setHUnit(u); }}>{u}</button>)}</span></span></label>
          <label><b>Birth year</b><input value={birth} onChange={(e) => setBirth(e.target.value)} inputMode="numeric" placeholder="1994" /></label>
        </div>
        <label><b>Sex (for the resting-energy formula)</b><div className="days">{([["male", "Male"], ["female", "Female"]] as const).map(([k, l]) => <button key={k} type="button" className={sex === k ? "on" : ""} onClick={() => setSex(k)}>{l}</button>)}</div></label>
      </section>

      <section>
        <h3>Target</h3>
        <div className="days">
          {([["maintain", "Maintain weight"], ["lose", "Lose weight"], ["gain", "Gain weight"], ["race_weight", "Reach a target weight"]] as [Goal, string][]).map(([k, l]) => <button key={k} type="button" className={goal === k ? "on" : ""} onClick={() => setGoal(k)}>{l}</button>)}
        </div>
        {goal === "race_weight" && <div className="two"><label><b>Target weight ({wUnit})</b><input value={goalW} onChange={(e) => setGoalW(e.target.value)} inputMode="decimal" /></label><span className="hint" style={{ alignSelf: "end" }}>{plan.athlete.hasRace ? `Spread out to reach it by race day (${plan.athlete.race.date}).` : "Set your race under Profile so the date is known."}</span></div>}
      </section>

      <section>
        <h3>Your bottle</h3>
        <p className="hint">Drinks are counted in bottles. Pick the one you actually use.</p>
        <div className="days">
          {BOTTLES.map((ml) => <button key={ml} type="button" className={!custom && bottle === ml ? "on" : ""} onClick={() => { setBottle(ml); setCustom(""); }}>{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}</button>)}
          <span className="unit-in small"><input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" placeholder="other" style={{ width: 90 }} /><span className="units"><span>ml</span></span></span>
        </div>
      </section>

      <section>
        <h3>Supplements you take</h3>
        <p className="hint">Optional. Picked ones show as a daily checklist. Grades: A strong evidence · B some · C limited.</p>
        <div className="nu-supp-pick">
          {SUPPLEMENTS.map((s) => {
            const on = picks.find((x) => x.id === s.id);
            return (
              <div key={s.id} className={`row${on ? " on" : ""}`}>
                <label className="chk"><input type="checkbox" checked={!!on} onChange={() => toggle(s.id)} /><b>{s.name}</b><span className={`grade g${s.grade}`} title={GRADE_LABEL[s.grade]}>{s.grade}</span></label>
                {on && <span className="edit"><input value={on.dose} onChange={(e) => setPick(s.id, { dose: e.target.value })} aria-label="Dose" /><select value={on.time} onChange={(e) => setPick(s.id, { time: e.target.value })} aria-label="When">{["morning", "pre-session", "during", "post-session", "evening"].map((t) => <option key={t} value={t}>{t}</option>)}</select></span>}
              </div>
            );
          })}
        </div>
      </section>

      {err && <div className="err">{err}</div>}
      <div className="row"><button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : edit ? "Save changes" : "Save and start tracking"}</button>{!edit && <button type="button" className="btn ghost" onClick={async () => { await nut.saveProfile({ setup_done: true, bottle_ml: bottle }); onDone(); }}>Skip, use defaults</button>}</div>
    </form>
  );
}
