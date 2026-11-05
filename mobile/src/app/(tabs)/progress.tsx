// Progress: two tabs at the top. Analysis (training volume, then the run, bike and swim scores, then the rest)
// and Activities (the archive of every session done).
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { fmtDur, shortDate } from "@shared/format";
import { Placeholder, Screen } from "@/components/Screen";
import { useAthlete } from "@/lib/athlete";
import { radius, space, type, useTheme } from "@/lib/theme";

export default function Progress() {
  const { c } = useTheme();
  const { data } = useAthlete();
  const [tab, setTab] = useState<"analysis" | "activities">("analysis");
  const acts = [...(data?.activities ?? [])].reverse();
  return (
    <Screen title="Progress" scroll={tab === "analysis"}>
      <View style={[s.seg, { backgroundColor: c.surface2 }]}>
        {(["analysis", "activities"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.segBtn, tab === t && { backgroundColor: c.surface }]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
            <Text style={[type.small, { color: tab === t ? c.ink : c.muted, fontWeight: "600" }]}>{t === "analysis" ? "Analysis" : "Activities"}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "analysis" ? (
        <>
          <Placeholder label="Training Volume" h={140} />
          <View style={{ flexDirection: "row", gap: space.s }}>
            <View style={{ flex: 1 }}><Placeholder label="Run Score" h={110} /></View>
            <View style={{ flex: 1 }}><Placeholder label="Bike Score" h={110} /></View>
            <View style={{ flex: 1 }}><Placeholder label="Swim Score" h={110} /></View>
          </View>
          <Placeholder label="More Analysis" h={180} />
        </>
      ) : (
        <FlatList
          data={acts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={<Text style={{ color: c.muted }}>No Activities Yet</Text>}
          renderItem={({ item: a }) => (
            <View style={[s.row, { borderColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: c.ink }]} numberOfLines={1}>{a.name}</Text>
                <Text style={[type.small, { color: c.muted }]}>{shortDate(a.date)}{a.start ? `, ${a.start}` : ""}</Text>
              </View>
              <Text style={[type.small, { color: c.ink2 }]}>{fmtDur(a.min)}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: "row", borderRadius: radius.m, padding: 3 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.s },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: space.m, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.m },
});
