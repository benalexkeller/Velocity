// Thin line icons in the website's style (24 × 24, 1.7 stroke, rounded).
import Svg, { Circle, Path } from "react-native-svg";

type Shape = { d: string[]; c?: [number, number, number][] };
const SHAPES: Record<string, Shape> = {
  today: { d: ["M3 11.5 12 4l9 7.5M5.5 10v10h13V10", "M10 20v-6h4v6"] },
  plan: { d: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"] },
  progress: { d: ["M5 20V11M12 20V5M19 20v-8"] },
  fuel: { d: ["M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11"] },
  coach: { d: ["M4 5h16v11H9l-5 4z", "M8 9.5h8M8 12.5h5"] },
  mic: { d: ["M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"] },
  user: { d: ["M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5"], c: [[12, 8.5, 3.5]] },
  swim: { d: ["M2 17c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M2 21c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M8 12l4-5 4 3"], c: [[17.5, 6, 1.8]] },
  bike: { d: ["M5.5 17.5 10 10h4.5l4 7.5M10 10 8.5 7.5H13M10 10l3 7.5"], c: [[5.5, 17.5, 3.5], [18.5, 17.5, 3.5]] },
  run: { d: ["M14.5 7.5 10 11l3 3.5-2.5 5M13 14.5l4 3 1.5 3M10 11l4.5-1 4 2.5M9.5 13.5 5.5 15"], c: [[15.5, 4.5, 2]] },
  strength: { d: ["M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"] },
  rest: { d: ["M3 18V9h18v9M3 13h18M6 9V6h5v3"] },
  gel: { d: ["M9.5 2.5h5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1zM9.5 6 7 9v10a2.5 2.5 0 0 0 2.5 2.5h5A2.5 2.5 0 0 0 17 19V9l-2.5-3M12.8 9.5l-2.6 4h2l-1 3.5 2.6-4.5h-2z"] },
  bottle: { d: ["M10 2.5h4v3M9 5.5h6l1.5 3v9.5a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3V8.5zM8.5 12h7M8.5 15h7"] },
  play: { d: ["M8 5.5v13l10.5-6.5z"] },
  chevron: { d: ["M9 6l6 6-6 6"] },
};
export type IconName = keyof typeof SHAPES;
export const sportIcon = (sport: string): IconName => (sport === "brick" ? "bike" : sport in SHAPES ? sport : "run");

export function Icon({ name, size = 24, color, stroke = 1.7 }: { name: IconName; size?: number; color: string; stroke?: number }) {
  const sh = SHAPES[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {sh.d.map((d) => <Path key={d} d={d} />)}
      {sh.c?.map(([cx, cy, r]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
    </Svg>
  );
}
