// Nutrition tracker — shapes shared by the store, the backends and the screens.
export type Meal = "breakfast" | "lunch" | "dinner" | "snack" | "session";
export const MEALS: { k: Meal; label: string }[] = [
  { k: "breakfast", label: "Breakfast" },
  { k: "lunch", label: "Lunch" },
  { k: "snack", label: "Snacks" },
  { k: "dinner", label: "Dinner" },
  { k: "session", label: "In-session fuel" },
];

/** Per 100 g (or 100 ml for drinks). */
export interface Macros { kcal: number; carbs: number; protein: number; fat: number; fibre: number; sodium: number }
export const ZERO: Macros = { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0, sodium: 0 };
export const addM = (a: Macros, b: Macros): Macros => ({ kcal: a.kcal + b.kcal, carbs: a.carbs + b.carbs, protein: a.protein + b.protein, fat: a.fat + b.fat, fibre: a.fibre + b.fibre, sodium: a.sodium + b.sodium });
export const scaleM = (a: Macros, f: number): Macros => ({ kcal: a.kcal * f, carbs: a.carbs * f, protein: a.protein * f, fat: a.fat * f, fibre: a.fibre * f, sodium: a.sodium * f });

export interface Serving { label: string; g: number }
export interface Food { id: string; name: string; brand?: string; per100: Macros; servings: Serving[]; source: "usda" | "builtin" | "custom"; favourite?: boolean; uses?: number; last_used?: string }

export interface LogEntry {
  id: string; date: string; meal: Meal; name: string; brand?: string; amount?: number; unit?: string;
  kcal: number; carbs_g: number; protein_g: number; fat_g: number; fibre_g: number; sodium_mg: number;
  source: "usda" | "builtin" | "custom" | "manual" | "quick"; food_id?: string;
}
export const entryMacros = (e: LogEntry): Macros => ({ kcal: e.kcal, carbs: e.carbs_g, protein: e.protein_g, fat: e.fat_g, fibre: e.fibre_g, sodium: e.sodium_mg });

export interface Drink { id: string; date: string; ml: number; at?: string }
export interface WeightEntry { date: string; weight_kg: number }
export interface SupplementPick { id: string; dose: string; time: string }
export interface SupplementTaken { date: string; supplement_id: string; taken_at?: string }

export type Goal = "maintain" | "lose" | "gain" | "race_weight";
export interface NutritionProfile {
  weight_kg: number | null; height_cm: number | null; birth_year: number | null; sex: "male" | "female" | "other" | null;
  goal: Goal; goal_weight_kg: number | null; bottle_ml: number; supplements: SupplementPick[]; setup_done: boolean;
}
export const EMPTY_PROFILE: NutritionProfile = { weight_kg: null, height_cm: null, birth_year: null, sex: null, goal: "maintain", goal_weight_kg: null, bottle_ml: 750, supplements: [], setup_done: false };

export interface NutritionData { profile: NutritionProfile; log: LogEntry[]; foods: Food[]; drinks: Drink[]; weights: WeightEntry[]; taken: SupplementTaken[] }
export const EMPTY_NUTRITION: NutritionData = { profile: EMPTY_PROFILE, log: [], foods: [], drinks: [], weights: [], taken: [] };

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
