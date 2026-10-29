"use client";
// The link between the nutrition data and the coach. The plan store (which sends coach questions) does not hold
// the nutrition data; the NutritionProvider does, on the pages that have it (Dashboard, Plan, Nutrition, Analysis).
// While mounted, the provider registers itself here, so a coach question carries yesterday's and today's food and
// targets, and food the coach logs lands in the live nutrition log. On a page without the provider, logged food is
// written straight to the nutrition backend and shows up the next time Nutrition opens.
import type { CoachContext, MealLogItem } from "./types";
import { makeNutritionBackend } from "@/lib/nutrition/backend";
import { uid } from "@/lib/nutrition/types";
import { MEAL_LIBRARY, mealMacros } from "@/lib/nutrition/meals";

type NutritionCtx = NonNullable<CoachContext["nutrition"]>;
export interface NutritionBridge {
  /** Yesterday's and today's targets, totals and meals. */
  days: () => NutritionCtx["days"];
  log: (items: MealLogItem[]) => void;
}

let current: NutritionBridge | null = null;
/** Called by NutritionProvider; returns the unregister function. */
export function registerNutrition(b: NutritionBridge) {
  current = b;
  return () => { if (current === b) current = null; };
}
/** The meal library, compact: what the coach can log by id, with the photo and exact macros. */
const library = (): NutritionCtx["library"] => MEAL_LIBRARY.map((m) => { const x = mealMacros(m); return { id: m.id, name: m.name, kcal: Math.round(x.kcal), carbs_g: Math.round(x.carbs), protein_g: Math.round(x.protein), fat_g: Math.round(x.fat) }; });
/** What the coach sees of nutrition: the library always, the days when this page has the nutrition data. */
export const nutritionContext = (): NutritionCtx => ({ days: current?.days() ?? [], library: library() });

/** Food the coach logged: into the live store when there is one, otherwise straight to the backend. */
export function logMeals(items: MealLogItem[]) {
  if (!items.length) return;
  if (current) { current.log(items); return; }
  void (async () => {
    const be = makeNutritionBackend();
    try {
      // the browser store writes the whole log at once, so it has to hold the current log first
      if (be.kind === "local") await be.load();
      for (const m of items) {
        await be.upsertEntry({
          id: uid(), date: m.date, meal: m.meal, name: m.name, unit: servingsLabel(m.servings),
          kcal: Math.round(m.kcal), carbs_g: m.carbs_g, protein_g: m.protein_g, fat_g: m.fat_g, fibre_g: 0, sodium_mg: 0, source: "manual",
        });
      }
    } catch (e) { console.error("[velocity] coach meal log", e); }
  })();
}

export const servingsLabel = (n?: number) => (!n || n === 1 ? "1 serving" : `${n} servings`);
