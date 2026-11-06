// Plan, Training Plan: the season at a glance. Planned hours per week (stacked by sport, tap a week to open it),
// the phases under it, and a sheet with the chosen week: hours per sport filling as the work gets done, and each day.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { actualByDiscipline, plannedByDiscipline, type Session, type Week } from "@shared/data";
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
    <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
      {groups.map((g) => {
        const on = cur >= g.from && cur < g.from + g.n;
        return (
          <View key={g.from} style={{ width: g.n * slot - 2 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: on ? c.accent : c.line }} />
            {g.n * slot > 36 && <Text style={[st.phaseLab, { color: on ? c.ink : c.muted }]} numberOfLines={1}>{g.name}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function DayRow({ date, s, first, today, zones, c, dark }: { date: string; s: Session | null; first: boolean; today: string; zones: Record<string, Record<string, string>> | null; c: Palette; dark: boolean }) {
  const d = fromYmd(date), isT = date === today;
  const done = !!s?.actual, missed = !!s && !done && date < today;
  return (
    <View style={[st.row, { borderColor: c.line }, isT && { backgroundColor: c.accentSoft }]}>
      {isT && <View style={[st.todayBar, { backgroundColor: c.accent }]} />}
      <Text style={[st.rowDate, { color: isT ? c.accent : c.muted, fontWeight: isT ? "700" : "500" }]}>{first ? `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}` : ""}</Text>
      {s ? (
        <>
          <View style={[st.chip, { backgroundColor: done ? (dark ? "#F3F4F6" : "#2C2D31") : missed ? c.surface2 : c.accentSoft }]}>
            <SportIcon sport={s.sport} size={14} color={done ? (dark ? "#101114" : "#fff") : missed ? c.muted : c.accent} />
          </View>
          <Text style={[st.rowName, { color: missed ? c.muted : c.ink }]}>{s.title}</Text>
          <Text style={[st.rowSub, { color: c.muted }]} numberOfLines={1}>{fmtDur(s.actual?.min ?? s.min)}, Zone {zoneOfSession(s, zones)}</Text>
          <View style={{ width: 18, alignItems: "flex-end" }}>
            {done ? <Icon name="check" size={16} color={c.ok} stroke={2.6} /> : isKey(s) ? <Icon name="bolt" size={13} color={c.ink2} stroke={2} /> : null}
          </View>
        </>
      ) : (
        <View style={[st.rest, { backgroundColor: c.surface2 }]}><Text style={[st.restText, { color: c.muted }]}>Rest</Text></View>
      )}
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
        <PhaseStrip weeks={weeks} cur={si} width={chartW} c={c} />

        <Text style={[st.h2, { color: c.ink, marginTop: 28, marginBottom: 6 }]}>Phases</Text>
        {(data?.phases ?? []).map((p) => {
          const on = w.week >= p.from && w.week <= p.to;
          return (
            <View key={p.from} style={[st.phase, { borderColor: c.line }]}>
              <View style={[st.phaseBar, { backgroundColor: on ? c.accent : c.line }]} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={st.phaseHead}>
                  <Text style={[st.phaseName, { color: c.ink }]}>{p.short}</Text>
                  {on && <Text style={[st.now, { color: c.accent }]}>Now</Text>}
                  <View style={{ flex: 1 }} />
                  <Text style={[st.phaseMeta, { color: c.muted }]}>{p.from === p.to ? `Week ${p.from}` : `Weeks ${p.from} to ${p.to}`}, up to {p.peakHours.toFixed(1)} h</Text>
                </View>
                {!!p.purpose && <Text style={[st.phaseText, { color: c.ink2 }]}>{p.purpose}</Text>}
              </View>
            </View>
          );
        })}
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
              {days.flatMap((d) => {
                const ss = w.sessions.filter((s) => s.date === d && s.sport !== "rest");
                return ss.length ? ss.map((s, i) => <DayRow key={s.id} date={d} s={s} first={i === 0} today={t} zones={zones} c={c} dark={dark} />) : [<DayRow key={d} date={d} s={null} first today={t} zones={zones} c={c} dark={dark} />];
              })}
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
  phase: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  phaseBar: { width: 3, borderRadius: 2 },
  phaseHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  phaseName: { fontSize: 15, fontWeight: "600" },
  now: { fontSize: 11, fontWeight: "700" },
  phaseMeta: { fontSize: 12 },
  phaseText: { fontSize: 13, lineHeight: 18 },
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, height: 46, borderBottomWidth: StyleSheet.hairlineWidth },
  todayBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  rowDate: { width: 50, fontSize: 13 },
  chip: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rowName: { fontSize: 15, fontWeight: "600", width: 62 },
  rowSub: { flex: 1, fontSize: 13 },
  rest: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  restText: { fontSize: 12, fontWeight: "500" },
});
