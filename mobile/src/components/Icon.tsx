// Thin line icons in the website's style (24 × 24, 1.7 stroke, rounded).
import Svg, { Circle, Path } from "react-native-svg";

const PATHS = {
  today: ["M3 11.5 12 4l9 7.5M5.5 10v10h13V10", "M10 20v-6h4v6"],
  plan: ["M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"],
  progress: ["M5 20V11M12 20V5M19 20v-8"],
  fuel: ["M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11"],
  coach: ["M4 5h16v11H9l-5 4z", "M8 9.5h8M8 12.5h5"],
  mic: ["M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4"],
} as const;
export type IconName = keyof typeof PATHS | "user";

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {name === "user"
        ? <><Circle cx={12} cy={8.5} r={3.5} /><Path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" /></>
        : PATHS[name].map((d) => <Path key={d} d={d} />)}
    </Svg>
  );
}
