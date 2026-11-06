// A small square with the route's outline (GPS points from the wearable). Indoor sessions have no route, so they
// get the same square with the sport's pictogram, keeping the list aligned.
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SportIcon } from "./SportIcon";
import { useTheme } from "@/lib/theme";

export function RouteThumb({ route, sport, size = 56 }: { route?: [number, number][]; sport: string; size?: number }) {
  const { c, dark } = useTheme();
  const bg = dark ? "#1A1D23" : "#EEF2F0";
  if (!route || route.length < 2) {
    return <View style={[st.box, { width: size, height: size, backgroundColor: c.surface2 }]}><SportIcon sport={sport} size={size * 0.36} color={c.line} /></View>;
  }
  // flat projection: longitude shrinks with latitude, so the shape keeps its proportions
  const lat0 = route[0][0], k = Math.cos((lat0 * Math.PI) / 180);
  const xs = route.map((p) => p[1] * k), ys = route.map((p) => p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1e-6, pad = size * 0.16, inner = size - pad * 2;
  const ox = pad + (inner - ((maxX - minX) / span) * inner) / 2, oy = pad + (inner - ((maxY - minY) / span) * inner) / 2;
  const pts = route.map((_, i) => [ox + ((xs[i] - minX) / span) * inner, oy + ((maxY - ys[i]) / span) * inner]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];
  return (
    <View style={[st.box, { width: size, height: size, backgroundColor: bg }]}>
      <Svg width={size} height={size}>
        <Path d={d} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={pts[0][0]} cy={pts[0][1]} r={2.6} fill={dark ? "#F3F4F6" : "#101114"} />
        <Circle cx={ex} cy={ey} r={2.6} fill={c.accent} stroke={bg} strokeWidth={1} />
      </Svg>
    </View>
  );
}

const st = StyleSheet.create({ box: { borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" } });
