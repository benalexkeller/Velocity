// Plan, Google Calendar style: days run down the screen, each with its training and the athlete's other calendar
// events as small grey blockers. It opens on today; scrolling down walks through the rest of the plan to race day.
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import type { Session, Week } from "@shared/data";
import { DAYS, addDays, fmtDur, fromYmd, today as todayDate, ymd } from "@shared/format";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { SportIcon } from "@/components/SportIcon";
import { zoneOfSession } from "@/components/today";
import { useAthlete } from "@/lib/athlete";
import { useCalendarEvents, type OtherEvent } from "@/lib/calendar";
import { LIGHT, radius, space, type Palette, useTheme } from "@/lib/theme";

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPORT: Record<string, string> = { swim: "Swim", bike: "Bike", run: "Run", brick: "Brick", strength: "Strength" };
// session colours stay the same in dark mode, so white text always reads
const sportColor = (sport: string) => (sport === "swim" ? LIGHT.swim : sport === "run" ? LIGHT.run : sport === "strength" ? LIGHT.ink2 : LIGHT.bike);

type Item = { kind: "session"; at: string; s: Session } | { kind: "event"; at: string; e: OtherEvent };

function SessionChip({ s, past, zones, c }: { s: Session; past: boolean; zones: Record<string, Record<string, string>> | null; c: Palette }) {
  const col = sportColor(s.sport);
  const zone = `Zone ${zoneOfSession(s, zones)}`;
  if (s.actual) {
    const a = s.actual;
    return (
      <Pressable onPress={() => router.push(`/activity/${encodeURIComponent(a.id)}`)} style={[st.chip, st.doneChip, { borderColor: c.line, borderLeftColor: col, backgroundColor: c.surface }]}>
        <SportIcon sport={s.sport} size={16} color={col} />
        <View style={{ flex: 1 }}>
          <Text style={[st.cTitle, { color: c.ink }]} numberOfLines={1}>{SPORT[s.sport] ?? s.title}</Text>
          <Text style={[st.cSub, { color: c.muted }]} numberOfLines={1}>{[a.start ?? s.start, fmtDur(a.min)].filter(Boolean).join(", ")}</Text>
        </View>
        <View style={[st.check, { backgroundColor: c.ok }]}><Icon name="check" size={11} color="#fff" stroke={3} /></View>
      </Pressable>
    );
  }
  return (
    <View style={[st.chip, { backgroundColor: col, opacity: past ? 0.45 : 1 }]}>
      <SportIcon sport={s.sport} size={16} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={[st.cTitle, { color: "#fff" }]} numberOfLines={1}>{SPORT[s.sport] ?? s.title}{past ? "  Missed" : ""}</Text>
        <Text style={[st.cSub, { color: "rgba(255,255,255,0.82)" }]} numberOfLines={1}>{[s.start, fmtDur(s.min), zone].filter(Boolean).join(", ")}</Text>
      </View>
    </View>
  );
}

function EventChip({ e, c }: { e: OtherEvent; c: Palette }) {
  return (
    <View style={[st.event, { backgroundColor: c.surface2, borderLeftColor: e.color ?? c.muted }]}>
      <Text style={[st.eTitle, { color: c.ink2 }]} numberOfLines={1}>{e.title || "Busy"}</Text>
      <Text style={[st.eTime, { color: c.muted }]}>{e.allDay ? "All Day" : e.end ? `${e.start} to ${e.end}` : e.start}</Text>
    </View>
  );
}

function DayRow({ date, items, t, zones, c, onLayout }: { date: string; items: Item[]; t: string; zones: Record<string, Record<string, string>> | null; c: Palette; onLayout?: (e: LayoutChangeEvent) => void }) {
  const d = fromYmd(date), isToday = date === t;
  return (
    <View style={[st.day, { borderColor: c.line }]} onLayout={onLayout}>
      <View style={st.dateCol}>
        <Text style={[st.dow, { color: isToday ? c.accent : c.muted }]}>{DAYS[(d.getDay() + 6) % 7]}</Text>
        <View style={[st.num, isToday && { backgroundColor: c.accent }]}>
          <Text style={[st.numText, { color: isToday ? "#fff" : date < t ? c.muted : c.ink }]}>{d.getDate()}</Text>
        </View>
      </View>
      <View style={st.items}>
        {items.length === 0 && <Text style={[st.rest, { color: c.muted }]}>Rest</Text>}
        {items.map((it) => it.kind === "session"
          ? <SessionChip key={it.s.id} s={it.s} past={date < t} zones={zones} c={c} />
          : <EventChip key={it.e.id} e={it.e} c={c} />)}
      </View>
    </View>
  );
}

export default function Plan() {
  const { c } = useTheme();
  const { data } = useAthlete();
  const t = ymd(todayDate());
  const events = useCalendarEvents(ymd(addDays(todayDate(), -7)), ymd(addDays(todayDate(), 34)));
  const scroller = useRef<ScrollViewInstance>(null);
  const todayY = useRef<number | null>(null);
  const jumped = useRef(false);
  const monthAt = useRef<{ y: number; label: string }[]>([]);
  const [month, setMonth] = useState(`${MONTH[todayDate().getMonth()]}`);

  const weeks: Week[] = data?.weeks ?? [];
  const byDay = useMemo(() => {
    const m = new Map<string, OtherEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const jump = () => { if (todayY.current != null) scroller.current?.scrollTo({ y: Math.max(0, todayY.current - 56), animated: true }); };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + 10;
    const cur = [...monthAt.current].sort((a, b) => a.y - b.y).filter((m) => m.y <= y).pop();
    if (cur && cur.label !== month) setMonth(cur.label);
  };

  const rows: React.ReactNode[] = [];
  let lastMonth = -1;
  for (const w of weeks) {
    const start = fromYmd(w.start), end = addDays(start, 6);
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      if (day.getMonth() !== lastMonth) {
        lastMonth = day.getMonth();
        const label = `${MONTH[day.getMonth()]}${day.getFullYear() !== todayDate().getFullYear() ? ` ${day.getFullYear()}` : ""}`;
        rows.push(<Text key={`m${ymd(day)}`} style={[st.month, { color: c.ink }]} onLayout={(e) => { monthAt.current = [...monthAt.current.filter((m) => m.label !== label), { y: e.nativeEvent.layout.y, label }]; }}>{label}</Text>);
      }
      if (i === 0) {
        const hours = w.plannedMin / 60;
        rows.push(
          <View key={`w${w.week}`} style={st.weekHead}>
            <Text style={[st.weekText, { color: c.muted }]}>Week {w.week}, {start.getDate()} {MON[start.getMonth()]} to {end.getDate()} {MON[end.getMonth()]}</Text>
            <Text style={[st.weekText, { color: c.muted }]}>{w.phaseShort}, {hours.toFixed(1)} h</Text>
          </View>,
        );
      }
      const date = ymd(day);
      const items: Item[] = [
        ...w.sessions.filter((s) => s.date === date && s.sport !== "rest").map((s) => ({ kind: "session" as const, at: s.start ?? "12:00", s })),
        ...(byDay.get(date) ?? []).map((e) => ({ kind: "event" as const, at: e.allDay ? "00:00" : e.start ?? "00:00", e })),
      ].sort((a, b) => a.at.localeCompare(b.at));
      rows.push(
        <DayRow key={date} date={date} items={items} t={t} zones={data?.raw.profile?.zones ?? null} c={c} onLayout={date === t ? (e) => {
          todayY.current = e.nativeEvent.layout.y;
          if (!jumped.current) { jumped.current = true; setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, (todayY.current ?? 0) - 56), animated: false }), 0); }
        } : undefined} />,
      );
    }
  }

  const todayBtn = (
    <Pressable onPress={jump} style={[st.todayBtn, { borderColor: c.line }]} accessibilityRole="button">
      <Text style={[st.todayText, { color: c.ink }]}>Today</Text>
    </Pressable>
  );

  return (
    <Screen title={month} scroll={false} right={todayBtn}>
      {weeks.length === 0
        ? <Text style={{ color: c.muted }}>No Plan Yet</Text>
        : <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>{rows}</ScrollView>}
    </Screen>
  );
}

const st = StyleSheet.create({
  month: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4, marginTop: space.xl, marginBottom: space.s },
  weekHead: { flexDirection: "row", justifyContent: "space-between", paddingTop: space.m, paddingBottom: 4 },
  weekText: { fontSize: 12, fontWeight: "500" },
  day: { flexDirection: "row", gap: space.m, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  dateCol: { width: 40, alignItems: "center" },
  dow: { fontSize: 11, fontWeight: "600" },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 1 },
  numText: { fontSize: 18, fontWeight: "600" },
  items: { flex: 1, gap: 5, paddingTop: 2 },
  rest: { fontSize: 13, paddingTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: radius.s },
  doneChip: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4 },
  event: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 6, borderLeftWidth: 3 },
  cTitle: { fontSize: 14, fontWeight: "700" },
  eTitle: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  eTime: { fontSize: 11.5 },
  cSub: { fontSize: 12, marginTop: 1 },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  todayBtn: { paddingHorizontal: 12, height: 32, borderRadius: 16, borderWidth: 1, justifyContent: "center" },
  todayText: { fontSize: 13, fontWeight: "600" },
});
