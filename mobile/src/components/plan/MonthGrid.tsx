// The Month view: one month per page, swiped sideways. Each day shows its sessions as small bars (black when done,
// light blue when planned) and how many other events it has. Tapping a day opens it in the Day view.
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from "react-native";
import type { Session } from "@shared/data";
import { DAYS, fromYmd, ymd } from "@shared/format";
import { SportIcon } from "../SportIcon";
import { blockInk } from "./TimeGrid";
import type { OtherEvent } from "@/lib/calendar";
import { useTheme } from "@/lib/theme";

export function MonthGrid({ months, startIndex, sessions, events, today, onPickDay, onVisible }: {
  months: Date[]; startIndex: number; sessions: Session[]; events: OtherEvent[]; today: string; onPickDay: (date: string) => void; onVisible: (i: number) => void;
}) {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 700);
  const ref = useRef<ScrollViewInstance>(null);
  const ink = blockInk(dark);
  return (
    <ScrollView
      ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: startIndex * W, y: 0 }}
      onLayout={() => setTimeout(() => ref.current?.scrollTo({ x: startIndex * W, animated: false }), 0)}
      onMomentumScrollEnd={(e) => onVisible(Math.round(e.nativeEvent.contentOffset.x / W))}
    >
      {months.map((m) => {
        const first = new Date(m.getFullYear(), m.getMonth(), 1);
        const pad = (first.getDay() + 6) % 7;
        const n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const cells = Array.from({ length: Math.ceil((pad + n) / 7) * 7 }, (_, i) => (i < pad || i >= pad + n ? null : ymd(new Date(m.getFullYear(), m.getMonth(), i - pad + 1))));
        return (
          <View key={m.toISOString()} style={{ width: W }}>
            <View style={[st.dows, { borderColor: c.line }]}>{DAYS.map((d) => <Text key={d} style={[st.dow, { color: c.muted }]}>{d.slice(0, 1)}</Text>)}</View>
            <View style={st.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={i} style={[st.cell, { borderColor: c.line }]} />;
                const ss = sessions.filter((s) => s.date === d && s.sport !== "rest");
                const ev = events.filter((e) => e.date === d).length;
                const isT = d === today;
                return (
                  <Pressable key={d} onPress={() => onPickDay(d)} style={({ pressed }) => [st.cell, { borderColor: c.line }, pressed && { backgroundColor: c.surface2 }]}>
                    <View style={[st.num, isT && { backgroundColor: c.accent }]}><Text style={[st.numText, { color: isT ? "#fff" : d < today ? c.muted : c.ink }]}>{fromYmd(d).getDate()}</Text></View>
                    {ss.slice(0, 3).map((s) => {
                      const k = s.actual ? ink.done : ink.plan;
                      return (
                        <View key={s.id} style={[st.bar, { backgroundColor: k.bg, borderLeftColor: k.line, opacity: !s.actual && d < today ? 0.45 : 1 }]}>
                          <SportIcon sport={s.sport} size={9} color={k.icon} />
                          <Text style={[st.barText, { color: k.ink }]} numberOfLines={1}>{s.actual?.min ?? s.min}m</Text>
                        </View>
                      );
                    })}
                    {ev > 0 && <Text style={[st.more, { color: c.muted }]}>{ev} {ev === 1 ? "event" : "events"}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  dows: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  dow: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, minHeight: 96, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 2, paddingTop: 3, gap: 2 },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 1 },
  numText: { fontSize: 12, fontWeight: "600" },
  bar: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 3, borderLeftWidth: 2, paddingHorizontal: 2, paddingVertical: 1 },
  barText: { fontSize: 9, fontWeight: "600", flexShrink: 1 },
  more: { fontSize: 9, textAlign: "center" },
});
