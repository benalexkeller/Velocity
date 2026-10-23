"use client";
// Nutrition data, live in the app. Same pattern as the plan store: load once, keep a working copy, write every
// change straight back. Targets come from the athlete's body data and the day's training sessions.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlan } from "../store";
import { addDays, fromYmd, today, ymd } from "../format";
import { makeNutritionBackend, type NutritionBackend } from "./backend";
import { projectWeight, sessionFuel, targetsFor, type DayTargets } from "./targets";
import { EMPTY_NUTRITION, ZERO, addM, entryMacros, scaleM, uid, nowHM, type Drink, type Food, type LogEntry, type Macros, type Meal, type NutritionData, type NutritionProfile, type Serving, type SupplementPick, type WeightEntry } from "./types";
import type { Session } from "../data";

/** targets is null until a body weight is on file. sessions = what was done (activities) plus what is still planned. */
export interface DaySummary { date: string; totals: Macros; targets: DayTargets | null; sessions: Session[]; basis: "planned" | "done" | "mixed" | "none"; drinks_ml: number; entries: LogEntry[]; logged: boolean; estimateOnly: boolean }

export interface NutritionStore {
  ready: boolean;
  data: NutritionData;
  profile: NutritionProfile;
  needsSetup: boolean;
  saveProfile: (p: Partial<NutritionProfile>) => Promise<void>;
  // day
  day: (date: string) => DaySummary;
  week: (weekStart: string) => DaySummary[];
  entriesFor: (date: string, meal: Meal) => LogEntry[];
  addFood: (date: string, meal: Meal, food: Food, grams: number, amountLabel: string) => void;
  addManual: (date: string, meal: Meal, e: { name: string; kcal: number; carbs?: number; protein?: number; fat?: number; fibre?: number; sodium?: number; amount?: string }) => void;
  addQuickDay: (date: string, kcal: Partial<Record<Meal, number>>, bottles: number) => void;
  removeEntry: (id: string) => void;
  // foods
  foods: Food[];
  recents: Food[];
  favourites: Food[];
  toggleFavourite: (f: Food) => void;
  saveCustomFood: (f: Omit<Food, "id" | "source">) => Food;
  // drinks
  drinksFor: (date: string) => Drink[];
  addDrink: (date: string, ml: number) => void;
  removeDrink: (id: string) => void;
  // weight
  weights: WeightEntry[];
  logWeight: (date: string, kg: number) => void;
  projection: () => { avgBalance: number; kgPerWeek: number } | null;
  // supplements
  takenOn: (date: string, id: string) => string | null;
  toggleTaken: (date: string, id: string) => void;
  addSupplement: (pick: SupplementPick) => void;
  removeSupplement: (id: string) => void;
  fuelFor: (s: Session) => ReturnType<typeof sessionFuel>;
  hasWeight: boolean;
}

const Ctx = createContext<NutritionStore | null>(null);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const plan = usePlan();
  const be = useRef<NutritionBackend | null>(null);
  if (!be.current) be.current = makeNutritionBackend();
  const b = be.current;
  const [data, setData] = useState<NutritionData>(EMPTY_NUTRITION);
  const [ready, setReady] = useState(false);
  useEffect(() => { let on = true; b.load().then((d) => { if (on) { lastSaved.current = d.profile; setData(d); setReady(true); } }).catch((e) => { console.error("[velocity/nutrition] load", e); setReady(true); }); return () => { on = false; }; }, [b]);
  // any change to the profile (weight log, supplement list) is written once, after the render that made it
  const lastSaved = useRef<NutritionProfile | null>(null);
  useEffect(() => { if (!ready || data.profile === lastSaved.current) return; lastSaved.current = data.profile; void b.saveProfile(data.profile); }, [data.profile, ready, b]);

  const weightKg = data.profile.weight_kg ?? 0;
  // the day's sessions as they happened: logged activities replace their planned session, missed sessions count
  // for nothing, unplanned activities are added; future and not-yet-done sessions stay as planned
  const sessionsOn = useCallback((date: string): { list: Session[]; basis: DaySummary["basis"] } => {
    const w = plan.weekOf(fromYmd(date));
    const planned = (w?.sessions ?? []).filter((s) => s.date === date);
    const acts = plan.activitiesOn(date);
    const paired = new Set(planned.map((s) => s.actual?.id).filter(Boolean) as string[]);
    const list: Session[] = [];
    let done = 0, plannedN = 0;
    for (const s of planned) {
      if (s.sport === "rest") { list.push(s); continue; }
      if (s.actual) { list.push({ ...s, sport: s.actual.sport, min: s.actual.min }); done++; continue; }
      if (s.status === "missed" || s.status === "substituted") continue;
      list.push(s); plannedN++;
    }
    for (const a of acts) {
      if (paired.has(a.id)) continue;
      const lthr = plan.athlete.lthr ?? 155;
      const intensity = a.hr ? (a.hr / lthr >= 0.9 ? "Tempo" : "Zone 2") : a.exertion && a.exertion >= 7 ? "Tempo" : "Zone 2";
      list.push({ id: a.id, date, dayIndex: 0, start: a.start, min: a.min, sport: a.sport, title: a.name, detail: "", text: a.name, intensity, why: "", status: "done", actual: a });
      done++;
    }
    return { list, basis: done && plannedN ? "mixed" : done ? "done" : plannedN ? "planned" : "none" };
  }, [plan]);

  const store = useMemo<NutritionStore>(() => {
    const p = data.profile;
    const entriesOn = (date: string) => data.log.filter((e) => e.date === date);
    const day = (date: string): DaySummary => {
      const entries = entriesOn(date);
      const { list: sessions, basis } = sessionsOn(date);
      const totals = entries.reduce((a, e) => addM(a, entryMacros(e)), ZERO);
      const drinks_ml = data.drinks.filter((d) => d.date === date).reduce((a, d) => a + d.ml, 0);
      const phase = plan.weekOf(fromYmd(date))?.phase ?? "";
      const targets = targetsFor(p, sessions, { date, raceDate: plan.athlete.hasRace ? plan.athlete.race.date : undefined, raceDistance: plan.athlete.hasRace ? plan.athlete.race.distance : undefined, phase });
      return { date, totals, targets, sessions, basis, drinks_ml, entries, logged: entries.length > 0 || drinks_ml > 0, estimateOnly: entries.length > 0 && entries.every((e) => e.source === "quick") };
    };
    const week = (weekStart: string) => Array.from({ length: 7 }, (_, i) => day(ymd(addDays(fromYmd(weekStart), i))));
    const bump = (food: Food) => { const cur = data.foods.find((f) => f.id === food.id); const next: Food = { ...food, favourite: cur?.favourite ?? food.favourite, uses: (cur?.uses ?? 0) + 1, last_used: new Date().toISOString() }; setData((d) => ({ ...d, foods: [...d.foods.filter((f) => f.id !== next.id), next] })); void b.upsertFood(next); };
    const put = (e: LogEntry) => { setData((d) => ({ ...d, log: [...d.log.filter((x) => x.id !== e.id), e] })); void b.upsertEntry(e); };
    const byUse = [...data.foods].sort((a, c) => (c.last_used ?? "").localeCompare(a.last_used ?? ""));
    return {
      ready, data, profile: p, needsSetup: ready && !p.setup_done,
      saveProfile: async (patch) => { const next = { ...data.profile, ...patch }; lastSaved.current = next; setData((d) => ({ ...d, profile: next })); await b.saveProfile(next); },
      day, week,
      entriesFor: (date, meal) => entriesOn(date).filter((e) => e.meal === meal),
      addFood: (date, meal, food, grams, amountLabel) => {
        const m = scaleM(food.per100, grams / 100);
        put({ id: uid(), date, meal, name: food.name, brand: food.brand, amount: grams, unit: amountLabel, kcal: Math.round(m.kcal), carbs_g: +m.carbs.toFixed(1), protein_g: +m.protein.toFixed(1), fat_g: +m.fat.toFixed(1), fibre_g: +m.fibre.toFixed(1), sodium_mg: Math.round(m.sodium), source: food.source, food_id: food.id });
        bump(food);
      },
      addManual: (date, meal, e) => put({ id: uid(), date, meal, name: e.name.trim() || "Meal", unit: e.amount, kcal: Math.round(e.kcal), carbs_g: e.carbs ?? 0, protein_g: e.protein ?? 0, fat_g: e.fat ?? 0, fibre_g: e.fibre ?? 0, sodium_mg: e.sodium ?? 0, source: "manual" }),
      addQuickDay: (date, kcal, bottles) => {
        (Object.keys(kcal) as Meal[]).forEach((meal) => { const k = kcal[meal]; if (k && k > 0) put({ id: uid(), date, meal, name: "Estimate", kcal: Math.round(k), carbs_g: 0, protein_g: 0, fat_g: 0, fibre_g: 0, sodium_mg: 0, source: "quick" }); });
        if (bottles > 0) { const d: Drink = { id: uid(), date, ml: Math.round(bottles * p.bottle_ml), at: nowHM() }; setData((x) => ({ ...x, drinks: [...x.drinks, d] })); void b.upsertDrink(d); }
      },
      removeEntry: (id) => { setData((d) => ({ ...d, log: d.log.filter((x) => x.id !== id) })); void b.deleteEntry(id); },
      foods: data.foods,
      recents: byUse.filter((f) => (f.uses ?? 0) > 0).slice(0, 8),
      favourites: data.foods.filter((f) => f.favourite),
      toggleFavourite: (food) => { const cur = data.foods.find((f) => f.id === food.id); const next: Food = { ...(cur ?? food), favourite: !(cur?.favourite ?? false) }; setData((d) => ({ ...d, foods: [...d.foods.filter((f) => f.id !== next.id), next] })); void b.upsertFood(next); },
      saveCustomFood: (f) => { const food: Food = { ...f, id: `custom-${uid()}`, source: "custom", uses: 0 }; setData((d) => ({ ...d, foods: [...d.foods, food] })); void b.upsertFood(food); return food; },
      drinksFor: (date) => data.drinks.filter((d) => d.date === date),
      addDrink: (date, ml) => { const d: Drink = { id: uid(), date, ml, at: nowHM() }; setData((x) => ({ ...x, drinks: [...x.drinks, d] })); void b.upsertDrink(d); },
      removeDrink: (id) => { setData((d) => ({ ...d, drinks: d.drinks.filter((x) => x.id !== id) })); void b.deleteDrink(id); },
      weights: [...data.weights].sort((a, c) => a.date.localeCompare(c.date)),
      logWeight: (date, kg) => { const w = { date, weight_kg: kg }; setData((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== date), w], profile: date === ymd(today()) ? { ...d.profile, weight_kg: kg } : d.profile })); void b.upsertWeight(w); },
      projection: () => { const t = today(); const bal: number[] = []; for (let i = 1; i <= 14; i++) { const d = day(ymd(addDays(t, -i))); if (d.logged && d.targets) bal.push(d.totals.kcal - d.targets.kcal); } return bal.length >= 3 ? projectWeight(bal) : null; },
      takenOn: (date, id) => data.taken.find((t) => t.date === date && t.supplement_id === id)?.taken_at ?? null,
      toggleTaken: (date, id) => { const on = !data.taken.some((t) => t.date === date && t.supplement_id === id); const t = { date, supplement_id: id, taken_at: nowHM() }; setData((d) => ({ ...d, taken: on ? [...d.taken, t] : d.taken.filter((x) => !(x.date === date && x.supplement_id === id)) })); void b.setTaken(t, on); },
      addSupplement: (pick) => setData((d) => ({ ...d, profile: { ...d.profile, supplements: [...d.profile.supplements.filter((s) => s.id !== pick.id), pick] } })),
      removeSupplement: (id) => setData((d) => ({ ...d, profile: { ...d.profile, supplements: d.profile.supplements.filter((s) => s.id !== id) } })),
      fuelFor: (s) => {
        // hours until the next planned session decide the recovery-carbohydrate advice
        const startOf = (x: Session) => fromYmd(x.date).getTime() + (Number((x.start ?? "06:30").split(":")[0]) * 60 + Number((x.start ?? "06:30").split(":")[1])) * 60000;
        const end = startOf(s) + s.min * 60000;
        const next = plan.weeks.flatMap((wk) => wk.sessions).filter((x) => x.sport !== "rest" && x.id !== s.id && startOf(x) > end).sort((a, b) => startOf(a) - startOf(b))[0];
        return sessionFuel(s, weightKg || 70, next ? (startOf(next) - end) / 3600000 : null);
      },
      hasWeight: !!p.weight_kg,
    };
  }, [data, ready, b, sessionsOn, plan.athlete, weightKg]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useNutrition(): NutritionStore {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNutrition outside NutritionProvider");
  return c;
}

export const gramsFor = (food: Food, amount: number, serving: Serving | null) => (serving ? amount * serving.g : amount);
