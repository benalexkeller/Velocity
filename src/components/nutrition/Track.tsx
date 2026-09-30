"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { useNutrition, type DaySummary } from "@/lib/nutrition/store";
import { usePlan } from "@/lib/store";
import { MEALS, type LogEntry, type Meal } from "@/lib/nutrition/types";
import { SUPPLEMENT_MAP } from "@/lib/nutrition/supplements";
import { addDays, dateLabel, fromYmd, shortDate, today, ymd } from "@/lib/format";
import { AddPanel } from "./AddPanel";

const fmt = (n: number, d = 0) => n.toLocaleString(undefined, { maximumFractionDigits: d });
// used only to decide which meal counts as "before" and "after" a session; never shown
const MEAL_SLOT: Record<Meal, string> = { breakfast: "08:00", lunch: "13:00", dinner: "19:30", other: "99:99" };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Track() {
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(ymd(today()));
  return view === "day" ? <DayView date={date} setDate={setDate} setView={setView} /> : <WeekView date={date} setDate={setDate} setView={setView} />;
}

function Toggle({ view, setView }: { view: "day" | "week"; setView: (v: "day" | "week") => void }) {
  return <div className="pill-group" role="tablist"><button type="button" className={view === "day" ? "on" : ""} onClick={() => setView("day")}>Day</button><button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>Week</button></div>;
}

function Bar({ v, t, color }: { v: number; t: number; color?: string }) { return <div className="nu-bar"><i style={{ width: `${Math.min(100, t ? (v / t) * 100 : 0)}%`, background: color }} /></div>; }

// ---------- day ----------
function DayView({ date, setDate, setView }: { date: string; setDate: (d: string) => void; setView: (v: "day" | "week") => void }) {
  const nut = useNutrition();
  const plan = usePlan();
  const d = nut.day(date);
  const t = d.targets;
  const [adding, setAdding] = useState<Meal | null>(null);
  const active = d.sessions.filter((s) => s.sport !== "rest");
  const isToday = date === ymd(today());
  const bottles = d.drinks_ml / nut.profile.bottle_ml;
  const bottleTarget = Math.ceil(t.fluid_ml / nut.profile.bottle_ml);

  // carbohydrate timing: the meal before the first session, the meal after, the rest
  const timing = useMemo(() => {
    if (!active.length) return null;
    const first = active[0], fuel = nut.fuelFor(first);
    const start = first.start ?? "06:30";
    const meals = (["breakfast", "lunch", "dinner"] as Meal[]);
    const before = meals.filter((m) => MEAL_SLOT[m] < start).pop();
    const after = meals.find((m) => MEAL_SLOT[m] >= start);
    const carbs = (m?: Meal) => (m ? d.entries.filter((e) => e.meal === m).reduce((a, e) => a + e.carbs_g, 0) : 0);
    const b = carbs(before), a = carbs(after);
    const other = d.totals.carbs - b - a;
    return { fuel, rows: [["Before session", fuel.before, b], ["After session", fuel.after.carbs, a], ["Other meals", Math.max(0, t.carbs - fuel.before - fuel.after.carbs), other]] as [string, number, number][] };
  }, [active, d, nut, t.carbs]);

  return (
    <>
      <div className="nu-daynav">
        <button type="button" className="back" aria-label="Previous day" onClick={() => setDate(ymd(addDays(fromYmd(date), -1)))}><Icon name="back" /></button>
        <div className="lbl"><b>{dateLabel(date)}</b></div>
        <button type="button" className="back" aria-label="Next day" onClick={() => setDate(ymd(addDays(fromYmd(date), 1)))}><Icon name="chevron" /></button>
        <Toggle view="day" setView={setView} />
        {!isToday && <button type="button" className="btn ghost small" onClick={() => setDate(ymd(today()))}>Today</button>}
      </div>

      <section className="card nu-targets" aria-label="Today's targets">
        <div className="big" title={`${fmt(t.kcal)} kcal = ${nut.profile.base_kcal != null ? `${fmt(t.base)} (your rest-day number)` : `${fmt(t.bmr)} resting × 1.4`}${t.training ? ` + ${fmt(t.training)} training` : ""}${t.goalAdj ? ` ${t.goalAdj > 0 ? "+" : "−"} ${fmt(Math.abs(t.goalAdj))} goal` : ""}`}><div className="k">Calories</div><div className="v"><b>{fmt(d.totals.kcal)}</b> / {fmt(t.kcal)} kcal</div><Bar v={d.totals.kcal} t={t.kcal} /><div className="u">{d.totals.kcal <= t.kcal ? `${fmt(t.kcal - d.totals.kcal)} remaining` : `${fmt(d.totals.kcal - t.kcal)} over`}</div></div>
        <div><div className="k">Carbs</div><div className="v"><b>{fmt(d.totals.carbs)}</b> / {fmt(t.carbs)} g</div><Bar v={d.totals.carbs} t={t.carbs} /><div className="u">{fmt(Math.max(0, t.carbs - d.totals.carbs))} g remaining</div></div>
        <div><div className="k">Protein</div><div className="v"><b>{fmt(d.totals.protein)}</b> / {fmt(t.protein)} g</div><Bar v={d.totals.protein} t={t.protein} color="var(--ink)" /><div className="u">{fmt(Math.max(0, t.protein - d.totals.protein))} g remaining</div></div>
        <div><div className="k">Fat</div><div className="v"><b>{fmt(d.totals.fat)}</b> / {fmt(t.fat)} g</div><Bar v={d.totals.fat} t={t.fat} color="var(--swim)" /><div className="u">{fmt(Math.max(0, t.fat - d.totals.fat))} g remaining</div></div>
        <div><div className="k">Hydration</div><div className="v"><b>{(d.drinks_ml / 1000).toFixed(1)}</b> / {(t.fluid_ml / 1000).toFixed(1)} L</div><Bar v={d.drinks_ml} t={t.fluid_ml} /><div className="u">{fmt(bottles, 1)} of {bottleTarget} bottles</div></div>
      </section>

      <div className="nu-cols">
        <section className="card nu-timeline" aria-label="Daily timeline">
          <div className="hd"><h2>Daily timeline</h2><span className="grow" /><button type="button" className="btn" onClick={() => setAdding("lunch")}><Icon name="plus" />Log meal</button></div>
          <div className="nu-tl">
            {active.map((s) => (
              <Link key={s.id} href={`/plan?session=${s.id}`} className="nu-tl-session">
                <SportIcon sport={s.sport} size={20} /><b>{s.title} {s.intensity !== "Aerobic" ? s.intensity.toLowerCase() : ""}</b><span className="muted">{s.min} min · {s.text}</span><span className="grow" /><span className="link">View workout →</span>
              </Link>
            ))}
            {MEALS.map((m) => <MealCard key={m.k} meal={m.k} entries={nut.entriesFor(date, m.k)} onAdd={() => setAdding(m.k)} onRemove={nut.removeEntry} />)}
          </div>
        </section>

        <div className="nu-side">
          {timing && (
            <section className="card nu-carbgoal" aria-label="Carbohydrate goal">
              <div className="k">Today's carbohydrate goal</div>
              <div className="v"><b>{fmt(t.carbs)} g</b> target</div>
              <div className="u">Based on {nut.profile.weight_kg ?? 75} kg · {t.dayType} day · {t.carbsPerKg} g/kg</div>
              <Bar v={d.totals.carbs} t={t.carbs} />
              <div className="u">{fmt(d.totals.carbs)} g consumed · {fmt(Math.max(0, t.carbs - d.totals.carbs))} g remaining</div>
              <div className="k" style={{ marginTop: 12 }}>Carbohydrate timing</div>
              <div className="nu-timing">
                {timing.rows.map(([label, target, got]) => <div key={label}><span>{label}</span><span className="muted">{target ? `${fmt(target)} g target` : "no target"}</span><Bar v={got} t={target || 1} /><b>{fmt(got)} g</b></div>)}
              </div>
              <div className="u" style={{ marginTop: 8 }}>{timing.fuel.perHour ? `During the session: ${timing.fuel.perHour} g/h, log it under Other. ` : "During the session: water is enough. "}After: {timing.fuel.after.carbs ? `${timing.fuel.after.carbs} g carbs + ${timing.fuel.after.protein} g protein ${timing.fuel.window}.` : `${timing.fuel.after.protein} g protein at the next meal.`}</div>
            </section>
          )}

          <section className="card nu-hydration" aria-label="Hydration">
            <div className="hd"><div className="k">Hydration</div><span className="v"><b>{(d.drinks_ml / 1000).toFixed(1)}</b> / {(t.fluid_ml / 1000).toFixed(1)} L</span></div>
            <Bar v={d.drinks_ml} t={t.fluid_ml} />
            <div className="nu-bottles">{Array.from({ length: Math.max(bottleTarget, Math.ceil(bottles)) }, (_, i) => <i key={i} className={i < Math.floor(bottles) ? "full" : i < bottles ? "half" : ""} title={`${nut.profile.bottle_ml} ml`} />)}</div>
            <div className="row">
              <button type="button" className="btn ghost small" onClick={() => nut.addDrink(date, nut.profile.bottle_ml)}>+ 1 bottle ({nut.profile.bottle_ml} ml)</button>
              <button type="button" className="btn ghost small" onClick={() => nut.addDrink(date, 250)}>+ 250 ml</button>
              {nut.drinksFor(date).length > 0 && <button type="button" className="btn ghost small" onClick={() => { const last = nut.drinksFor(date).slice(-1)[0]; if (last) nut.removeDrink(last.id); }}>Undo</button>}
            </div>
            <div className="u">Target {(t.fluid_ml / 1000).toFixed(1)} L = 35 ml/kg + 0.5 L per training hour. Drinks in food entries (milk, juice, sports drink) are not counted here.</div>
          </section>

          <section className="card nu-supps" aria-label="Supplements today">
            <div className="hd"><div className="k">Supplements</div><span className="muted small">{nut.profile.supplements.filter((s) => nut.takenOn(date, s.id)).length} / {nut.profile.supplements.length}</span></div>
            {nut.profile.supplements.length ? nut.profile.supplements.map((s) => { const at = nut.takenOn(date, s.id); return (
              <label key={s.id} className={`row${at ? " on" : ""}`}><input type="checkbox" checked={!!at} onChange={() => nut.toggleTaken(date, s.id)} /><b>{SUPPLEMENT_MAP[s.id]?.name ?? s.id}</b><span className="muted">{s.dose}</span><span className="grow" /><span className="muted small">{at ? `Taken ${at}` : s.time}</span></label>
            ); }) : <div className="muted small">None picked. Add them from the Supplements tab.</div>}
          </section>
        </div>
      </div>
      {adding && <AddPanel date={date} meal={adding} onClose={() => setAdding(null)} onMeal={setAdding} onDate={setDate} />}
      {adding && <div className="nu-scrim" onClick={() => setAdding(null)} />}
    </>
  );
}

function MealCard({ meal, entries, onAdd, onRemove }: { meal: Meal; entries: LogEntry[]; onAdd: () => void; onRemove: (id: string) => void }) {
  const label = MEALS.find((m) => m.k === meal)!.label;
  const tot = entries.reduce((a, e) => ({ kcal: a.kcal + e.kcal, c: a.c + e.carbs_g, p: a.p + e.protein_g, f: a.f + e.fat_g }), { kcal: 0, c: 0, p: 0, f: 0 });
  return (
    <div className="nu-meal">
      <div className="body">
        <div className="mh"><b>{label}</b>{meal === "other" && <span className="muted small">snacks, drinks, fuel during sessions</span>}{entries.length > 0 && <span className="tot"><b>{fmt(tot.kcal)} kcal</b><span>{fmt(tot.c)} g carbs</span><span>{fmt(tot.p)} g protein</span><span>{fmt(tot.f)} g fat</span></span>}</div>
        {entries.map((e) => (
          <div key={e.id} className="row">
            <span className="n">{e.name}{e.brand ? <small> · {e.brand}</small> : null}{e.source === "quick" && <small> · estimate</small>}</span>
            <span className="a muted">{e.unit ?? (e.amount ? `${fmt(e.amount)} g` : "")}</span>
            <span className="num">{fmt(e.kcal)}</span><span className="num">{e.source === "quick" ? "—" : fmt(e.carbs_g)}</span><span className="num">{e.source === "quick" ? "—" : fmt(e.protein_g)}</span><span className="num">{e.source === "quick" ? "—" : fmt(e.fat_g)}</span>
            <button type="button" className="x" aria-label="Remove" onClick={() => onRemove(e.id)}>×</button>
          </div>
        ))}
        {entries.length > 0 && <div className="row head"><span /><span /><span className="num">kcal</span><span className="num">carbs</span><span className="num">protein</span><span className="num">fat</span><span /></div>}
        <button type="button" className="linkbtn" onClick={onAdd}>+ Add food</button>
      </div>
    </div>
  );
}

// ---------- week ----------
function WeekView({ date, setDate, setView }: { date: string; setDate: (d: string) => void; setView: (v: "day" | "week") => void }) {
  const nut = useNutrition();
  const plan = usePlan();
  const d = fromYmd(date);
  const mon = addDays(d, -((d.getDay() + 6) % 7));
  const days = nut.week(ymd(mon));
  const wk = plan.weekOf(mon);
  const logged = days.filter((x) => x.logged);
  const avg = logged.length ? logged.reduce((a, x) => a + x.totals.kcal, 0) / logged.length : 0;
  const avgT = days.reduce((a, x) => a + x.targets.kcal, 0) / 7;
  const macroK = logged.reduce((a, x) => ({ c: a.c + x.totals.carbs * 4, p: a.p + x.totals.protein * 4, f: a.f + x.totals.fat * 9 }), { c: 0, p: 0, f: 0 });
  const macroTot = macroK.c + macroK.p + macroK.f || 1;
  const onTarget = logged.filter((x) => Math.abs(x.totals.kcal - x.targets.kcal) <= x.targets.kcal * 0.1).length;
  const W = 760, H = 260, L = 44, R = 12, T = 30, B = 40;
  const max = Math.max(1000, ...days.map((x) => Math.max(x.totals.kcal, x.targets.kcal))) * 1.08;
  const y = (v: number) => H - B - (v / max) * (H - T - B);
  const gw = (W - L - R) / 7, bw = gw * 0.5;
  const step = max > 4000 ? 1000 : 750;
  const ticks: number[] = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const sessionName = (x: DaySummary) => { const a = x.sessions.filter((s) => s.sport !== "rest"); return a.length ? a.map((s) => `${s.title}${s.intensity !== "Aerobic" && s.intensity !== "Zone 2" ? ` ${s.intensity.toLowerCase()}` : ""}`).join(" + ") : "Rest"; };
  return (
    <>
      <div className="nu-daynav">
        <button type="button" className="back" aria-label="Previous week" onClick={() => setDate(ymd(addDays(mon, -7)))}><Icon name="back" /></button>
        <div className="lbl"><b>{dateLabel(ymd(mon))} – {dateLabel(ymd(addDays(mon, 6)))}</b></div>
        <button type="button" className="back" aria-label="Next week" onClick={() => setDate(ymd(addDays(mon, 7)))}><Icon name="chevron" /></button>
        <Toggle view="week" setView={setView} />
      </div>
      <div className="nu-cols week">
        <section className="card nu-weekchart" aria-label="Week intake vs target">
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calories per day by macronutrient with the daily target">
            {ticks.map((v) => <g key={v}><line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>)}
            {days.map((x, i) => {
              const cx = L + i * gw + gw / 2;
              const c = x.totals.carbs * 4, p = x.totals.protein * 4, f = x.totals.fat * 9, other = Math.max(0, x.totals.kcal - c - p - f);
              const segs: [number, string][] = [[c, "var(--accent)"], [p, "#0E2E8A"], [f, "#A5C7FD"], [other, "var(--track)"]];
              let acc = 0;
              return (
                <g key={x.date} onClick={() => { setDate(x.date); setView("day"); }} style={{ cursor: "pointer" }}>
                  <text x={cx} y={T - 12} textAnchor="middle" fontSize="10" fill="var(--muted)">{sessionName(x)}</text>
                  <rect x={cx - bw / 2 - 4} y={y(x.targets.kcal)} width={bw + 8} height={Math.max(0, y(0) - y(x.targets.kcal))} fill="none" stroke="var(--muted-2)" strokeDasharray="4 3" rx={3} />
                  {segs.map(([v, col], k) => { const el = v > 0 ? <rect key={k} x={cx - bw / 2} y={y(acc + v)} width={bw} height={Math.max(0, y(0) - y(v))} fill={col} rx={k === 3 ? 2 : 0} /> : null; acc += v; return el; })}
                  <text x={cx} y={H - 22} textAnchor="middle" fontWeight={x.date === ymd(today()) ? 600 : undefined}>{DAYS[i]}</text>
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{shortDate(x.date)}</text>
                </g>
              );
            })}
          </svg>
          <div className="lgd"><span><i style={{ background: "var(--accent)" }} />Carbohydrate (kcal)</span><span><i style={{ background: "#0E2E8A" }} />Protein (kcal)</span><span><i style={{ background: "#A5C7FD" }} />Fat (kcal)</span><span><i style={{ background: "var(--track)" }} />Estimate, no breakdown</span><span><i className="dash" />Target (kcal)</span></div>
        </section>
        <section className="card nu-weekside" aria-label="Week summary">
          <div className="k">Average</div><div className="v"><b>{fmt(avg)} kcal</b> · target {fmt(avgT)}</div><div className="u">{logged.length} of 7 days logged</div>
          {[["Carbs", macroK.c, "var(--accent)"], ["Protein", macroK.p, "#0E2E8A"], ["Fat", macroK.f, "#A5C7FD"]].map(([k, v, col]) => <div key={k as string} className="pct"><span>{k}</span><b>{logged.length ? Math.round(((v as number) / macroTot) * 100) : 0}%</b><Bar v={v as number} t={macroTot} color={col as string} /></div>)}
          <div className="k" style={{ marginTop: 14 }}>Days on target</div><div className="v"><b>{onTarget} of {logged.length}</b></div><div className="u">within ±10% of the day's calorie target</div>
        </section>
      </div>
      <section className="card nu-weektable" aria-label="Week by day">
        <table className="tbl small">
          <thead><tr><th>Day</th><th>Session</th><th className="num">Calories<small>kcal</small></th><th className="num">Target<small>kcal</small></th><th className="num">Carbs<small>g</small></th><th className="num">Protein<small>g</small></th><th className="num">Fat<small>g</small></th><th className="num">Sodium<small>mg</small></th><th className="num">Fluid<small>L</small></th></tr></thead>
          <tbody>
            {days.map((x, i) => <tr key={x.date} className={`row${x.date === ymd(today()) ? " sel" : ""}`} onClick={() => { setDate(x.date); setView("day"); }}><td>{DAYS[i]} {shortDate(x.date)}</td><td>{sessionName(x)}</td><td className="num">{x.logged ? fmt(x.totals.kcal) : "—"}</td><td className="num muted">{fmt(x.targets.kcal)}</td><td className="num">{x.logged ? fmt(x.totals.carbs) : "—"}</td><td className="num">{x.logged ? fmt(x.totals.protein) : "—"}</td><td className="num">{x.logged ? fmt(x.totals.fat) : "—"}</td><td className="num">{x.logged ? fmt(x.totals.sodium) : "—"}</td><td className="num">{x.drinks_ml ? (x.drinks_ml / 1000).toFixed(1) : "—"}</td></tr>)}
          </tbody>
        </table>
      </section>
    </>
  );
}
