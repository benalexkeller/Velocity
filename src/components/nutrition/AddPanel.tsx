"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { useNutrition } from "@/lib/nutrition/store";
import { searchFoods, usdaAvailable } from "@/lib/nutrition/foods";
import { MEALS, scaleM, type Food, type Meal, type Serving } from "@/lib/nutrition/types";
import { DatePicker } from "./DatePicker";

type Mode = "search" | "manual" | "quick";
const fmt = (n: number, d = 0) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : "—");

/** The add panel: search a food, type one in by hand, or give rough numbers for the whole day. */
export function AddPanel({ date, meal, onClose, onMeal, onDate }: { date: string; meal: Meal; onClose: () => void; onMeal: (m: Meal) => void; onDate: (d: string) => void }) {
  const nut = useNutrition();
  const [mode, setMode] = useState<Mode>("search");
  const label = MEALS.find((m) => m.k === meal)?.label ?? "meal";
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <aside className="nu-panel" role="dialog" aria-label={`Add to ${label}`}>
      <div className="nu-panel-head">
        <h2>{mode === "quick" ? "Whole day, roughly" : <>Add to <select className="meal-select" value={meal} onChange={(e) => onMeal(e.target.value as Meal)} aria-label="Meal">{MEALS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}</select></>}</h2>
        <button type="button" className="close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      <div className="nu-panel-day"><span className="muted small">Day</span><DatePicker value={date} onChange={onDate} /></div>
      <div className="pill-group nu-modes" role="tablist">
        <button type="button" role="tab" className={mode === "search" ? "on" : ""} onClick={() => setMode("search")}>Search</button>
        <button type="button" role="tab" className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>Type it in</button>
        <button type="button" role="tab" className={mode === "quick" ? "on" : ""} onClick={() => setMode("quick")}>Whole day</button>
      </div>
      {mode === "search" && <Search date={date} meal={meal} onDone={onClose} onCustom={() => setMode("manual")} />}
      {mode === "manual" && <Manual date={date} meal={meal} onDone={onClose} />}
      {mode === "quick" && <QuickDay date={date} onDone={onClose} />}
    </aside>
  );
}

function Search({ date, meal, onDone, onCustom }: { date: string; meal: Meal; onDone: () => void; onCustom: () => void }) {
  const nut = useNutrition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sel, setSel] = useState<Food | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!q.trim()) { setResults([]); setNote(null); return; }
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setBusy(true);
    const t = setTimeout(async () => {
      const r = await searchFoods(q, nut.foods, ac.signal);
      if (ac.signal.aborted) return;
      setResults(r.foods); setNote(r.error ?? (!usdaAvailable() ? "Built-in foods only until the food-database key is set." : null)); setBusy(false);
    }, 300);
    return () => { clearTimeout(t); };
  }, [q, nut.foods]);
  const chips = (title: string, foods: Food[]) => foods.length ? <div className="nu-chips"><span className="k">{title}</span>{foods.map((f) => <button key={f.id} type="button" onClick={() => setSel(f)}>{f.name.length > 22 ? f.name.slice(0, 21) + "…" : f.name}</button>)}</div> : null;
  return (
    <div className="nu-search">
      <div className="search"><Icon name="search" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…" aria-label="Search foods" />{q && <button type="button" className="clear" onClick={() => setQ("")} aria-label="Clear">×</button>}</div>
      {!q && chips("Recent", nut.recents)}
      {!q && chips("Favourites", nut.favourites)}
      {note && <div className="hint">{note}</div>}
      <div className="nu-results">
        {busy && !results.length && <div className="muted small">Searching…</div>}
        {results.map((f) => (
          <button key={f.id} type="button" className={`nu-result${sel?.id === f.id ? " on" : ""}`} onClick={() => setSel(f)}>
            <span className="t"><b>{f.name}</b><small>{f.brand ? `${f.brand} · ` : ""}{fmt(f.per100.kcal)} kcal per 100 g{f.source === "custom" ? " · yours" : ""}</small></span>
            <span className="plus"><Icon name="plus" /></span>
          </button>
        ))}
        {q && !busy && !results.length && <div className="muted small">Nothing found. <button type="button" className="linkbtn" onClick={onCustom}>Type it in</button> instead.</div>}
      </div>
      {sel && <Portion food={sel} onAdd={(g, l) => { nut.addFood(date, meal, sel, g, l); onDone(); }} onFav={() => nut.toggleFavourite(sel)} fav={!!nut.foods.find((f) => f.id === sel.id)?.favourite} />}
      <button type="button" className="linkbtn center" onClick={onCustom}>Create custom food</button>
    </div>
  );
}

function Portion({ food, onAdd, onFav, fav }: { food: Food; onAdd: (grams: number, label: string) => void; onFav: () => void; fav: boolean }) {
  const units: (Serving | { label: "g"; g: 1 })[] = [{ label: "g", g: 1 }, ...food.servings];
  const [unit, setUnit] = useState<(typeof units)[number]>(food.servings[0] ?? units[0]);
  const [amount, setAmount] = useState(food.servings[0] ? "1" : "100");
  const grams = (parseFloat(amount) || 0) * unit.g;
  const m = scaleM(food.per100, grams / 100);
  const label = unit.label === "g" ? `${fmt(grams)} g` : `${amount} × ${unit.label}`;
  return (
    <div className="nu-portion card">
      <div className="hd"><div><b>{food.name}</b>{food.brand && <small>{food.brand}</small>}</div><button type="button" className={`fav${fav ? " on" : ""}`} onClick={onFav} aria-label="Favourite" title={fav ? "Remove favourite" : "Add to favourites"}>★</button></div>
      <div className="amt">
        <label>Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
        <div className="pill-group small">{units.map((u) => <button key={u.label} type="button" className={unit.label === u.label ? "on" : ""} onClick={() => { setUnit(u); setAmount(u.label === "g" ? String(Math.round(grams) || 100) : "1"); }}>{u.label}</button>)}</div>
      </div>
      <div className="nums">
        <div><b>{fmt(m.kcal)}</b><span>kcal</span></div><div><b>{fmt(m.carbs)} g</b><span>carbs</span></div><div><b>{fmt(m.protein)} g</b><span>protein</span></div><div><b>{fmt(m.fat)} g</b><span>fat</span></div><div><b>{fmt(m.fibre)} g</b><span>fibre</span></div><div><b>{fmt(m.sodium)} mg</b><span>sodium</span></div>
      </div>
      <button type="button" className="btn wide" disabled={grams <= 0} onClick={() => onAdd(grams, label)}>Add</button>
    </div>
  );
}

function Manual({ date, meal, onDone }: { date: string; meal: Meal; onDone: () => void }) {
  const nut = useNutrition();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [amount, setAmount] = useState("");
  const [more, setMore] = useState(false);
  const [c, setC] = useState(""), [p, setP] = useState(""), [f, setF] = useState(""), [fi, setFi] = useState(""), [na, setNa] = useState("");
  const [save, setSave] = useState(false);
  const num = (s: string) => (s.trim() === "" ? undefined : parseFloat(s) || 0);
  return (
    <form className="form nu-manual" onSubmit={(e) => {
      e.preventDefault();
      const k = parseFloat(kcal); if (!name.trim() || !Number.isFinite(k)) return;
      nut.addManual(date, meal, { name, kcal: k, carbs: num(c), protein: num(p), fat: num(f), fibre: num(fi), sodium: num(na), amount: amount.trim() || undefined });
      if (save) nut.saveCustomFood({ name: name.trim(), per100: { kcal: k, carbs: num(c) ?? 0, protein: num(p) ?? 0, fat: num(f) ?? 0, fibre: num(fi) ?? 0, sodium: num(na) ?? 0 }, servings: [{ label: amount.trim() || "1 serving", g: 100 }] });
      onDone();
    }}>
      <p className="hint">Name it and give the calories. Everything else is optional.</p>
      <label><b>What</b><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken burrito, or Lunch at the canteen" required /></label>
      <div className="two">
        <label><b>Calories</b><input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" placeholder="650" required /></label>
        <label><b>Amount (optional)</b><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1 plate, 2 slices, 300 g" /></label>
      </div>
      {!more ? <button type="button" className="linkbtn" onClick={() => setMore(true)}>+ Add carbs, protein, fat, fibre, sodium</button> : (
        <div className="nu-macros">
          <label>Carbs g<input value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" /></label>
          <label>Protein g<input value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" /></label>
          <label>Fat g<input value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" /></label>
          <label>Fibre g<input value={fi} onChange={(e) => setFi(e.target.value)} inputMode="decimal" /></label>
          <label>Sodium mg<input value={na} onChange={(e) => setNa(e.target.value)} inputMode="decimal" /></label>
        </div>
      )}
      <label className="chk-row"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save as one of my foods so I can pick it next time</label>
      <button type="submit" className="btn wide">Add</button>
    </form>
  );
}

function QuickDay({ date, onDone }: { date: string; onDone: () => void }) {
  const nut = useNutrition();
  const [v, setV] = useState<Record<string, string>>({ breakfast: "", lunch: "", dinner: "", other: "" });
  const [bottles, setBottles] = useState("");
  const total = useMemo(() => Object.values(v).reduce((a, s) => a + (parseFloat(s) || 0), 0), [v]);
  return (
    <form className="form nu-quick" onSubmit={(e) => { e.preventDefault(); nut.addQuickDay(date, { breakfast: parseFloat(v.breakfast) || 0, lunch: parseFloat(v.lunch) || 0, dinner: parseFloat(v.dinner) || 0, other: parseFloat(v.other) || 0 }, parseFloat(bottles) || 0); onDone(); }}>
      <p className="hint">Your best guess in calories per meal, and how many bottles ({nut.profile.bottle_ml} ml) you drank. Saved as estimates without a macro breakdown.</p>
      {([["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["other", "Other (snacks, drinks, fuel)"]] as const).map(([k, l]) => (
        <label key={k} className="inline"><b>{l}</b><span className="unit-in"><input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} inputMode="numeric" placeholder="0" /><span className="units"><span>kcal</span></span></span></label>
      ))}
      <label className="inline"><b>Water</b><span className="unit-in"><input value={bottles} onChange={(e) => setBottles(e.target.value)} inputMode="decimal" placeholder="0" /><span className="units"><span>bottles</span></span></span></label>
      <div className="nu-quick-total"><span>Total</span><b>{fmt(total)} kcal</b></div>
      <button type="submit" className="btn wide" disabled={total <= 0 && !(parseFloat(bottles) > 0)}>Save day</button>
    </form>
  );
}
