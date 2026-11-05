// Plan. To become a Google Calendar style week on the phone: drag future sessions to move them,
// synced with the athlete's calendar. For now: this week's sessions as a plain list.
import { StyleSheet, Text, View } from "react-native";
import { DAYS, fmtDur, today, ymd } from "@shared/format";
import { Placeholder, Screen } from "@/components/Screen";
import { useAthlete } from "@/lib/athlete";
import { space, type, useTheme } from "@/lib/theme";

export default function Plan() {
  const { c } = useTheme();
  const { data } = useAthlete();
  const d = ymd(today());
  const week = data?.weeks.find((w) => w.sessions.some((x) => x.date === d)) ?? data?.weeks.find((w) => w.start > d);
  return (
    <Screen title="Plan">
      <Placeholder label="Week Calendar (Google Calendar Style)" h={64} />
      {week && <Text style={[type.small, { color: c.muted }]}>Week {week.week}, {week.phase}</Text>}
      {week?.sessions.filter((x) => x.sport !== "rest").map((x) => (
        <View key={x.id} style={[s.row, { borderColor: c.line }]}>
          <Text style={[type.small, s.day, { color: x.date === d ? c.accent : c.muted }]}>{DAYS[x.dayIndex]}</Text>
          <Text style={[type.body, { color: c.ink, flex: 1 }]}>{x.title}</Text>
          <Text style={[type.small, { color: x.status === "done" ? c.ok : c.muted }]}>{fmtDur(x.min)}</Text>
        </View>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth },
  day: { width: 34 },
});
