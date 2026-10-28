// The meal library: photographed, complete meals built from the built-in foods, so one tap logs a whole plate
// with its macros. Portions are standard athlete servings; the athlete scales them when logging.
// Photos live in /public/food (<id>.webp at 720 px, <id>-s.webp at 240 px) and are shared with the front page.
import { BUILTIN } from "./foods";
import { addM, scaleM, type Macros } from "./types";

export type MealTag = "before" | "after" | "breakfast" | "lunch" | "dinner" | "snack" | "vegetarian" | "vegan";
export interface MealRecipe {
  id: string;
  name: string;
  /** What is on the plate, in plain words (shown under the name). */
  plate: string;
  tags: MealTag[];
  /** Built-in food id and grams, per serving. */
  parts: { food: string; g: number }[];
}

export const MEAL_LIBRARY: MealRecipe[] = [
  { id: "oats-banana", name: "Oats with banana and honey", plate: "Rolled oats cooked in milk, one banana, a spoon of honey", tags: ["before", "breakfast", "vegetarian"], parts: [{ food: "oats", g: 60 }, { food: "milk", g: 200 }, { food: "banana", g: 118 }, { food: "honey", g: 15 }] },
  { id: "pb-bagel", name: "Bagel with peanut butter and banana", plate: "One plain bagel, peanut butter, one banana", tags: ["before", "breakfast", "snack", "vegetarian"], parts: [{ food: "bagel", g: 105 }, { food: "pb", g: 30 }, { food: "banana", g: 118 }] },
  { id: "yogurt-berries", name: "Greek yogurt with berries and granola", plate: "Greek yogurt, raspberries and blueberries, granola", tags: ["after", "breakfast", "snack", "vegetarian"], parts: [{ food: "yogurt-2", g: 200 }, { food: "raspberries", g: 60 }, { food: "blueberries", g: 60 }, { food: "granola", g: 40 }] },
  { id: "eggs-toast", name: "Scrambled eggs on toast", plate: "Three eggs, two slices of whole wheat toast, tomato", tags: ["after", "breakfast", "vegetarian"], parts: [{ food: "egg", g: 150 }, { food: "bread-ww", g: 80 }, { food: "tomato", g: 100 }] },
  { id: "chicken-rice", name: "Chicken, rice and broccoli", plate: "Grilled chicken breast, white rice, steamed broccoli", tags: ["after", "lunch", "dinner"], parts: [{ food: "chicken", g: 150 }, { food: "rice-white", g: 200 }, { food: "broccoli", g: 120 }] },
  { id: "tuna-pasta", name: "Tuna pasta salad", plate: "Pasta, tuna, sweetcorn, cucumber, cherry tomatoes, olive oil", tags: ["lunch", "after"], parts: [{ food: "pasta", g: 200 }, { food: "tuna", g: 100 }, { food: "corn", g: 60 }, { food: "cucumber", g: 60 }, { food: "tomato", g: 60 }, { food: "olive-oil", g: 10 }] },
  { id: "chicken-wrap", name: "Chicken wrap", plate: "Whole wheat tortilla, chicken breast, lettuce, tomato, yogurt dressing", tags: ["lunch", "snack"], parts: [{ food: "tortilla-ww", g: 60 }, { food: "chicken", g: 100 }, { food: "salad", g: 40 }, { food: "tomato", g: 40 }, { food: "yogurt-2", g: 30 }] },
  { id: "lentil-dal", name: "Lentil dal with rice", plate: "Red lentils cooked with tomato and spices, white rice", tags: ["dinner", "vegetarian", "vegan"], parts: [{ food: "lentils", g: 200 }, { food: "rice-white", g: 180 }, { food: "tomato", g: 60 }, { food: "olive-oil", g: 8 }] },
  { id: "tofu-bowl", name: "Tofu and vegetable bowl", plate: "Firm tofu, broccoli, carrots, edamame, brown rice", tags: ["dinner", "vegetarian", "vegan"], parts: [{ food: "tofu", g: 150 }, { food: "rice-brown", g: 200 }, { food: "broccoli", g: 80 }, { food: "carrots", g: 60 }, { food: "edamame", g: 50 }, { food: "olive-oil", g: 8 }] },
  { id: "salmon-potatoes", name: "Salmon with potatoes and green beans", plate: "Salmon fillet, boiled baby potatoes, green beans", tags: ["dinner", "after"], parts: [{ food: "salmon", g: 150 }, { food: "potato", g: 250 }, { food: "green-beans", g: 100 }, { food: "olive-oil", g: 5 }] },
];

export const mealPhoto = (id: string, size: "s" | "l" = "s") => `/food/${id}${size === "s" ? "-s" : ""}.webp`;

const byId = new Map(BUILTIN.map((f) => [f.id.replace(/^builtin-/, ""), f]));
/** Macros for one serving, summed from the built-in foods. */
export function mealMacros(m: MealRecipe): Macros {
  return m.parts.reduce<Macros>((acc, p) => {
    const f = byId.get(p.food);
    return f ? addM(acc, scaleM(f.per100, p.g / 100)) : acc;
  }, { kcal: 0, carbs: 0, protein: 0, fat: 0, fibre: 0, sodium: 0 });
}
/** "150 g chicken breast" from a part, using the food's own name. */
export const partLabel = (p: { food: string; g: number }, scale = 1) => `${Math.round(p.g * scale)} g ${(byId.get(p.food)?.name ?? p.food).split(",")[0].toLowerCase()}`;
export const TAG_LABEL: Record<MealTag, string> = { before: "Before a session", after: "After a session", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", vegetarian: "Vegetarian", vegan: "Vegan" };
