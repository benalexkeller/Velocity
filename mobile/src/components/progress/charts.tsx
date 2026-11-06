// Small, plain charts for Progress: a line with dots, weekly bars, a sparkline, range pills and the score gauge.
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTheme, type Palette } from "@/lib/theme";

const FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, sans-serif" : undefined;

/** Values over time; `lowerIsBetter` puts low values at the top (pace), so "up" always means better. */
export function LineChart({ values, width, height = 110, color, lowerIsBetter, fmt, c }: { values: number[]; width: number; height?: number; color: string; lowerIsBetter?: boolean; fmt: (v: number) => string; c: Palette }) {
  if (values.length < 2) return <Text style={[st.empty, { color: c.muted }]}>Not enough sessions yet</Text>;
  const T = 14, B = 6, L = 0, R = 44;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const y = (v: number) => T + (lowerIsBetter ? (v - lo) / span : (hi - v) / span) * (height - T - B);
  const x = (i: number) => L + (i / (values.length - 1)) * (width - L - R);
  const d = values.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const best = lowerIsBetter ? lo : hi, worst = lowerIsBetter ? hi : lo;
  return (
    <Svg width={width} height={height}>
      <Line x1={0} x2={width - R + 6} y1={y(best)} y2={y(best)} stroke={c.line} strokeWidth={1} strokeDasharray="3 3" />
      <Line x1={0} x2={width - R + 6} y1={y(worst)} y2={y(worst)} stroke={c.line} strokeWidth={1} strokeDasharray="3 3" />
      <SvgText x={width - R + 10} y={y(best) + 4} fontSize={10} fill={c.muted} fontFamily={FONT}>{fmt(best)}</SvgText>
      <SvgText x={width - R + 10} y={y(worst) + 4} fontSize={10} fill={c.muted} fontFamily={FONT}>{fmt(worst)}</SvgText>
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.2} fill={i === values.length - 1 ? color : c.surface} stroke={color} strokeWidth={1.5} />)}
    </Svg>
  );
}

/** Weekly bars, the last one in full colour. */
export function Bars({ values, labels, width, height = 90, color, fmt, c }: { values: number[]; labels: string[]; width: number; height?: number; color: string; fmt: (v: number) => string; c: Palette }) {
  const top = Math.max(...values, 0.0001), n = values.length, slot = width / n, bw = Math.min(16, slot * 0.6);
  const H = height - 16;
  return (
    <Svg width={width} height={height}>
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 2 : 0, (v / top) * (H - 12));
        return <Rect key={i} x={i * slot + (slot - bw) / 2} y={H - h} width={bw} height={h} rx={3} fill={color} opacity={i === n - 1 ? 1 : 0.35} />;
      })}
      <SvgText x={width} y={Math.max(9, H - Math.max(2, (values[n - 1] / top) * (H - 12)) - 4)} fontSize={10} fill={c.ink} fontWeight="600" textAnchor="end" fontFamily={FONT}>{fmt(values[n - 1])}</SvgText>
      {labels.map((l, i) => (i === 0 || i === n - 1 || i % 4 === 0) && <SvgText key={`l${i}`} x={i * slot + slot / 2} y={height - 2} fontSize={9.5} fill={c.muted} textAnchor="middle" fontFamily={FONT}>{l}</SvgText>)}
    </Svg>
  );
}

export function Spark({ values, width, height = 26, color, c }: { values: number[]; width: number; height?: number; color: string; c: Palette }) {
  if (values.length < 2) return <View style={{ height }} />;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - lo) / span) * (height - 6)]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Line x1={0} x2={width} y1={height - 1} y2={height - 1} stroke={c.line} strokeWidth={1} />
      <Path d={pts.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Circle cx={lx} cy={ly} r={2.6} fill={color} />
    </Svg>
  );
}

/** A 270 degree gauge, open at the bottom, filled to the score. */
export function Gauge({ score, size, color, track, ink, label }: { score: number | null; size: number; color: string; track: string; ink: string; label?: string }) {
  const w = size * 0.09, r = (size - w) / 2, cx = size / 2, cy = size / 2;
  const at = (deg: number) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (a: number, b: number) => { const [x1, y1] = at(a), [x2, y2] = at(b); return `M ${x1} ${y1} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={arc(-135, 135)} stroke={track} strokeWidth={w} fill="none" strokeLinecap="round" />
        {score != null && <Path d={arc(-135, -135 + (270 * Math.max(1, score)) / 100)} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />}
      </Svg>
      <Text style={{ color: ink, fontSize: size * 0.3, fontWeight: "700", letterSpacing: -0.5 }}>{score ?? "-"}</Text>
      {label && <Text style={{ position: "absolute", bottom: 0, fontSize: 11, fontWeight: "600", color: ink }}>{label}</Text>}
    </View>
  );
}

export function RangePills<K extends string>({ options, value, onChange }: { options: { k: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <View style={[st.pills, { backgroundColor: c.surface2 }]}>
      {options.map((o) => (
        <Pressable key={o.k} onPress={() => onChange(o.k)} style={[st.pill, value === o.k && { backgroundColor: c.surface }]} accessibilityRole="button" accessibilityState={{ selected: value === o.k }}>
          <Text style={[st.pillText, { color: value === o.k ? c.ink : c.muted }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  empty: { fontSize: 13, paddingVertical: 20 },
  pills: { flexDirection: "row", borderRadius: 9, padding: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 7 },
  pillText: { fontSize: 12, fontWeight: "600" },
});
