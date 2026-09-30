"use client";
// Where the nutrition data lives: this browser (local mode) or the athlete's rows in Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { EMPTY_NUTRITION, EMPTY_PROFILE, normMeal, type Drink, type Food, type LogEntry, type NutritionData, type NutritionProfile, type SupplementTaken, type WeightEntry } from "./types";

export interface NutritionBackend {
  kind: "local" | "supabase";
  load(): Promise<NutritionData>;
  saveProfile(p: NutritionProfile): Promise<void>;
  upsertEntry(e: LogEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  upsertFood(f: Food): Promise<void>;
  deleteFood(id: string): Promise<void>;
  upsertDrink(d: Drink): Promise<void>;
  deleteDrink(id: string): Promise<void>;
  upsertWeight(w: WeightEntry): Promise<void>;
  deleteWeight(date: string): Promise<void>;
  setTaken(t: SupplementTaken, on: boolean): Promise<void>;
}

// ---------- local (browser) ----------
const KEY = "velocity.nutrition.v1";
function read(): NutritionData { try { const raw = localStorage.getItem(KEY); return raw ? { ...EMPTY_NUTRITION, ...JSON.parse(raw), profile: { ...EMPTY_PROFILE, ...(JSON.parse(raw).profile ?? {}) } } : { ...EMPTY_NUTRITION }; } catch { return { ...EMPTY_NUTRITION }; } }
function write(d: NutritionData) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }

export class LocalNutrition implements NutritionBackend {
  kind = "local" as const;
  private d: NutritionData = { ...EMPTY_NUTRITION };
  async load() { this.d = read(); this.d.log = this.d.log.map((e) => ({ ...e, meal: normMeal(e.meal) })); return this.d; }
  private put(n: Partial<NutritionData>) { this.d = { ...this.d, ...n }; write(this.d); }
  async saveProfile(p: NutritionProfile) { this.put({ profile: p }); }
  async upsertEntry(e: LogEntry) { this.put({ log: [...this.d.log.filter((x) => x.id !== e.id), e] }); }
  async deleteEntry(id: string) { this.put({ log: this.d.log.filter((x) => x.id !== id) }); }
  async upsertFood(f: Food) { this.put({ foods: [...this.d.foods.filter((x) => x.id !== f.id), f] }); }
  async deleteFood(id: string) { this.put({ foods: this.d.foods.filter((x) => x.id !== id) }); }
  async upsertDrink(x: Drink) { this.put({ drinks: [...this.d.drinks.filter((y) => y.id !== x.id), x] }); }
  async deleteDrink(id: string) { this.put({ drinks: this.d.drinks.filter((y) => y.id !== id) }); }
  async upsertWeight(w: WeightEntry) { this.put({ weights: [...this.d.weights.filter((x) => x.date !== w.date), w] }); }
  async deleteWeight(date: string) { this.put({ weights: this.d.weights.filter((x) => x.date !== date) }); }
  async setTaken(t: SupplementTaken, on: boolean) { const rest = this.d.taken.filter((x) => !(x.date === t.date && x.supplement_id === t.supplement_id)); this.put({ taken: on ? [...rest, t] : rest }); }
}

// ---------- Supabase ----------
type Row = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));
export class SupabaseNutrition implements NutritionBackend {
  kind = "supabase" as const;
  private uid = "";
  constructor(private sb: SupabaseClient) {}
  private async user() { if (this.uid) return this.uid; const { data } = await this.sb.auth.getUser(); this.uid = data.user?.id ?? ""; return this.uid; }
  private fail(where: string, error: { message: string } | null) { if (error) console.error(`[velocity/nutrition] ${where}: ${error.message}`); }
  async load(): Promise<NutritionData> {
    const uid = await this.user();
    if (!uid) return EMPTY_NUTRITION;
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const [p, log, foods, drinks, weights, taken] = await Promise.all([
      this.sb.from("nutrition_profile").select("*").eq("user_id", uid).maybeSingle(),
      this.sb.from("food_log").select("*").eq("user_id", uid).gte("date", since).order("date").order("created_at"),
      this.sb.from("foods").select("*").eq("user_id", uid).order("last_used", { ascending: false }).limit(300),
      this.sb.from("hydration_log").select("*").eq("user_id", uid).gte("date", since),
      this.sb.from("weight_log").select("*").eq("user_id", uid).order("date"),
      this.sb.from("supplement_log").select("*").eq("user_id", uid).gte("date", since),
    ]);
    const pr = p.data as Row | null;
    return {
      profile: pr ? { weight_kg: pr.weight_kg == null ? null : Number(pr.weight_kg), height_cm: pr.height_cm == null ? null : Number(pr.height_cm), birth_year: (pr.birth_year as number) ?? null, sex: (pr.sex as NutritionProfile["sex"]) ?? null, goal: (pr.goal as NutritionProfile["goal"]) ?? "maintain", goal_weight_kg: pr.goal_weight_kg == null ? null : Number(pr.goal_weight_kg), bottle_ml: (pr.bottle_ml as number) ?? 750, supplements: (pr.supplements as NutritionProfile["supplements"]) ?? [], setup_done: !!pr.setup_done } : EMPTY_PROFILE,
      log: ((log.data as Row[]) ?? []).map((r) => ({ id: String(r.id), date: String(r.date), meal: normMeal(String(r.meal)), name: String(r.name), brand: (r.brand as string) ?? undefined, amount: r.amount == null ? undefined : Number(r.amount), unit: (r.unit as string) ?? undefined, kcal: n(r.kcal), carbs_g: n(r.carbs_g), protein_g: n(r.protein_g), fat_g: n(r.fat_g), fibre_g: n(r.fibre_g), sodium_mg: n(r.sodium_mg), source: r.source as LogEntry["source"], food_id: (r.food_id as string) ?? undefined })),
      foods: ((foods.data as Row[]) ?? []).map((r) => ({ id: String(r.id), name: String(r.name), brand: (r.brand as string) ?? undefined, per100: r.per100 as Food["per100"], servings: (r.servings as Food["servings"]) ?? [], source: r.source as Food["source"], favourite: !!r.favourite, uses: n(r.uses), last_used: (r.last_used as string) ?? undefined })),
      drinks: ((drinks.data as Row[]) ?? []).map((r) => ({ id: String(r.id), date: String(r.date), ml: n(r.ml), at: (r.at as string) ?? undefined })),
      weights: ((weights.data as Row[]) ?? []).map((r) => ({ date: String(r.date), weight_kg: n(r.weight_kg) })),
      taken: ((taken.data as Row[]) ?? []).map((r) => ({ date: String(r.date), supplement_id: String(r.supplement_id), taken_at: (r.taken_at as string) ?? undefined })),
    };
  }
  async saveProfile(p: NutritionProfile) { const uid = await this.user(); const { error } = await this.sb.from("nutrition_profile").upsert({ user_id: uid, ...p, updated_at: new Date().toISOString() }); this.fail("saveProfile", error); if (error) throw error; }
  async upsertEntry(e: LogEntry) { const uid = await this.user(); const { error } = await this.sb.from("food_log").upsert({ user_id: uid, ...e, brand: e.brand ?? null, amount: e.amount ?? null, unit: e.unit ?? null, food_id: e.food_id ?? null }); this.fail("upsertEntry", error); }
  async deleteEntry(id: string) { const uid = await this.user(); const { error } = await this.sb.from("food_log").delete().eq("user_id", uid).eq("id", id); this.fail("deleteEntry", error); }
  async upsertFood(f: Food) { const uid = await this.user(); const { error } = await this.sb.from("foods").upsert({ user_id: uid, id: f.id, name: f.name, brand: f.brand ?? null, per100: f.per100, servings: f.servings, source: f.source, favourite: !!f.favourite, uses: f.uses ?? 0, last_used: f.last_used ?? null }); this.fail("upsertFood", error); }
  async deleteFood(id: string) { const uid = await this.user(); const { error } = await this.sb.from("foods").delete().eq("user_id", uid).eq("id", id); this.fail("deleteFood", error); }
  async upsertDrink(d: Drink) { const uid = await this.user(); const { error } = await this.sb.from("hydration_log").upsert({ user_id: uid, ...d, at: d.at ?? null }); this.fail("upsertDrink", error); }
  async deleteDrink(id: string) { const uid = await this.user(); const { error } = await this.sb.from("hydration_log").delete().eq("user_id", uid).eq("id", id); this.fail("deleteDrink", error); }
  async upsertWeight(w: WeightEntry) { const uid = await this.user(); const { error } = await this.sb.from("weight_log").upsert({ user_id: uid, ...w }); this.fail("upsertWeight", error); }
  async deleteWeight(date: string) { const uid = await this.user(); const { error } = await this.sb.from("weight_log").delete().eq("user_id", uid).eq("date", date); this.fail("deleteWeight", error); }
  async setTaken(t: SupplementTaken, on: boolean) {
    const uid = await this.user();
    const { error } = on ? await this.sb.from("supplement_log").upsert({ user_id: uid, ...t, taken_at: t.taken_at ?? null }) : await this.sb.from("supplement_log").delete().eq("user_id", uid).eq("date", t.date).eq("supplement_id", t.supplement_id);
    this.fail("setTaken", error);
  }
}

export function makeNutritionBackend(): NutritionBackend { const sb = supabase(); return sb ? new SupabaseNutrition(sb) : new LocalNutrition(); }
