// The parts of the Today screen, top to bottom: week cards, session card, last result, body this morning,
// weekly volume chart, and sessions / load / race with the phase bar.
import { router } from "expo-router";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { zoneOfIn } from "@shared/analysis";
import type { Activity, Phase, Session, Week } from "@shared/data";
import { DAYS, fmtDur, fmtHMS, fmtPace, fromYmd, shortDate } from "@shared/format";
import { sessionFuel } from "@shared/nutrition/targets";
import { fmtDist, fmtSpeed, localize, runPace, swimDist, swimPace, unitWords } from "@shared/units";
import { hardestStep } from "@shared/workout";
import { Icon } from "./Icon";
import { SportIcon } from "./SportIcon";
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
const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysOf = (week: Week) => Array.from({ length: 7 }, (_, i) => { const d = fromYmd(week.start); d.setDate(d.getDate() + i); return ymdOf(d); });

/** The one session shown for a day (double days show the first). */
export const mainOf = (sessions: Session[]) => sessions.filter((s) => s.sport !== "rest").sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];

// ---------- week cards ----------
export function WeekStrip({ week, selected, today, onPick, c }: { week: Week; selected: string; today: string; onPick: (d: string) => void; c: Palette }) {
  return (
    <View style={st.strip}>
      {daysOf(week).map((key, i) => {
        const s = mainOf(week.sessions.filter((x) => x.date === key));
        const on = key === selected, isToday = key === today;
        const fg = on ? c.accent : key < today && !s?.actual ? c.muted : c.ink;
        return (
          <Pressable key={key} onPress={() => onPick(key)} style={[st.day, { backgroundColor: on ? c.accentSoft : c.surface2 }, !on && isToday && { borderColor: c.accent }]} accessibilityLabel={`${DAYS[i]} ${fromYmd(key).getDate()}${s ? `, ${SPORT[s.sport]}` : ", rest"}`}>
            <Text style={[st.dow, { color: on ? c.accent : c.ink2 }]}>{DAYS[i]}</Text>
            <Text style={[st.dnum, { color: on ? c.accent : c.ink }]}>{fromYmd(key).getDate()}</Text>
            <View style={st.dicon}>{s && <SportIcon sport={s.sport} size={20} color={fg} />}</View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- facts ----------
type Fact = { k: string; v: string; u?: string };
function Facts({ facts, ink, muted, gap = 28 }: { facts: Fact[]; ink: string; muted: string; gap?: number }) {
  return (
    <View style={[st.facts, { columnGap: gap }]}>
      {facts.map((f) => (
        <View key={f.k}>
          <Text style={[st.fk, { color: muted }]}>{f.k}</Text>
          <Text style={[st.fv, { color: ink }]}>{f.v}{f.u ? <Text style={[st.fu, { color: muted }]}> {f.u}</Text> : null}</Text>
        </View>
      ))}
    </View>
  );
}

const WORD_ZONE: Record<string, number> = { Recovery: 2, Technique: 2, Aerobic: 2, "Zone 2": 2, Endurance: 2, Tempo: 3, Race: 3, Threshold: 4, Intervals: 5 };
/** Intensity is always the heart rate zone to be in, Zone 2 to Zone 5. */
function zoneOfSession(s: Session, zones: Record<string, Record<string, string>> | null) {
  const step = zones ? hardestStep(s, zones) : null;
  return Math.min(5, Math.max(2, step?.seg.zone ?? WORD_ZONE[s.intensity] ?? 2));
}

function plannedFacts(s: Session, zones: Record<string, Record<string, string>> | null): Fact[] {
  const out: Fact[] = [{ k: "Duration", v: fmtDur(s.min) }, { k: "Intensity", v: `Zone ${zoneOfSession(s, zones)}` }];
  if (zones) {
    const key = hardestStep(s, zones);
    const strip = (x: string) => x.replace(/\s*\/(mi|km|100 yd|100 m)$/, "");
    const t = key && /\d/.test(key.seg.target) ? strip(key.seg.target) : null;
    const w = unitWords();
    if (s.sport === "run") { const z = zones.run?.[s.intensity] ?? zones.run?.["Zone 2"]; const v = t ?? (z ? strip(localize(`${z} /mi`)) : null); if (v) out.push({ k: "Target pace", v, u: w.perDist }); }
    else if (s.sport === "bike" || s.sport === "brick") { const z = zones.bike?.[s.intensity] ?? zones.bike?.["Zone 2"]; const v = t ?? (z ? localize(z) : null); if (v) out.push({ k: "Target speed", v }); }
    else if (s.sport === "swim") { const z = zones.swim?.[s.intensity] ?? zones.swim?.Aerobic; const v = t ?? (z ? strip(localize(`${z} /100 yd`)) : null); if (v) out.push({ k: "Target pace", v, u: w.perSwim.replace("per ", "/") }); }
  }
  return out;
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

// ---------- score ring (done card) and gauge (last result) ----------
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

function Gauge({ score, size, color, track, ink }: { score: number; size: number; color: string; track: string; ink: string }) {
  // a 270° arc open at the bottom, filled to the score
  const w = size * 0.1, r = (size - w) / 2, cx = size / 2, cy = size / 2;
  const at = (deg: number) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (from: number, to: number) => { const [x1, y1] = at(from), [x2, y2] = at(to); return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`; };
  const end = -135 + (270 * Math.max(1, score)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={arc(-135, 135)} stroke={track} strokeWidth={w} fill="none" strokeLinecap="round" />
        <Path d={arc(-135, end)} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={{ color: ink, fontSize: size * 0.34, fontWeight: "700", letterSpacing: -0.5 }}>{score}</Text>
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
      <View style={[st.card, st.tall, { backgroundColor: c.hero }]}>
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
        <Facts facts={doneFacts(a)} ink={c.ink} muted={c.muted} gap={16} />
      </Pressable>
    );
  }
  const f = sessionFuel(s, weightKg);
  const dev = device.key === "garmin" ? `garmin-${s.sport === "bike" || s.sport === "brick" ? "bike" : s.sport === "swim" ? "swim" : "run"}` : device.key;
  const litres = Math.round(((f.fluidLh * s.min) / 60) * 10) / 10;
  const during = [f.perHour ? `${f.perHour} g/h` : null, litres ? `${litres} L` : null].filter(Boolean).join(", ") || "Water";
  return (
    <View style={[st.card, st.tall, { backgroundColor: c.hero }]}>
      <View style={st.top}>
        <View style={{ flex: 1 }}>
          {label && <Text style={st.when}>{label}</Text>}
          <Text style={[st.sport, { color: "#fff" }]}>{SPORT[s.sport] ?? s.title}</Text>
        </View>
        <View style={st.device}>
          {DEVICE_IMG[dev] && device.status !== "none" && <Image source={DEVICE_IMG[dev]} style={{ height: 62, width: 45 }} resizeMode="contain" />}
          <Pressable onPress={() => router.push("/profile")} style={({ pressed }) => [st.connBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Wearable connection">
            <View>
              <View style={st.conn}>
                <View style={[st.dot, { backgroundColor: device.status === "none" ? "#6B7280" : "#3FB97A" }]} />
                <Text style={st.connText}>{device.status === "connected" ? "Connected" : device.status === "imported" ? "Imported" : "Connect"}</Text>
              </View>
              {device.status !== "none" && <Text style={st.devName}>{DEVICE_NAME[device.key] ?? device.key}</Text>}
            </View>
            <Icon name="chevron" size={14} color="#9AA1AD" stroke={2} />
          </Pressable>
        </View>
      </View>
      <Facts facts={plannedFacts(s, zones)} ink="#fff" muted="#9AA1AD" />
      {s.sport !== "strength" && (
        <View style={st.fuel}>
          <Pressable onPress={() => router.push("/fuel")} style={st.fuelCell} accessibilityRole="button" accessibilityLabel="Fuel before">
            <Icon name="gel" size={22} color="#D6D9DF" />
            <View><Text style={st.fuelK}>Before</Text><Text style={st.fuelV}>{f.before ? `${f.before} g carbs` : "Normal meal"}</Text></View>
            <View style={st.fuelGo}><Icon name="chevron" size={13} color="#6B7280" stroke={2} /></View>
          </Pressable>
          <View style={st.fuelDiv} />
          <Pressable onPress={() => router.push("/fuel")} style={st.fuelCell} accessibilityRole="button" accessibilityLabel="Fuel during">
            <Icon name="bottle" size={22} color="#D6D9DF" />
            <View><Text style={st.fuelK}>During</Text><Text style={st.fuelV}>{during}</Text></View>
            <View style={st.fuelGo}><Icon name="chevron" size={13} color="#6B7280" stroke={2} /></View>
          </Pressable>
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
/** Garmin names a session after where it was ("Munich Running"); that place is shown under the sport. */
const GENERIC = /^(pool|trainer|indoor|treadmill|virtual|easy|long|tempo|recovery|morning|afternoon|evening|lunch|night|open water|interval|threshold|zone \d|base|aerobic)$/i;
const placeOf = (name: string) => { const p = name.match(/^(.+?)\s+(running|run|cycling|ride|riding|swim|swimming)$/i)?.[1]; return p && !GENERIC.test(p) ? p : null; };

export function LastResult({ a, score, lthr, c }: { a: Activity; score: number | null; lthr: number | null; c: Palette }) {
  const z = zoneOfIn(a, lthr ?? undefined);
  const dist = a.mi != null ? fmtDist(a.mi).split(" ") : a.yd != null ? [swimDist(a.yd).v.toLocaleString(), swimDist(a.yd).u] : null;
  const pace = a.pace_s ? [fmtPace(runPace(a.pace_s).s), runPace(a.pace_s).u] : a.mph ? fmtSpeed(a.mph).split(" ") : a.p100_s ? [fmtPace(swimPace(a.p100_s).s), swimPace(a.p100_s).u] : null;
  const facts = [dist, [fmtHMS(a.min), ""], pace, z ? [`Zone ${z}`, ""] : null].filter(Boolean) as string[][];
  const when = [shortDate(a.date), a.start, placeOf(a.name)].filter(Boolean).join(", ");
  return (
    <Pressable onPress={() => router.push(`/activity/${encodeURIComponent(a.id)}`)} style={[st.last, { backgroundColor: c.surface, borderColor: c.line }]}>
      {score != null ? <Gauge score={score} size={58} color={c.accent} track={c.accentSoft} ink={c.ink} /> : <View style={[st.iconBox, { backgroundColor: c.surface2 }]}><SportIcon sport={a.sport} size={26} color={c.ink} /></View>}
      <View style={[st.vline, { backgroundColor: c.line }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[st.lastTitle, { color: c.ink }]}>{SPORT[a.sport] ?? a.name}</Text>
        <Text style={[st.small, { color: c.muted }]} numberOfLines={1}>{when}</Text>
        <View style={st.lastFacts}>
          {facts.map(([v, u], i) => (
            <View key={i} style={st.lastFact}>
              {i > 0 && <View style={[st.sep, { backgroundColor: c.line }]} />}
              <Text style={[st.lastV, { color: c.ink }]}>{v}{u ? <Text style={[st.lastU, { color: c.muted }]}> {u}</Text> : null}</Text>
            </View>
          ))}
        </View>
      </View>
      <Icon name="chevron" size={14} color={c.muted} />
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

// ---------- weekly volume chart ----------
const SVG_FONT = Platform.OS === "web" ? "system-ui, -apple-system, Segoe UI, sans-serif" : undefined;
const hm = (h: number) => { const m = Math.round(h * 60); return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`; };

export function WeeklyVolume({ week, activities, width, c }: { week: Week; activities: Activity[]; width: number; c: Palette }) {
  const days = daysOf(week);
  const planned = days.map((d) => week.sessions.filter((s) => s.date === d && s.sport !== "rest").reduce((x, s) => x + s.min, 0) / 60);
  const done = days.map((d) => activities.filter((a) => a.date === d).reduce((x, a) => x + a.min, 0) / 60);
  const top = Math.max(1, Math.ceil(Math.max(...planned, ...done)));
  const H = 138, T = 8, L = 26, B = 20, W = width, plotW = W - L, plotH = H - B - T, slot = plotW / 7, bw = Math.min(12, slot * 0.26);
  const y = (h: number) => T + plotH - (h / top) * plotH;
  const ticks = Array.from({ length: top + 1 }, (_, i) => i).filter((i) => top <= 3 || i % Math.ceil(top / 3) === 0 || i === top);
  return (
    <View style={[st.block, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={st.volHead}>
        <View>
          <Text style={[st.h2, { color: c.ink }]}>Weekly volume</Text>
          <Text style={[st.small, { color: c.muted }]}>Completed vs planned</Text>
        </View>
        <Text style={[st.volTotal, { color: c.ink }]}>{hm(done.reduce((a, b) => a + b, 0))}<Text style={[st.fu, { color: c.muted }]}> / {hm(planned.reduce((a, b) => a + b, 0))}</Text></Text>
      </View>
      <Svg width={W} height={H}>
        {ticks.map((t) => (
          <Line key={t} x1={L} x2={W} y1={y(t)} y2={y(t)} stroke={c.line} strokeWidth={1} />
        ))}
        {ticks.map((t) => (
          <SvgText key={`l${t}`} x={0} y={y(t) + 4} fontSize={11} fill={c.muted} fontFamily={SVG_FONT}>{`${t}h`}</SvgText>
        ))}
        {days.map((d, i) => {
          const x0 = L + slot * i + slot / 2;
          return (
            <G key={d}>
              {done[i] > 0 && <Rect x={x0 - bw - 1} y={y(done[i])} width={bw} height={T + plotH - y(done[i])} rx={3} fill={c.accent} />}
              {planned[i] > 0 && <Rect x={x0 + 1} y={y(planned[i])} width={bw} height={T + plotH - y(planned[i])} rx={3} fill={c.accentSoft} />}
              <SvgText x={x0} y={H - 4} fontSize={11} fill={c.muted} textAnchor="middle" fontFamily={SVG_FONT}>{DAYS[i]}</SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={st.legend}>
        <View style={st.leg}><View style={[st.legSq, { backgroundColor: c.accent }]} /><Text style={[st.small, { color: c.ink2 }]}>Completed</Text></View>
        <View style={st.leg}><View style={[st.legSq, { backgroundColor: c.accentSoft }]} /><Text style={[st.small, { color: c.ink2 }]}>Planned</Text></View>
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
  strip: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 9, borderRadius: radius.m, borderWidth: 1, borderColor: "transparent" },
  dow: { fontSize: 12, fontWeight: "500" },
  dnum: { fontSize: 18, fontWeight: "700" },
  dicon: { height: 22, justifyContent: "center" },
  card: { borderRadius: radius.xl, padding: space.l, gap: space.l },
  tall: { paddingVertical: 22, paddingHorizontal: 20, gap: 22 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.m },
  when: { color: "#9AA1AD", fontSize: 12, marginBottom: 2 },
  sport: { fontSize: 40, fontWeight: "800", letterSpacing: -1.2, lineHeight: 44 },
  device: { flexDirection: "row", alignItems: "center", gap: 8 },
  connBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingLeft: 11, paddingRight: 8, borderRadius: radius.m, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)" },
  conn: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  devName: { color: "#9AA1AD", fontSize: 12, marginLeft: 13 },
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: 10 },
  fk: { fontSize: 12, letterSpacing: 0.2 },
  fv: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4, marginTop: 2 },
  fu: { fontSize: 12, fontWeight: "500" },
  fuel: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#2A2D35", paddingTop: 18 },
  fuelCell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  fuelGo: { marginLeft: 2 },
  fuelDiv: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "#2A2D35" },
  fuelK: { color: "#9AA1AD", fontSize: 12 },
  fuelV: { color: "#fff", fontSize: 15, fontWeight: "600" },
  start: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: radius.m, backgroundColor: "rgba(255,255,255,0.1)" },
  startText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  small: { fontSize: 13 },
  tiny: { fontSize: 11 },
  h2: { fontSize: 18, fontWeight: "700" },
  last: { flexDirection: "row", alignItems: "center", gap: space.s, paddingVertical: space.m, paddingHorizontal: space.m, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 4 },
  lastTitle: { fontSize: 17, fontWeight: "700" },
  lastFacts: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  lastFact: { flexDirection: "row", alignItems: "center" },
  sep: { width: 1, height: 14, marginHorizontal: 5 },
  lastV: { fontSize: 13, fontWeight: "700" },
  lastU: { fontSize: 10, fontWeight: "500" },
  iconBox: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  tiles: { flexDirection: "row", gap: space.s },
  tile: { flex: 1, padding: space.m, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  tileV: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  block: { padding: space.l, borderRadius: radius.l, borderWidth: StyleSheet.hairlineWidth, gap: space.m },
  volHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  volTotal: { fontSize: 20, fontWeight: "700", letterSpacing: -0.4 },
  mid: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5, marginTop: 1 },
  legend: { flexDirection: "row", justifyContent: "center", gap: space.xl },
  leg: { flexDirection: "row", alignItems: "center", gap: 6 },
  legSq: { width: 12, height: 12, borderRadius: 3 },
  three: { flexDirection: "row" },
  phaseBar: { flexDirection: "row", gap: 3, alignItems: "center", height: 12 },
  marker: { position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginLeft: -6, top: 0 },
  phaseLbl: { flexDirection: "row", justifyContent: "space-between" },
});
