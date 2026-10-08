"use client";
// Fuel for one session, where the session is shown (dashboard hero, plan session panel). Same numbers as the
// Nutrition tab (lib/nutrition/targets.ts sessionFuel): before by the clock, per hour during, after by the gap.
import Link from "next/link";
import type { Session } from "@/lib/data";
import { useNutrition } from "@/lib/nutrition/store";

const DRINK_CARB = 0.06; // 6 % drink mix: 60 g carbohydrate per litre
const GEL_G = 25;

/** "60 g carbs per hour: 0.6 L of 6 % drink mix + 1 gel" — the hourly target in things the athlete carries. */
export function perHourInProducts(perHour: number, fluidLh: number) {
  if (!perHour) return fluidLh ? `water, ${fluidLh} L/h` : "water if thirsty";
  const drinkG = Math.round(fluidLh * 1000 * DRINK_CARB);
  const fromDrink = Math.min(perHour, drinkG);
  const gels = Math.max(0, Math.ceil((perHour - fromDrink) / GEL_G));
  return `${perHour} g carbs per hour: ${fluidLh} L of 6 % drink mix${gels ? ` + ${gels} gel${gels > 1 ? "s" : ""}` : ""}`;
}

export function FuelLine({ s }: { s: Session }) {
  const nut = useNutrition();
  if (!nut.ready || s.sport === "rest") return null;
  if (!nut.hasWeight) return <div className="fuel-line muted">Fuel: add your weight under Nutrition to get session targets</div>;
  const f = nut.fuelFor(s);
  const parts = [
    f.before ? `before ${f.before} g carbs by ${f.beforeAt}` : null,
    `during ${f.perHour ? `${f.perHour} g/h` : "water"}${f.fluidLh ? ` · ${f.fluidLh} L/h` : ""}${f.naMgH ? ` · ${f.naMgH} mg sodium/h` : ""}`,
    f.after.carbs ? `after ${f.after.carbs} g carbs + ${f.after.protein} g protein ${f.window}` : `after ${f.after.protein} g protein at the next meal`,
  ].filter(Boolean);
  return <div className="fuel-line"><b>Fuel</b> {parts.join(" · ")}</div>;
}

export function FuelBlock({ s }: { s: Session }) {
  const nut = useNutrition();
  if (!nut.ready || s.sport === "rest") return null;
  if (!nut.hasWeight) return <div className="sp-fuel"><div className="eyebrow muted">Fuel</div><p className="muted">Session fuel needs your weight. <Link href="/nutrition">Set up nutrition →</Link></p></div>;
  const f = nut.fuelFor(s);
  return (
    <div className="sp-fuel" aria-label="Fuel for this session">
      <div className="eyebrow muted">Fuel</div>
      <dl>
        <dt>Before</dt><dd>{f.before ? `${f.before} g carbs by ${f.beforeAt}, low fibre and fat` : "Nothing needed beyond your normal meal"}</dd>
        <dt>During</dt><dd>{perHourInProducts(f.perHour, f.fluidLh)}{f.naMgH ? ` · ${f.naMgH} mg sodium per hour` : ""}{f.perHour > 60 ? " · glucose:fructose mix" : ""}</dd>
        <dt>After</dt><dd>{f.after.carbs ? `${f.after.carbs} g carbs + ${f.after.protein} g protein ${f.window}` : `${f.after.protein} g protein at the next meal`}</dd>
      </dl>
    </div>
  );
}
