// The two tabs under the app bar on Plan and Progress: text with a blue underline under the chosen one.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

export function TopTabs<K extends string>({ tabs, value, onChange }: { tabs: { k: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <View style={[st.tabs, { borderColor: c.line }]}>
      {tabs.map(({ k, label }) => (
        <Pressable key={k} onPress={() => onChange(k)} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: value === k }}>
          <Text style={[st.text, { color: value === k ? c.ink : c.muted, fontWeight: value === k ? "700" : "500" }]}>{label}</Text>
          <View style={[st.under, { backgroundColor: value === k ? c.accent : "transparent" }]} />
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  tab: { flex: 1, alignItems: "center", paddingTop: 4 },
  text: { fontSize: 15, paddingBottom: 9 },
  under: { height: 2.5, width: "70%", borderRadius: 2 },
});
