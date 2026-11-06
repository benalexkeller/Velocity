// Plan: two tabs under the app bar. Schedule (the calendar, around the athlete's life) and Training Plan (the season).
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Schedule } from "@/components/plan/Schedule";
import { TrainingPlan } from "@/components/plan/TrainingPlan";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/lib/theme";

export default function Plan() {
  const { c } = useTheme();
  const [tab, setTab] = useState<"schedule" | "plan">("schedule");
  return (
    <Screen title="Plan" brand scroll={false} bleed>
      <View style={[st.tabs, { borderColor: c.line }]}>
        {(["schedule", "plan"] as const).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[st.tabText, { color: tab === k ? c.ink : c.muted, fontWeight: tab === k ? "700" : "500" }]}>{k === "schedule" ? "Schedule" : "Training Plan"}</Text>
            <View style={[st.under, { backgroundColor: tab === k ? c.accent : "transparent" }]} />
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>{tab === "schedule" ? <Schedule /> : <TrainingPlan />}</View>
    </Screen>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingTop: 4 },
  tabText: { fontSize: 15, paddingBottom: 9 },
  under: { height: 2.5, width: "70%", borderRadius: 2 },
});
