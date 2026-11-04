"use client";
// Fuel for one session, where the session is shown (dashboard hero, plan session panel). Same numbers as the
// Nutrition tab (lib/nutrition/targets.ts sessionFuel): before by the clock, per hour during, after by the gap.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
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

/** Water for the whole session, to the nearest quarter litre: "0.5 L water", "1 L water". */
const litres = (perHour: number | undefined, min: number) => { if (!perHour) return "Water"; const l = Math.max(0.25, Math.round((perHour * min) / 60 / 0.25) * 0.25); return `${String(l).replace(/\.0$/, "")} L water`; };
/** The fuel strip on today's hero: one cell per fuel item (icon, phase, value); every cell opens the fuel timing under Nutrition. */
export function FuelLine({ s }: { s: Session }) {
  const nut = useNutrition();
  const router = useRouter();
  if (!nut.ready || s.sport === "rest") return null;
  const go = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); router.push("/nutrition#fuel"); };
  const linkProps = { role: "link" as const, tabIndex: 0, onClick: go, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") go(e); } };
  if (!nut.hasWeight) return <div className="fuel-strip"><span className="fs-note">Add your weight under Nutrition to get session fuel</span><span className="fs-link" {...linkProps}>Set up nutrition →</span></div>;
  const f = nut.fuelFor(s);
  const cells: { k: string; icon: IconName; v: string }[] = [
    { k: "Before", icon: "gel", v: f.before ? `${f.before} g carbs` : "Normal meal" },
    ...(f.perHour ? [{ k: "During", icon: "gel" as IconName, v: `${f.perHour} g carbs/h` }] : []),
    { k: f.perHour ? "Fluid" : "During", icon: "bottle", v: litres(f.fluidLh, s.min) },
    { k: "After", icon: "bowl", v: f.after.carbs ? `${f.after.carbs} g carbs + ${f.after.protein} g protein` : `${f.after.protein} g protein` },
  ];
  return (
    <div className="fuel-strip" aria-label="Fuel for today's session">
      {cells.map((c) => <div key={c.k} className="fs-cell" {...linkProps} aria-label={`${c.k}: ${c.v}, open fuel plan`}><span className="fs-icon"><Icon name={c.icon} /></span><div><div className="fs-k">{c.k}</div><div className="fs-v">{c.v}</div></div></div>)}
    </div>
  );
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
        <dt>During</dt><dd>{perHourInProducts(f.perHour, f.fluidLh)}{f.naMgH ? `, ${f.naMgH} mg sodium per hour` : ""}{f.perHour > 60 ? ", glucose:fructose mix" : ""}</dd>
        <dt>After</dt><dd>{f.after.carbs ? `${f.after.carbs} g carbs + ${f.after.protein} g protein ${f.window}` : `${f.after.protein} g protein at the next meal`}</dd>
      </dl>
    </div>
  );
}
