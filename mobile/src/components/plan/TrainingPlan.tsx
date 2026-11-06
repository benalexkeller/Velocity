// Plan, Training Plan: the season at a glance. Planned hours per week (stacked by sport, tap a week to open it),
// the phases under it, and a sheet with the chosen week: hours per sport filling as the work gets done, and each day.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { actualByDiscipline, plannedByDiscipline, type Phase, type Session, type Week } from "@shared/data";
import { DAYS, addDays, fmtDur, fromYmd, today as todayDate, ymd } from "@shared/format";
import { Icon } from "../Icon";
import { SnapSheet } from "../Sheet";
import { SportIcon } from "../SportIcon";
import { zoneOfSession } from "../today";
import { isKey } from "./blocks";
import { useAthlete } from "@/lib/athlete";
import { useTheme, type Palette } from "@/lib/theme";

const hm = (h: number) => { const m = Math.round(h * 60); if (!m) return "0m"; return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`; };
const SPORTS = [{ k: "swim", label: "Swim" }, { k: "bike", label: "Bike" }, { k: "run", label: "Run" }] as const;
const CHART_H = 140;

function Chart({ weeks, cur, sel, onPick, width, c, other }: { weeks: Week[]; cur: number; sel: number; onPick: (i: number) => void; width: number; c: Palette; other: string }) {
  const per = weeks.map((w) => plannedByDiscipline(w));
  const tot = per.map((p) => p.swim + p.bike + p.run + p.other);
  const top = Math.max(1, Math.ceil(Math.max(...tot)));
  const slot = width / weeks.length, bw = Math.max(4, slot - 3);
  const y = (h: number) => CHART_H - (h / top) * CHART_H;
  return (
    <View>
      <View style={{ height: 26 }}>
        <View style={[st.bubble, { left: Math.min(width - 44, Math.max(0, slot * sel + slot / 2 - 22)), backgroundColor: sel === cur ? c.accent : c.ink }]}>
          <Text style={st.bubbleText}>{sel === cur ? "Now" : `W${weeks[sel]?.week}`}</Text>
        </View>
      </View>
      <View>
        <Text style={[st.yTop, { color: c.muted }]}>{top} h</Text>
        <Svg width={width} height={CHART_H}>
          {per.map((p, i) => {
            let acc = 0;
            const op = i === sel ? 1 : 0.32;
            return [["swim", c.swim], ["bike", c.bike], ["run", c.run], ["other", other]].map(([k, col]) => {
              const v = p[k as keyof typeof p]; if (!v) return null;
              const y1 = y(acc + v), h = y(acc) - y1; acc += v;
              return <Rect key={`${i}${k}`} x={i * slot + (slot - bw) / 2} y={y1} width={bw} height={Math.max(0, h - 0.5)} rx={k === "run" || acc === tot[i] ? 2 : 0} fill={col} opacity={op} />;
            });
          })}
        </Svg>
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
          {weeks.map((w, i) => <Pressable key={w.week} style={{ width: slot, height: CHART_H }} onPress={() => onPick(i)} accessibilityLabel={`Week ${w.week}`} />)}
        </View>
      </View>
      <View style={{ height: 18, marginTop: 4 }}>
        {weeks.map((w, i) => (i % 4 === 0 || i === weeks.length - 1) && (
          <Text key={w.week} style={[st.xLab, { left: i * slot + slot / 2 - 14, color: i === cur ? c.accent : c.muted, fontWeight: i === cur ? "700" : "400" }]}>W{w.week}</Text>
        ))}
      </View>
    </View>
  );
}

function PhaseStrip({ weeks, cur, width, c }: { weeks: Week[]; cur: number; width: number; c: Palette }) {
  const groups: { name: string; n: number; from: number }[] = [];
  weeks.forEach((w, i) => { const name = w.phaseShort.split(" ")[0]; const g = groups[groups.length - 1]; if (g && g.name === name) g.n++; else groups.push({ name, n: 1, from: i }); });
  const slot = width / weeks.length;
  return (
    <View style={{ marginTop: 2 }}>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {groups.map((g) => <View key={g.from} style={{ width: g.n * slot - 2, height: 4, borderRadius: 2, backgroundColor: c.line }} />)}
      </View>
      {/* this week, right under its bar */}
      <View style={{ position: "absolute", top: 0, left: cur * slot + 1, width: Math.max(4, slot - 3), height: 4, borderRadius: 2, backgroundColor: c.accent }} />
      <View style={{ flexDirection: "row", gap: 2, marginTop: 3 }}>
        {groups.map((g) => {
          const on = cur >= g.from && cur < g.from + g.n;
          return <View key={g.from} style={{ width: g.n * slot - 2 }}>{g.n * slot > 36 && <Text style={[st.phaseLab, { color: on ? c.ink : c.muted, fontWeight: on ? "600" : "400" }]} numberOfLines={1}>{g.name}</Text>}</View>;
        })}
      </View>
    </View>
  );
}

/** One line a coach would say about each block of the plan. */
const PHASE_TEXT: Record<string, string> = {
  "Base 1": "You're building the habit. Every session is easy on purpose, so you can train most days without breaking down.",
  "Base 2": "Same easy effort, longer sessions. The long ride and long run grow each week, with a lighter week to absorb it.",
  "Base 3": "Hills and tempo come in, and you start eating on every long ride. The engine gets stronger, not just bigger.",
  "Build 1": "Now it gets specific: intervals at race effort and your first bricks, so running off the bike starts to feel normal.",
  "Build 2": "The biggest weeks of the plan. Long efforts at race pace, with race-day fueling rehearsed every Saturday.",
  "Peak": "The dress rehearsal: a full race simulation, your longest run and heat preparation, then the load comes down.",
  "Taper": "Volume drops, sharpness stays. Short efforts keep you fast while your body soaks up months of work.",
  "Base": "Easy volume in all three sports. The long sessions get a little longer each week.",
  "Build": "Race-effort intervals and bricks on top of the long sessions.",
};

function Ring({ pct, size, c, on }: { pct: number; size: number; c: Palette; on: boolean }) {
  const w = 3.5, r = (size - w) / 2, C = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={w} fill="none" />
      {pct > 0 && <Circle cx={size / 2} cy={size / 2} r={r} stroke={on ? c.accent : c.ink2} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray={`${C * Math.min(1, pct)} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
    </Svg>
  );
}

function PhaseRow({ p, today, on, open, onToggle, c }: { p: Phase; today: string; on: boolean; open: boolean; onToggle: () => void; c: Palette }) {
  const hours = p.weeks.map((w) => w.plannedMin / 60);
  const total = hours.reduce((a, b) => a + b, 0);
  const done = p.weeks.reduce((n, w) => n + Math.min(1, Math.max(0, (fromYmd(today).getTime() - fromYmd(w.start).getTime()) / (7 * 864e5))), 0);
  const top = Math.max(...hours, 1);
  return (
    <Pressable onPress={onToggle} style={[st.phase, { borderColor: c.line }]} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <View style={st.phaseHead}>
        <Ring pct={done / p.weeks.length} size={30} c={c} on={on} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[st.phaseName, { color: c.ink }]}>{p.short}</Text>
            {on && <Text style={[st.now, { color: c.accent }]}>Now</Text>}
          </View>
          <Text style={[st.phaseMeta, { color: c.muted }]}>{p.from === p.to ? `W${p.from}` : `W${p.from} to W${p.to}`}</Text>
        </View>
        <View style={st.mini}>
          {hours.map((h, i) => <View key={i} style={{ flex: 1, height: Math.max(2, (h / top) * 22), borderRadius: 1.5, backgroundColor: on ? c.accent : c.ink2, opacity: on ? 0.85 : 0.35 }} />)}
        </View>
        <View style={{ width: 52, alignItems: "flex-end" }}>
          <Text style={[st.peak, { color: c.ink }]}>{p.peakHours.toFixed(1)} h</Text>
          <Text style={[st.phaseMeta, { color: c.muted }]}>Peak</Text>
        </View>
        <Icon name="down" size={14} color={c.muted} stroke={2.2} />
      </View>
      {open && (
        <View style={st.phaseOpen}>
          <View style={st.phaseNums}>
            <View><Text style={[st.numV, { color: c.ink }]}>{p.weeks.length}</Text><Text style={[st.phaseMeta, { color: c.muted }]}>Weeks</Text></View>
            <View><Text style={[st.numV, { color: c.ink }]}>{Math.round(total)} h</Text><Text style={[st.phaseMeta, { color: c.muted }]}>Planned</Text></View>
            <View><Text style={[st.numV, { color: c.ink }]}>{(total / p.weeks.length).toFixed(1)} h</Text><Text style={[st.phaseMeta, { color: c.muted }]}>Per Week</Text></View>
            <View><Text style={[st.numV, { color: c.ink }]}>{Math.round((done / p.weeks.length) * 100)}%</Text><Text style={[st.phaseMeta, { color: c.muted }]}>Through</Text></View>
          </View>
          <Text style={[st.phaseText, { color: c.ink2 }]}>{PHASE_TEXT[p.short] ?? PHASE_TEXT[p.short.split(" ")[0]] ?? p.purpose}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SessionLine({ s, today, zones, c, dark }: { s: Session; today: string; zones: Record<string, Record<string, string>> | null; c: Palette; dark: boolean }) {
  const done = !!s.actual, missed = !done && s.date < today;
  return (
    <View style={st.line}>
      <View style={[st.chip, { backgroundColor: done ? (dark ? "#F3F4F6" : "#2C2D31") : missed ? c.surface2 : c.accentSoft }]}>
        <SportIcon sport={s.sport} size={14} color={done ? (dark ? "#101114" : "#fff") : missed ? c.muted : c.accent} />
      </View>
      <Text style={[st.rowName, { color: missed ? c.muted : c.ink }]}>{s.title}</Text>
      <Text style={[st.rowSub, { color: c.muted }]} numberOfLines={1}>{fmtDur(s.actual?.min ?? s.min)}, Zone {zoneOfSession(s, zones)}</Text>
      <View style={{ width: 18, alignItems: "flex-end" }}>
        {done ? <Icon name="check" size={16} color={c.ok} stroke={2.6} /> : isKey(s) ? <Icon name="bolt" size={13} color={c.ink2} stroke={2} /> : null}
      </View>
    </View>
  );
}

function DayRow({ date, ss, today, zones, c, dark }: { date: string; ss: Session[]; today: string; zones: Record<string, Record<string, string>> | null; c: Palette; dark: boolean }) {
  const d = fromYmd(date), isT = date === today;
  return (
    <View style={[st.row, { borderColor: c.line }, isT && { backgroundColor: c.accentSoft }]}>
      {isT && <View style={[st.todayBar, { backgroundColor: c.accent }]} />}
      <Text style={[st.rowDate, { color: isT ? c.accent : c.muted, fontWeight: isT ? "700" : "500" }]}>{`${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}`}</Text>
      <View style={{ flex: 1 }}>
        {ss.length
          ? ss.map((s) => <SessionLine key={s.id} s={s} today={today} zones={zones} c={c} dark={dark} />)
          : <View style={st.line}><View style={[st.rest, { backgroundColor: c.surface2 }]}><Text style={[st.restText, { color: c.muted }]}>Rest</Text></View></View>}
      </View>
    </View>
  );
}

export function TrainingPlan() {
  const { c, dark } = useTheme();
  const { data } = useAthlete();
  const { width } = useWindowDimensions();
  const [h, setH] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const weeks = useMemo(() => (data?.weeks ?? []).filter((w) => w.phaseShort !== "No plan"), [data]);
  const t = ymd(todayDate());
  const cur = Math.max(0, weeks.findIndex((w) => t >= w.start && t <= ymd(addDays(fromYmd(w.start), 6))));
  const [sel, setSel] = useState<number | null>(null);
  const [openPhase, setOpenPhase] = useState<number | null>(null);
  const si = sel ?? cur;
  const w = weeks[si];
  const zones = data?.raw.profile?.zones ?? null;
  const chartW = Math.min(width, 700) - 32;
  const other = dark ? "#3A3F4A" : "#C9CDD4"; // strength and the rest: quiet, so the three sports read first
  const top = 26 + CHART_H + 22 + 30 + 52; // title, chart, labels, phase strip: where the full sheet starts

  if (!w) return <View style={{ padding: 16 }}><Text style={{ color: c.muted }}>No Plan Yet</Text></View>;

  const planned = plannedByDiscipline(w), done = actualByDiscipline(w, data!.activities);
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(fromYmd(w.start), i)));

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.chartHead}>
          <Text style={[st.h2, { color: c.ink }]}>Planned Hours</Text>
          <View style={st.legend}>
            {([["Swim", c.swim], ["Bike", c.bike], ["Run", c.run], ["Other", other]] as const).map(([k, col]) => (
              <View key={k} style={st.leg}><View style={[st.legDot, { backgroundColor: col }]} /><Text style={[st.legText, { color: c.muted }]}>{k}</Text></View>
            ))}
          </View>
        </View>
        <Chart weeks={weeks} cur={cur} sel={si} onPick={(i) => { setSel(i); setExpanded(true); }} width={chartW} c={c} other={other} />
        <PhaseStrip weeks={weeks} cur={cur} width={chartW} c={c} />

        <Text style={[st.h2, { color: c.ink, marginTop: 28, marginBottom: 6 }]}>Phases</Text>
        {(data?.phases ?? []).map((p) => (
          <PhaseRow key={p.from} p={p} today={t} on={weeks[cur] ? weeks[cur].week >= p.from && weeks[cur].week <= p.to : false} open={openPhase === p.from} onToggle={() => setOpenPhase((x) => (x === p.from ? null : p.from))} c={c} />
        ))}
      </ScrollView>

      {h > 0 && (
        <SnapSheet
          peek={70} full={Math.max(300, h - top)} expanded={expanded} onChange={setExpanded}
          header={
            <View style={st.sheetHead}>
              <Text style={[st.week, { color: c.ink }]}>Week {w.week}<Text style={[st.of, { color: c.muted }]}> / {weeks[weeks.length - 1].week}</Text></Text>
              <View style={[st.pill, { backgroundColor: c.surface2 }]}><Text style={[st.pillText, { color: c.ink2 }]}>{w.phaseShort.split(" ")[0]}</Text></View>
              {si !== cur && <Pressable onPress={() => setSel(null)} hitSlop={8} style={{ marginLeft: "auto" }}><Text style={[st.back, { color: c.accent }]}>This Week</Text></Pressable>}
            </View>
          }
        >
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
            <View style={st.cards}>
              {SPORTS.map(({ k, label }) => {
                const p = planned[k], d = done[k], col = c[k];
                return (
                  <View key={k} style={[st.card, { backgroundColor: c.surface2 }]}>
                    <View style={st.cardHead}><SportIcon sport={k} size={15} color={col} /><Text style={[st.cardName, { color: c.ink2 }]}>{label}</Text></View>
                    <Text style={[st.cardV, { color: c.ink }]}>{hm(d)}</Text>
                    <Text style={[st.cardOf, { color: c.muted }]}>of {hm(p)}</Text>
                    <View style={[st.track, { backgroundColor: c.line }]}><View style={{ width: `${p ? Math.min(100, (d / p) * 100) : 0}%`, height: 4, borderRadius: 2, backgroundColor: col }} /></View>
                  </View>
                );
              })}
            </View>
            <View style={[st.list, { borderColor: c.line }]}>
              {days.map((d) => <DayRow key={d} date={d} ss={w.sessions.filter((s) => s.date === d && s.sport !== "rest")} today={t} zones={zones} c={c} dark={dark} />)}
            </View>
          </ScrollView>
        </SnapSheet>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  h2: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  chartHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  legend: { flexDirection: "row", gap: 10 },
  leg: { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot: { width: 7, height: 7, borderRadius: 4 },
  legText: { fontSize: 11 },
  bubble: { position: "absolute", bottom: 4, width: 44, paddingVertical: 3, borderRadius: 8, alignItems: "center" },
  bubbleText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  yTop: { position: "absolute", top: -2, left: 0, fontSize: 10, zIndex: 2 },
  xLab: { position: "absolute", width: 28, textAlign: "center", fontSize: 10 },
  phaseLab: { fontSize: 10, marginTop: 3 },
  phase: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  phaseHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  phaseName: { fontSize: 15, fontWeight: "600" },
  now: { fontSize: 11, fontWeight: "700" },
  phaseMeta: { fontSize: 11, marginTop: 1 },
  mini: { width: 64, height: 22, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  peak: { fontSize: 14, fontWeight: "700" },
  phaseOpen: { paddingLeft: 42, paddingTop: 12, gap: 10 },
  phaseNums: { flexDirection: "row", gap: 22 },
  numV: { fontSize: 16, fontWeight: "700" },
  phaseText: { fontSize: 14, lineHeight: 20 },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  week: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  of: { fontSize: 17, fontWeight: "500" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 12, fontWeight: "600" },
  back: { fontSize: 14, fontWeight: "600" },
  cards: { flexDirection: "row", gap: 8 },
  card: { flex: 1, borderRadius: 12, padding: 12, gap: 2 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardName: { fontSize: 13, fontWeight: "600" },
  cardV: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3 },
  cardOf: { fontSize: 12 },
  track: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  list: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 4, minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: "row", alignItems: "center", gap: 10, height: 38 },
  todayBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  rowDate: { width: 50, fontSize: 13 },
  chip: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowName: { fontSize: 15, fontWeight: "600", width: 62 },
  rowSub: { flex: 1, fontSize: 13 },
  rest: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  restText: { fontSize: 12, fontWeight: "500" },
});
