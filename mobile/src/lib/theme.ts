// Colours, sizes and type for the phone app. Light values match the website's style guide (src/app/globals.css);
// dark values are the same palette tuned for a black screen at 5 a.m. The app follows the phone's setting.
import { useColorScheme } from "react-native";

const light = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surface2: "#F3F5F8",
  ink: "#101114",
  ink2: "#27282D",
  muted: "#6B7280",
  line: "#E6E8EC",
  accent: "#2459FE",
  accentSoft: "#E9F1FE",
  accentInk: "#FFFFFF",
  hero: "#101114",
  heroDone: "#0E2E8A",
  swim: "#5B8DEF",
  bike: "#2459FE",
  run: "#283456",
  ok: "#157347",
  warn: "#B54708",
  danger: "#B42318",
  tabBar: "#FFFFFF",
};
export type Palette = typeof light;
export const LIGHT = light;

const dark: Palette = {
  bg: "#0B0C0F",
  surface: "#15171C",
  surface2: "#1C1F26",
  ink: "#F3F4F6",
  ink2: "#D6D9DF",
  muted: "#9AA1AD",
  line: "#262931",
  accent: "#4C7BFF",
  accentSoft: "#17244A",
  accentInk: "#FFFFFF",
  hero: "#15171C",
  heroDone: "#0E2E8A",
  swim: "#7FA6F5",
  bike: "#4C7BFF",
  run: "#9AA9D6",
  ok: "#3FB97A",
  warn: "#F0A04B",
  danger: "#F26B5E",
  tabBar: "#111317",
};

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 16, xl: 22, round: 999 };
export const type = {
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  h2: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, letterSpacing: 0.3 },
  big: { fontSize: 34, fontWeight: "700" as const, letterSpacing: -1 },
};

export function useTheme() {
  const scheme = useColorScheme();
  return { c: scheme === "dark" ? dark : light, dark: scheme === "dark" };
}
