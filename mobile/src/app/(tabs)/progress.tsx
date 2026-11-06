// Progress: two tabs under the title. Analysis (score, last four weeks, volume, body, performance) and Activities
// (the archive). The plus in the top left adds an activity by hand.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AddActivityBody } from "@/components/AddActivity";
import { Icon } from "@/components/Icon";
import { Activities } from "@/components/progress/Activities";
import { Analysis } from "@/components/progress/Analysis";
import { Screen } from "@/components/Screen";
import { Sheet } from "@/components/Sheet";
import { TopTabs } from "@/components/TopTabs";
import { useTheme } from "@/lib/theme";

export default function Progress() {
  const { c, dark } = useTheme();
  const [tab, setTab] = useState<"analysis" | "activities">("analysis");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const plus = (
    <Pressable onPress={() => setAdding(true)} style={({ pressed }) => [st.plus, { backgroundColor: c.surface2 }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Add activity" hitSlop={6}>
      <Icon name="plus" size={18} color={c.ink} stroke={2.2} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      <Screen title="Progress" scroll={false} bleed left={plus}>
        <TopTabs tabs={[{ k: "analysis", label: "Analysis" }, { k: "activities", label: "Activities" }]} value={tab} onChange={setTab} />
        <View style={{ flex: 1 }}>{tab === "analysis" ? <Analysis /> : <Activities />}</View>
      </Screen>
      {toast && <View style={[st.toast, { backgroundColor: dark ? "#F3F4F6" : "#101114" }]}><Text style={[st.toastText, { color: dark ? "#101114" : "#fff" }]}>{toast}</Text></View>}
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <AddActivityBody onClose={() => setAdding(false)} onDone={(msg) => { setAdding(false); setTab("activities"); setToast(msg); setTimeout(() => setToast(null), 3000); }} />
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  plus: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 104, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  toastText: { fontSize: 14, fontWeight: "500" },
});
