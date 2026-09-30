// Food search. Live results come from the USDA FoodData Central database (free public data) when a key is
// set; a small built-in list of athlete staples works without it and while offline.
import type { Food, Macros, Serving } from "./types";

export const USDA_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY ?? "";

type Row = [id: string, name: string, brand: string, kcal: number, carbs: number, protein: number, fat: number, fibre: number, sodium: number, servings: Serving[]];
const R: Row[] = [
  ["banana", "Banana, raw", "", 89, 22.8, 1.1, 0.3, 2.6, 1, [{ label: "1 medium", g: 118 }, { label: "1 large", g: 136 }]],
  ["oats", "Oats, rolled, dry", "", 379, 67.7, 13.2, 6.5, 10.1, 6, [{ label: "½ cup", g: 40 }, { label: "1 cup", g: 80 }]],
  ["rice-white", "White rice, cooked", "", 130, 28.2, 2.7, 0.3, 0.4, 1, [{ label: "1 cup", g: 158 }]],
  ["rice-brown", "Brown rice, cooked", "", 123, 25.6, 2.7, 1, 1.6, 4, [{ label: "1 cup", g: 195 }]],
  ["pasta", "Pasta, cooked", "", 158, 30.9, 5.8, 0.9, 1.8, 1, [{ label: "1 cup", g: 140 }]],
  ["sweet-potato", "Sweet potato, baked", "", 90, 20.7, 2, 0.2, 3.3, 36, [{ label: "1 medium", g: 114 }]],
  ["potato", "Potato, boiled", "", 87, 20.1, 1.9, 0.1, 1.8, 4, [{ label: "1 medium", g: 150 }]],
  ["bread-ww", "Bread, whole wheat", "", 247, 41, 13, 3.4, 6, 450, [{ label: "1 slice", g: 32 }]],
  ["bagel", "Bagel, plain", "", 250, 49, 10, 1.5, 2, 430, [{ label: "1 bagel", g: 105 }]],
  ["rice-cake", "Rice cake, plain", "", 387, 82, 8, 3, 4, 26, [{ label: "1 cake", g: 9 }]],
  ["chicken", "Chicken breast, cooked", "", 165, 0, 31, 3.6, 0, 74, [{ label: "1 breast", g: 150 }, { label: "100 g", g: 100 }]],
  ["salmon", "Salmon, Atlantic, cooked", "", 206, 0, 22, 12, 0, 61, [{ label: "1 fillet", g: 150 }]],
  ["beef", "Beef, 90% lean, cooked", "", 217, 0, 26, 12, 0, 72, [{ label: "1 serving", g: 150 }]],
  ["tuna", "Tuna, canned in water", "", 116, 0, 25.5, 0.8, 0, 320, [{ label: "1 can", g: 140 }]],
  ["egg", "Egg, whole, cooked", "", 155, 1.1, 12.6, 10.6, 0, 124, [{ label: "1 large", g: 50 }, { label: "2 large", g: 100 }]],
  ["tofu", "Tofu, firm", "", 144, 2.8, 17.3, 8.7, 2.3, 14, [{ label: "½ block", g: 125 }]],
  ["lentils", "Lentils, cooked", "", 116, 20, 9, 0.4, 7.9, 2, [{ label: "1 cup", g: 198 }]],
  ["yogurt-2", "Greek yogurt, plain, 2%", "", 73, 3.9, 9.9, 1.9, 0, 34, [{ label: "1 cup", g: 200 }, { label: "1 container", g: 170 }]],
  ["yogurt-0", "Greek yogurt, plain, 0%", "", 59, 3.6, 10.3, 0.4, 0, 36, [{ label: "1 cup", g: 200 }, { label: "1 container", g: 170 }]],
  ["cottage", "Cottage cheese, 2%", "", 84, 4.3, 11, 2.3, 0, 330, [{ label: "½ cup", g: 113 }]],
  ["milk", "Milk, whole", "", 61, 4.8, 3.2, 3.3, 0, 43, [{ label: "1 cup", g: 244 }]],
  ["whey", "Whey protein powder", "", 400, 8, 80, 5, 0, 200, [{ label: "1 scoop", g: 30 }]],
  ["pb", "Peanut butter", "", 588, 20, 25, 50, 6, 430, [{ label: "1 tbsp", g: 16 }, { label: "2 tbsp", g: 32 }]],
  ["almond-butter", "Almond butter", "", 614, 19, 21, 56, 10, 7, [{ label: "1 tbsp", g: 16 }]],
  ["nuts", "Mixed nuts, unsalted", "", 607, 21, 20, 54, 7, 7, [{ label: "1 handful", g: 30 }]],
  ["olive-oil", "Olive oil", "", 884, 0, 0, 100, 0, 2, [{ label: "1 tbsp", g: 14 }]],
  ["avocado", "Avocado", "", 160, 8.5, 2, 14.7, 6.7, 7, [{ label: "½ avocado", g: 100 }]],
  ["apple", "Apple, raw", "", 52, 13.8, 0.3, 0.2, 2.4, 1, [{ label: "1 medium", g: 182 }]],
  ["blueberries", "Blueberries", "", 57, 14.5, 0.7, 0.3, 2.4, 1, [{ label: "1 cup", g: 148 }]],
  ["orange-juice", "Orange juice", "", 45, 10.4, 0.7, 0.2, 0.2, 1, [{ label: "1 cup (250 ml)", g: 250 }]],
  ["broccoli", "Broccoli, cooked", "", 35, 7.2, 2.4, 0.4, 3.3, 41, [{ label: "1 cup", g: 156 }]],
  ["salad", "Mixed salad greens", "", 17, 3.3, 1.5, 0.2, 2.1, 28, [{ label: "2 cups", g: 85 }]],
  ["honey", "Honey", "", 304, 82.4, 0.3, 0, 0.2, 4, [{ label: "1 tbsp", g: 21 }]],
  ["dark-choc", "Dark chocolate, 70%", "", 598, 46, 7.8, 43, 11, 20, [{ label: "2 squares", g: 20 }]],
  ["pizza", "Pizza, cheese", "", 266, 33, 11, 10, 2.3, 598, [{ label: "1 slice", g: 107 }]],
  ["coffee", "Coffee, black", "", 1, 0, 0.1, 0, 0, 2, [{ label: "1 cup (240 ml)", g: 240 }]],
  ["sports-drink", "Sports drink, 6% carbohydrate", "", 25, 6, 0, 0, 0, 45, [{ label: "1 bottle (500 ml)", g: 500 }, { label: "1 bottle (750 ml)", g: 750 }]],
  ["electrolyte", "Electrolyte drink, 1000 mg sodium/L", "", 14, 3.4, 0, 0, 0, 100, [{ label: "1 bottle (500 ml)", g: 500 }, { label: "1 bottle (750 ml)", g: 750 }]],
  ["gel", "Energy gel, 25 g carbohydrate", "", 250, 62.5, 0, 0, 0, 125, [{ label: "1 gel", g: 40 }]],
  ["gel-maurten", "Gel 100", "Maurten", 250, 62.5, 0, 0, 0, 55, [{ label: "1 gel", g: 40 }]],
  ["energy-bar", "Energy bar, oat", "", 383, 70, 10, 8.3, 5, 250, [{ label: "1 bar", g: 60 }]],
  ["carb-mix", "Carbohydrate drink mix, 80 g carbs/500 ml", "", 380, 95, 0, 0, 0, 300, [{ label: "1 bottle (80 g)", g: 84 }]],
];
export const BUILTIN: Food[] = R.map(([id, name, brand, kcal, carbs, protein, fat, fibre, sodium, servings]) => ({ id: `builtin-${id}`, name, brand: brand || undefined, per100: { kcal, carbs, protein, fat, fibre, sodium }, servings, source: "builtin" as const }));

export function searchBuiltin(q: string, limit = 12): Food[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const words = t.split(/\s+/);
  return BUILTIN.map((f) => { const hay = `${f.name} ${f.brand ?? ""}`.toLowerCase(); const score = words.reduce((s, w) => s + (hay.includes(w) ? (hay.startsWith(w) ? 3 : 1) : 0), 0); return { f, score }; })
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.f);
}

// ---------- USDA FoodData Central ----------
interface UsdaNutrient { nutrientNumber?: string; nutrientId?: number; value?: number; unitName?: string }
interface UsdaFood { fdcId: number; description: string; brandOwner?: string; brandName?: string; dataType?: string; servingSize?: number; servingSizeUnit?: string; householdServingFullText?: string; foodNutrients?: UsdaNutrient[] }
const NUM = { kcal: ["208", "957", "958"], carbs: ["205"], protein: ["203"], fat: ["204"], fibre: ["291"], sodium: ["307"] };
function pick(ns: UsdaNutrient[], numbers: string[]) { for (const n of numbers) { const hit = ns.find((x) => x.nutrientNumber === n); if (hit?.value != null) return hit.value; } return 0; }
function toFood(u: UsdaFood): Food {
  const ns = u.foodNutrients ?? [];
  const per100: Macros = { kcal: pick(ns, NUM.kcal), carbs: pick(ns, NUM.carbs), protein: pick(ns, NUM.protein), fat: pick(ns, NUM.fat), fibre: pick(ns, NUM.fibre), sodium: pick(ns, NUM.sodium) };
  const servings: Serving[] = [];
  if (u.servingSize && /^(g|ml|GRM|MLT)$/i.test(u.servingSizeUnit ?? "")) servings.push({ label: u.householdServingFullText?.trim() || `1 serving (${Math.round(u.servingSize)} ${/ml|MLT/i.test(u.servingSizeUnit!) ? "ml" : "g"})`, g: u.servingSize });
  const name = u.description.replace(/\s+/g, " ").trim();
  const brand = (u.brandName || u.brandOwner || "").trim() || undefined;
  return { id: `usda-${u.fdcId}`, name: name.length > 70 ? name.slice(0, 68) + "…" : name, brand, per100, servings, source: "usda" };
}
export function usdaAvailable() { return Boolean(USDA_KEY); }
export async function searchUsda(q: string, signal?: AbortSignal): Promise<Food[]> {
  if (!USDA_KEY || !q.trim()) return [];
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_KEY)}&query=${encodeURIComponent(q.trim())}&pageSize=20&dataType=Foundation,SR%20Legacy,Branded`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const data = (await res.json()) as { foods?: UsdaFood[] };
  const seen = new Set<string>();
  return (data.foods ?? []).map(toFood).filter((f) => f.per100.kcal > 0 || f.per100.carbs > 0 || f.per100.protein > 0).filter((f) => { const k = `${f.name}|${f.brand ?? ""}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Search everything: the athlete's own foods first, then built-in, then USDA. */
export async function searchFoods(q: string, mine: Food[], signal?: AbortSignal): Promise<{ foods: Food[]; live: boolean; error?: string }> {
  const t = q.trim().toLowerCase();
  const own = mine.filter((f) => `${f.name} ${f.brand ?? ""}`.toLowerCase().includes(t));
  const builtin = searchBuiltin(q).filter((f) => !own.some((o) => o.id === f.id));
  let live = false, error: string | undefined, usda: Food[] = [];
  if (USDA_KEY) { try { usda = await searchUsda(q, signal); live = true; } catch (e) { if ((e as Error).name !== "AbortError") error = "Food database not reachable — showing built-in foods only."; } }
  const ids = new Set([...own, ...builtin].map((f) => f.id));
  return { foods: [...own, ...builtin, ...usda.filter((f) => !ids.has(f.id))].slice(0, 30), live, error };
}
