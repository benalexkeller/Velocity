// Small, plain charts for Progress: a line with dots, weekly bars, a sparkline, range pills and the score gauge.
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
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

// ---------- charts with axes (Progress, rebuilt 6 Nov 2026) ----------
const ticksOf = (lo: number, hi: number, n = 4) => Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);

/** Weekly line with a soft fill under it, y labels on the left, x labels under the points. */
export function AreaLine({ values, labels, width, height = 130, color, lowerIsBetter, fmt, c }: { values: (number | null)[]; labels: string[]; width: number; height?: number; color: string; lowerIsBetter?: boolean; fmt: (v: number) => string; c: Palette }) {
  const vs = values.filter((v): v is number => v != null);
  if (vs.length < 2) return <Text style={[st.empty, { color: c.muted }]}>Not enough sessions yet</Text>;
  const L = 34, B = 18, T = 6, pad = (Math.max(...vs) - Math.min(...vs)) * 0.25 || Math.max(...vs) * 0.05 || 1;
  const lo = Math.min(...vs) - pad, hi = Math.max(...vs) + pad;
  const y = (v: number) => T + (lowerIsBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)) * (height - T - B);
  const n = values.length, x = (i: number) => L + 14 + (i / (n - 1)) * (width - L - 32);
  const pts = values.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
  const line = pts.map(([px, py], i) => `${i ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts[pts.length - 1][0]} ${height - B} L ${pts[0][0]} ${height - B} Z`;
  return (
    <Svg width={width} height={height}>
      {ticksOf(lo, hi, 3).map((t) => (
        <Line key={`g${t}`} x1={L} x2={width} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />
      ))}
      {ticksOf(lo, hi, 3).map((t) => (
        <SvgText key={`t${t}`} x={L - 5} y={y(t) + 3.5} fontSize={9.5} fill={c.muted} textAnchor="end" fontFamily={FONT}>{fmt(t)}</SvgText>
      ))}
      <Path d={area} fill={color} opacity={0.1} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {pts.map(([px, py], i) => <Circle key={i} cx={px} cy={py} r={3.5} fill={c.surface} stroke={color} strokeWidth={1.8} />)}
      {labels.map((l, i) => <SvgText key={`x${i}`} x={x(i)} y={height - 3} fontSize={9.5} fill={c.muted} textAnchor="middle" fontFamily={FONT}>{l}</SvgText>)}
    </Svg>
  );
}

/** Weekly bars with y labels on the left. */
export function AxisBars({ values, labels, width, height = 130, color, fmt, c }: { values: number[]; labels: string[]; width: number; height?: number; color: string; fmt: (v: number) => string; c: Palette }) {
  const L = 28, B = 18, T = 6;
  const top = Math.max(...values, 0.0001) * 1.15;
  const y = (v: number) => T + (1 - v / top) * (height - T - B);
  const n = values.length, slot = (width - L) / n, bw = Math.min(30, slot * 0.6);
  return (
    <Svg width={width} height={height}>
      {ticksOf(0, top, 3).map((t) => <Line key={`g${t}`} x1={L} x2={width} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />)}
      {ticksOf(0, top, 3).map((t) => <SvgText key={`t${t}`} x={L - 5} y={y(t) + 3.5} fontSize={9.5} fill={c.muted} textAnchor="end" fontFamily={FONT}>{fmt(t)}</SvgText>)}
      {values.map((v, i) => <Rect key={i} x={L + i * slot + (slot - bw) / 2} y={y(v)} width={bw} height={Math.max(0, height - B - y(v))} rx={3} fill={color} />)}
      {labels.map((l, i) => <SvgText key={`x${i}`} x={L + i * slot + slot / 2} y={height - 3} fontSize={9.5} fill={c.muted} textAnchor="middle" fontFamily={FONT}>{l}</SvgText>)}
    </Svg>
  );
}

/** Hours per bucket stacked by sport (run at the bottom), the planned total as an outline around it. */
export function StackBars({ buckets, width, height = 160, colors, c }: { buckets: { label: string; run: number; bike: number; swim: number; other: number; planned: number }[]; width: number; height?: number; colors: { run: string; bike: string; swim: string; other: string; plan: string }; c: Palette }) {
  const L = 26, B = 18, T = 6;
  const top = Math.max(1, Math.ceil(Math.max(...buckets.map((b) => Math.max(b.planned, b.run + b.bike + b.swim + b.other)))));
  const y = (v: number) => T + (1 - v / top) * (height - T - B);
  const n = buckets.length, slot = (width - L) / n, bw = Math.min(34, slot * 0.62);
  const step = top <= 4 ? 1 : Math.ceil(top / 4);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  return (
    <Svg width={width} height={height}>
      {ticks.map((t) => <Line key={`g${t}`} x1={L} x2={width} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />)}
      {ticks.map((t) => <SvgText key={`t${t}`} x={L - 6} y={y(t) + 3.5} fontSize={9.5} fill={c.muted} textAnchor="end" fontFamily={FONT}>{t}</SvgText>)}
      {buckets.map((b, i) => {
        const x0 = L + i * slot + (slot - bw) / 2;
        let acc = 0;
        const parts = (["run", "bike", "swim", "other"] as const).map((k) => { const y1 = y(acc + b[k]), y0 = y(acc); acc += b[k]; return b[k] > 0 ? <Rect key={k} x={x0} y={y1} width={bw} height={Math.max(0, y0 - y1)} fill={colors[k]} /> : null; });
        return (
          <G key={i}>
            {parts}
            {b.planned > 0 && <Rect x={x0} y={y(b.planned)} width={bw} height={Math.max(0, height - B - y(b.planned))} fill="none" stroke={colors.plan} strokeWidth={1.5} rx={2} />}
            <SvgText x={x0 + bw / 2} y={height - 3} fontSize={9.5} fill={c.muted} textAnchor="middle" fontFamily={FONT}>{b.label}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** The score as a wide white arc on blue: track, filled part, a knob at the end, 0 and 100 at the ends. */
export function ScoreArc({ score, label, size = 250 }: { score: number | null; label: string; size?: number }) {
  const w = 8, r = size / 2 - 16, cx = size / 2, cy = size / 2 + 8;
  const at = (deg: number) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (a: number, b: number) => { const [x1, y1] = at(a), [x2, y2] = at(b); return `M ${x1} ${y1} A ${r} ${r} 0 ${b - a > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const end = -115 + (230 * Math.max(0, Math.min(100, score ?? 0))) / 100;
  const [kx, ky] = at(end), [sx, sy] = at(-115), [ex, ey] = at(115);
  const h = Math.round(cy + r * Math.sin((25 * Math.PI) / 180) + 30); // room for the arc ends and the 0 and 100
  return (
    <View style={{ width: size, height: h, alignItems: "center" }}>
      <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
        <Path d={arc(-115, 115)} stroke="rgba(255,255,255,0.32)" strokeWidth={w} fill="none" strokeLinecap="round" />
        {score != null && <Path d={arc(-115, end)} stroke="#FFFFFF" strokeWidth={w} fill="none" strokeLinecap="round" />}
        {score != null && <Circle cx={kx} cy={ky} r={13} fill="rgba(255,255,255,0.28)" />}
        {score != null && <Circle cx={kx} cy={ky} r={7.5} fill="#FFFFFF" />}
        <SvgText x={sx} y={sy + 22} fontSize={12} fill="rgba(255,255,255,0.85)" textAnchor="middle" fontFamily={FONT}>0</SvgText>
        <SvgText x={ex} y={ey + 22} fontSize={12} fill="rgba(255,255,255,0.85)" textAnchor="middle" fontFamily={FONT}>100</SvgText>
      </Svg>
      <Text style={{ color: "#fff", fontSize: 64, fontWeight: "800", letterSpacing: -2, marginTop: size * 0.24 }}>{score ?? "-"}</Text>
      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 17, fontWeight: "500", marginTop: -4 }}>{label}</Text>
    </View>
  );
}
