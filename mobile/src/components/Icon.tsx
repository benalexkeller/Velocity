// Thin line icons in the website's style (24 × 24, 1.7 stroke, rounded).
import Svg, { Circle, Path } from "react-native-svg";

type Shape = { d: string[]; c?: [number, number, number][] };
const SHAPES: Record<string, Shape> = {
  // tab bar: rounded, SF-like shapes
  today: { d: ["M4.5 10.2 12 4.3l7.5 5.9V19a1.6 1.6 0 0 1-1.6 1.6H14.6v-5.3a.9.9 0 0 0-.9-.9h-3.4a.9.9 0 0 0-.9.9v5.3H6.1A1.6 1.6 0 0 1 4.5 19z"] },
  plan: { d: ["M6 5.2h12a2.3 2.3 0 0 1 2.3 2.3v10.8a2.3 2.3 0 0 1-2.3 2.3H6a2.3 2.3 0 0 1-2.3-2.3V7.5A2.3 2.3 0 0 1 6 5.2zM3.7 9.8h16.6M8 3.4v3.4M16 3.4v3.4"], c: [[8.2, 13.4, 0.35], [12, 13.4, 0.35], [15.8, 13.4, 0.35], [8.2, 16.8, 0.35], [12, 16.8, 0.35]] },
  progress: { d: ["M6.5 19.5v-5M12 19.5v-9.5M17.5 19.5V5"] },
  // outlined fork and knife
  fuel: { d: ["M5.6 3.4v5.7c0 1.4.8 2.6 2 3v7.4a1.1 1.1 0 0 0 2.2 0V12.1c1.2-.4 2-1.6 2-3V3.4M8.7 3.4v6.4", "M17.1 20.6a1.1 1.1 0 0 1-1.1-1.1v-5.4c-1.1-.3-1.8-1.2-1.8-2.4 0-4.5 1.3-7.6 3.5-8.3.4-.1.7.2.7.6v14.5a1.1 1.1 0 0 1-1.3 1.1z"] },
  coach: { d: ["M12 4.8c4.5 0 8.2 3 8.2 6.8s-3.7 6.8-8.2 6.8c-1 0-1.9-.1-2.8-.4L5.3 19.6l1.1-3.2C4.8 15.2 3.8 13.5 3.8 11.6c0-3.8 3.7-6.8 8.2-6.8z", "M8.6 11.7h.01M12 11.7h.01M15.4 11.7h.01"] },
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
  plus: { d: ["M12 5v14M5 12h14"] },
  check: { d: ["M5 12.5l4.5 4.5L19 7.5"] },
  menu: { d: ["M4 7h16M4 12h16M4 17h16"] },
  down: { d: ["M6 9l6 6 6-6"] },
  back: { d: ["M15 6l-6 6 6 6"] },
  close: { d: ["M6 6l12 12M18 6 6 18"] },
  calendar: { d: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"] },
  calendarPlus: { d: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", "M12 12.5v5M9.5 15h5"] },
  bolt: { d: ["M13 3 5 13.5h6l-1 7.5 8-10.5h-6z"] },
  bed: { d: ["M3.5 18.5v-12M3.5 14.5h17v4M20.5 18.5v-4a3 3 0 0 0-3-3h-7v3"], c: [[7, 12, 1.6]] },
  pulse: { d: ["M3 12.5h4l2.2-5.5 4.2 10.5 2.3-5H21"] },
  heart: { d: ["M12 19.8s-7.2-4.5-7.2-10a4.1 4.1 0 0 1 7.2-2.7 4.1 4.1 0 0 1 7.2 2.7c0 5.5-7.2 10-7.2 10z"] },
  scale: { d: ["M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5zM8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.2-1.8"] },
  medal: { d: ["M9.6 13.6 8.2 20.5l3.8-2 3.8 2-1.4-6.9"], c: [[12, 9, 4.6]] },
  route: { d: ["M6 19a2 2 0 1 0 0-.01M18 5a2 2 0 1 0 0-.01M6 17V9.5A3.5 3.5 0 0 1 9.5 6h1M18 7v7.5a3.5 3.5 0 0 1-3.5 3.5h-1"] },
  trend: { d: ["M3.5 16.5 9 11l3.5 3.5 7-7.5M15 7h4.5v4.5"] },
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
