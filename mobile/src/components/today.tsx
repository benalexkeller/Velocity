// The parts of the Today screen, top to bottom: week strip, session card, last result, body this morning,
// training volume, and sessions / load / race with the phase bar.
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { Activity, Phase, Session, Week } from "@shared/data";
import { DAYS, fmtDur, fmtHMS, fmtPace, fromYmd, shortDate } from "@shared/format";
import { sessionFuel } from "@shared/nutrition/targets";
import { fmtDist, fmtSpeed, localize, runPace, swimDist, swimPace, unitWords } from "@shared/units";
import { hardestStep } from "@shared/workout";
import { Icon, sportIcon } from "./Icon";
import type { BodyRow } from "@/lib/athlete";
import { radius, space, type Palette } from "@/lib/theme";

const SPORT: Record<string, string> = { swim: "Swim", bike: "Bike", run: "Run", brick: "Bike", strength: "Strength", rest: "Rest" };
const DEVICE_IMG: Record<string, number> = {
  "garmin-run": require("../../assets/devices/garmin-run.webp"),
  "garmin-bike": require("../../assets/devices/garmin-bike.webp"),
  "garmin-swim": require("../../assets/devices/garmin-swim.webp"),
  apple: require("../../assets/devices/apple.webp"),
  fitbit: require("../../assets/devices/fitbit.webp"),
  whoop: require("../../assets/devices/whoop.webp"),
};
const DEVICE_NAME: Record<string, string> = { garmin: "Garmin", apple: "Apple Watch", fitbit: "Fitbit", whoop: "WHOOP", coros: "COROS", polar: "Polar", suunto: "Suunto", wahoo: "Wahoo" };

/** The one session shown for a day (double days show the first). */
export const mainOf = (sessions: Session[]) => sessions.filter((s) => s.sport !== "rest").sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];

// ---------- week strip ----------
export function WeekStrip({ week, selected, today, onPick, c }: { week: Week; selected: string; today: string; onPick: (d: string) => void; c: Palette }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = fromYmd(week.start); d.setDate(d.getDate() + i); return d; });
  return (
    <View style={st.strip}>
      {days.map((d, i) => {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const s = mainOf(week.sessions.filter((x) => x.date === key));
        const on = key === selected, isToday = key === today, done = !!s?.actual;
        const fg = on ? "#fff" : key < today && !done ? c.muted : c.ink;
        return (
          <Pressable key={key} onPress={() => onPick(key)} style={[st.day, on && { backgroundColor: c.accent }, !on && isToday && { borderColor: c.accent, borderWidth: 1 }]} accessibilityLabel={`${DAYS[i]} ${d.getDate()}${s ? `, ${SPORT[s.sport]}` : ", rest"}`}>
            <Text style={[st.dow, { color: on ? "#ffffffcc" : c.muted }]}>{DAYS[i].slice(0, 1)}</Text>
            <Text style={[st.dnum, { color: fg }]}>{d.getDate()}</Text>
            {s ? <Icon name={sportIcon(s.sport)} size={15} color={fg} stroke={done ? 2.2 : 1.6} /> : <View style={{ height: 15 }} />}
            <Text style={[st.dtime, { color: on ? "#ffffffcc" : c.muted }]}>{s?.start ?? " "}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- facts ----------
type Fact = { k: string; v: string; u?: string };
function Facts({ facts, ink, muted }: { facts: Fact[]; ink: string; muted: string }) {
  return (
    <View style={st.facts}>
      {facts.map((f) => (
        <View key={f.k}>
          <Text style={[st.fk, { color: muted }]}>{f.k}</Text>
          <Text style={[st.fv, { color: ink }]}>{f.v}{f.u ? <Text style={[st.fu, { color: muted }]}> {f.u}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}

function plannedFacts(s: Session, zones: Record<string, Record<string, string>> | null): Fact[] {
  const out: Fact[] = [];
  if (s.start) out.push({ k: "Start", v: s.start });
  out.push({ k: "Duration", v: fmtDur(s.min) }, { k: "Intensity", v: s.intensity });
  if (zones) {
    const key = hardestStep(s, zones);
    const strip = (x: string) => x.replace(/\s*\/(mi|km|100 yd|100 m)$/, "");
    const t = key && /\d/.test(key.seg.target) ? strip(key.seg.target) : null;
    const w = unitWords();
    if (s.sport === "run") { const z = zones.run?.[s.intensity] ?? zones.run?.["Zone 2"]; const v = t ?? (z ? strip(localize(`${z} /mi`)) : null); if (v) out.push({ k: "Target", v, u: w.perDist }); }
    else if (s.sport === "bike" || s.sport === "brick") { const z = zones.bike?.[s.intensity] ?? zones.bike?.["Zone 2"]; const v = t ?? (z ? localize(z) : null); if (v) out.push({ k: "Target", v }); }
    else if (s.sport === "swim") { const z = zones.swim?.[s.intensity] ?? zones.swim?.Aerobic; const v = t ?? (z ? strip(localize(`${z} /100 yd`)) : null); if (v) out.push({ k: "Target", v, u: w.perSwim }); }
  }
  return out.slice(0, 4);
}

export function doneFacts(a: Activity): Fact[] {
  const out: Fact[] = [];
  if (a.mi != null) { const [v, u] = fmtDist(a.mi).split(" "); out.push({ k: "Distance", v, u }); }
  else if (a.yd != null) { const d = swimDist(a.yd); out.push({ k: "Distance", v: d.v.toLocaleString(), u: d.u }); }
  if (a.pace_s) { const p = runPace(a.pace_s); out.push({ k: "Pace", v: fmtPace(p.s), u: p.u }); }
  else if (a.mph) { const [v, u] = fmtSpeed(a.mph).split(" "); out.push({ k: "Speed", v, u }); }
  else if (a.p100_s) { const p = swimPace(a.p100_s); out.push({ k: "Pace", v: fmtPace(p.s), u: p.u }); }
  if (a.hr) out.push({ k: "Heart rate", v: String(a.hr), u: "bpm" });
  out.push({ k: "Time", v: fmtHMS(a.min) });
  return out.slice(0, 4);
}

// ---------- score ring ----------
export function ScoreRing({ score, size, color, track, ink }: { score: number; size: number; color: string; track: string; ink: string }) {
  const w = Math.max(4, size * 0.1), r = (size - w) / 2, C = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={w} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={`${(C * score) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Text style={{ color: ink, fontSize: size * 0.32, fontWeight: "700" }}>{score}</Text>
    </View>
  );
}

// ---------- session card ----------
export function SessionCard({ s, label, zones, device, weightKg, score, c }: {
  s: Session | undefined; label: string | null; zones: Record<string, Record<string, string>> | null;
  device: { key: string; status: "connected" | "imported" | "none" }; weightKg: number; score: number | null; c: Palette;
}) {
  const done = s?.actual; // completed, partly done or swapped: the card shows what was actually done
  if (!s) {
    return (
      <View style={[st.card, { backgroundColor: c.hero }]}>
        {label && <Text style={st.when}>{label}</Text>}
        <Text style={[st.sport, { color: "#fff" }]}>Rest</Text>
        <Text style={{ color: "#9AA1AD", ...st.small }}>No session planned</Text>
      </View>
    );
  }
  if (done) {
    const a = done;
    return (
      <Pressable onPress={() => router.push(`/activity/${encodeURIComponent(a.id)}`)} style={[st.card, { backgroundColor: c.surface, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth }]}>
        <View style={st.top}>
          <View style={{ flex: 1 }}>
            {label && <Text style={[st.when, { color: c.muted }]}>{label}</Text>}
            <Text style={[st.sport, { color: c.ink }]}>{SPORT[a.sport] ?? a.name}</Text>
            <Text style={[st.small, { color: c.muted }]} numberOfLines={1}>{a.name}</Text>
          </View>
          {score != null && (
            <View style={{ alignItems: "center", gap: 4 }}>
              <ScoreRing score={score} size={64} color={c.accent} track={c.surface2} ink={c.ink} />
              <Text style={[st.fk, { color: c.muted }]}>Score</Text>
            </View>
          )}
        </View>
        <Facts facts={doneFacts(a)} ink={c.ink} muted={c.muted} />
      </Pressable>
    );
  }
  const f = sessionFuel(s, weightKg);
  const dev = device.key === "garmin" ? `garmin-${s.sport === "bike" || s.sport === "brick" ? "bike" : s.sport === "swim" ? "swim" : "run"}` : device.key;
  const litres = Math.round(((f.fluidLh * s.min) / 60) * 10) / 10;
  return (
    <View style={[st.card, { backgroundColor: c.hero }]}>
      <View style={st.top}>
        <View style={{ flex: 1 }}>
          {label && <Text style={st.when}>{label}</Text>}
          <Text style={[st.sport, { color: "#fff" }]}>{SPORT[s.sport] ?? s.title}</Text>
        </View>
        <Pressable onPress={() => router.push("/profile")} style={st.device} accessibilityLabel="Wearable connection">
          {DEVICE_IMG[dev] && device.status !== "none" && <Image source={DEVICE_IMG[dev]} style={{ height: 58, width: 42 }} resizeMode="contain" />}
          <View>
            <View style={st.conn}>
              <View style={[st.dot, { backgroundColor: device.status === "none" ? "#6B7280" : "#3FB97A" }]} />
              <Text style={st.connText}>{device.status === "connected" ? "Connected" : device.status === "imported" ? "Imported" : "Connect"}</Text>
            </View>
            {device.status !== "none" && <Text style={st.devName}>{DEVICE_NAME[device.key] ?? device.key}</Text>}
          </View>
        </Pressable>
      </View>
      <Facts facts={plannedFacts(s, zones)} ink="#fff" muted="#9AA1AD" />
      {s.sport !== "strength" && (
        <View style={st.fuel}>
          <View style={st.fuelCell}>
            <Icon name="gel" size={18} color="#D6D9DF" />
            <View><Text style={st.fuelK}>Before</Text><Text style={st.fuelV}>{f.before ? `${f.before} g carbs · ${f.beforeAt}` : "Nothing extra"}</Text></View>
          </View>
          <View style={st.fuelDiv} />
          <View style={st.fuelCell}>
            <Icon name="bottle" size={18} color="#D6D9DF" />
            <View><Text style={st.fuelK}>During</Text><Text style={st.fuelV}>{[f.perHour ? `${f.perHour} g/h` : null, litres ? `${litres} L` : null].filter(Boolean).join(" · ") || "Water"}</Text></View>
          </View>
        </View>
      )}
      <Pressable style={({ pressed }) => [st.start, pressed && { opacity: 0.7 }]} accessibilityRole="button" onPress={() => {}}>
        <Icon name="play" size={14} color="#fff" stroke={2} />
        <Text style={st.startText}>Start manually</Text>
      </Pressable>
    </View>
  );
}

// ---------- last result ----------
export function LastResult({ a, score, c }: { a: Activity; score: number | null; c: Palette }) {
  const facts = doneFacts(a).filter((f) => f.k !== "Time").slice(0, 3).map((f) => `${f.v}${f.u ? ` ${f.u}` : ""}`);
  return (
    <Pressable onPress={() => router.push(`/activity/${encodeURIComponent(a.id)}`)} style={[st.row, { backgroundColor: c.surface, borderColor: c.line }]}>
      {score != null ? <ScoreRing score={score} size={42} color={c.accent} track={c.surface2} ink={c.ink} /> : <View style={[st.iconBox, { backgroundColor: c.surface2 }]}><Icon name={sportIcon(a.sport)} size={20} color={c.ink} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={[st.rowTitle, { color: c.ink }]} numberOfLines={1}>{a.name} <Text style={{ color: c.muted, fontWeight: "400" }}>· {shortDate(a.date)}</Text></Text>
        <Text style={[st.small, { color: c.muted }]} numberOfLines={1}>{facts.join("  ·  ")}</Text>
      </View>
      <Icon name="chevron" size={16} color={c.muted} />
    </Pressable>
  );
}

// ---------- body this morning ----------
export function BodyToday({ body, today, c }: { body: BodyRow[]; today: string; c: Palette }) {
  const t = body.find((b) => b.date === today);
  if (!t) return null;
  const prev = body.filter((b) => b.date < today);
  const avg = (k: "hrv" | "rhr" | "sleep_score") => { const xs = prev.map((b) => b[k]).filter((x): x is number => x != null); return xs.length >= 5 ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null; };
  const tiles = [
    t.sleep_score != null ? { k: "Sleep score", v: String(t.sleep_score), u: "", n: avg("sleep_score") } : t.sleep_h != null ? { k: "Sleep", v: `${Math.floor(t.sleep_h)}:${String(Math.round((t.sleep_h % 1) * 60)).padStart(2, "0")}`, u: "h", n: null } : null,
    t.hrv != null ? { k: "HRV", v: String(t.hrv), u: "ms", n: avg("hrv") } : null,
    t.rhr != null ? { k: "Resting HR", v: String(t.rhr), u: "bpm", n: avg("rhr") } : null,
  ].filter(Boolean) as { k: string; v: string; u: string; n: number | null }[];
  return (
    <View style={st.tiles}>
      {tiles.map((x) => (
        <View key={x.k} style={[st.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[st.fk, { color: c.muted }]}>{x.k}</Text>
          <Text style={[st.tileV, { color: c.ink }]}>{x.v}<Text style={[st.fu, { color: c.muted }]}>{x.u ? ` ${x.u}` : ""}</Text></Text>
          <Text style={[st.tiny, { color: c.muted }]}>{x.n != null ? `normal ${x.n}` : " "}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------- training volume ----------
export function Volume({ done, planned, bySport, c }: { done: number; planned: number; bySport: { swim: number; bike: number; run: number; other: number }; c: Palette }) {
  const total = Math.max(planned, done, 0.01);
  const parts = [["swim", c.swim], ["bike", c.bike], ["run", c.run], ["other", c.muted]] as const;
  return (
    <View style={[st.block, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[st.fk, { color: c.muted }]}>Training volume this week</Text>
      <Text style={[st.big, { color: c.ink }]}>{done.toFixed(1)}<Text style={[st.fu, { color: c.muted }]}> of {planned.toFixed(1)} h</Text></Text>
      <View style={[st.bar, { backgroundColor: c.surface2 }]}>
        {parts.map(([k, col]) => bySport[k] > 0 && <View key={k} style={{ width: `${(bySport[k] / total) * 100}%`, backgroundColor: col }} />)}
      </View>
      <View style={st.legend}>
        {parts.filter(([k]) => k !== "other").map(([k, col]) => (
          <View key={k} style={st.leg}><View style={[st.legDot, { backgroundColor: col }]} /><Text style={[st.tiny, { color: c.muted }]}>{SPORT[k]} {bySport[k].toFixed(1)} h</Text></View>
        ))}
      </View>
    </View>
  );
}

// ---------- sessions, load, race and the phase bar ----------
export function WeekAndRace({ sessions, load, race, phases, weekNo, c }: {
  sessions: { done: number; total: number }; load: { actual: number; planned: number }; race: { name: string; days: number } | null; phases: Phase[]; weekNo: number | null; c: Palette;
}) {
  const totalWeeks = phases.reduce((s, p) => s + (p.to - p.from + 1), 0);
  const cur = phases.find((p) => weekNo != null && weekNo >= p.from && weekNo <= p.to);
  const pos = weekNo != null && totalWeeks ? Math.min(1, Math.max(0, (weekNo - 0.5) / totalWeeks)) : null;
  return (
    <View style={[st.block, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={st.three}>
        <View style={{ flex: 1 }}><Text style={[st.fk, { color: c.muted }]}>Sessions</Text><Text style={[st.mid, { color: c.ink }]}>{sessions.done}<Text style={[st.fu, { color: c.muted }]}> / {sessions.total}</Text></Text></View>
        <View style={{ flex: 1 }}><Text style={[st.fk, { color: c.muted }]}>Load</Text><Text style={[st.mid, { color: c.ink }]}>{load.actual}<Text style={[st.fu, { color: c.muted }]}> / {load.planned}</Text></Text></View>
        <View style={{ flex: 1 }}><Text style={[st.fk, { color: c.muted }]}>Race</Text><Text style={[st.mid, { color: c.ink }]}>{race ? race.days : "-"}<Text style={[st.fu, { color: c.muted }]}> days</Text></Text></View>
      </View>
      {totalWeeks > 0 && (
        <View style={{ gap: 6 }}>
          <View style={st.phaseBar}>
            {phases.map((p, i) => (
              <View key={p.from} style={{ flex: p.to - p.from + 1, height: 4, borderRadius: 2, backgroundColor: p === cur ? c.accent : i < phases.indexOf(cur as Phase) ? c.ink2 : c.line }} />
            ))}
            {pos != null && <View style={[st.marker, { left: `${pos * 100}%`, backgroundColor: c.accent, borderColor: c.surface }]} />}
          </View>
          <View style={st.phaseLbl}>
            <Text style={[st.tiny, { color: c.ink2 }]}>{cur ? cur.name : ""}</Text>
            <Text style={[st.tiny, { color: c.muted }]}>{race?.name ?? ""}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  strip: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  day: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6, borderRadius: radius.m, borderWidth: 1, borderColor: "transparent" },
  dow: { fontSize: 9, fontWeight: "600" },
  dnum: { fontSize: 14, fontWeight: "600" },
  dtime: { fontSize: 9 },
  card: { borderRadius: radius.xl, padding: space.l, gap: space.l },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.m },
  when: { color: "#9AA1AD", fontSize: 12, marginBottom: 2 },
  sport: { fontSize: 38, fontWeight: "800", letterSpacing: -1.2, lineHeight: 42 },
  device: { flexDirection: "row", alignItems: "center", gap: 8 },
  conn: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  devName: { color: "#9AA1AD", fontSize: 12, marginLeft: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 10 },
  fk: { fontSize: 11, letterSpacing: 0.2 },
  fv: { fontSize: 18, fontWeight: "700", letterSpacing: -0.4, marginTop: 1 },
  fu: { fontSize: 12, fontWeight: "500" },
  fuel: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2A2D35", paddingTop: space.m },
  fuelCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  fuelDiv: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "#2A2D35", marginHorizontal: space.m },
  fuelK: { color: "#9AA1AD", fontSize: 11 },
  fuelV: { color: "#fff", fontSize: 13, fontWeight: "600" },
  start: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: radius.m, backgroundColor: "rgba(255,255,255,0.1)" },
  startText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  small: { fontSize: 13 },
  tiny: { fontSize: 11 },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, padding: space.m, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", gap: space.s },
  tile: { flex: 1, padding: space.m, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  tileV: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  block: { padding: space.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, gap: space.m },
  big: { fontSize: 28, fontWeight: "700", letterSpacing: -0.8, marginTop: -6 },
  mid: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, marginTop: 1 },
  bar: { height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row" },
  legend: { flexDirection: "row", gap: space.l },
  leg: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 7, height: 7, borderRadius: 4 },
  three: { flexDirection: "row" },
  phaseBar: { flexDirection: "row", gap: 3, alignItems: "center", height: 12 },
  marker: { position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginLeft: -6, top: 0 },
  phaseLbl: { flexDirection: "row", justifyContent: "space-between" },
});
