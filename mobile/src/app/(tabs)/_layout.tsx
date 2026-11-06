// The bottom tab bar: Today, Plan, Coach, Progress, Fuel. The coach is a raised circle in the middle,
// so it is clearly the one to talk to (voice or text).
// expo-router types the trigger ref as a View component, React Native as an element; the cast bridges the two.
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/Icon";
import { useTheme } from "@/lib/theme";

function TabButton({ isFocused, icon, label, ref, ...props }: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const { c } = useTheme();
  const color = isFocused ? c.accent : c.muted;
  return (
    <Pressable {...props} ref={ref as never} style={[s.tab, isFocused && { backgroundColor: c.surface2 }]} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: isFocused }}>
      <Icon name={icon} size={22} color={color} stroke={isFocused ? 1.9 : 1.7} />
      <Text style={[s.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CoachButton({ isFocused, ref, ...props }: TabTriggerSlotProps) {
  const { c } = useTheme();
  return (
    <View style={s.mid}>
      <Pressable {...props} ref={ref as never} style={({ pressed }) => [s.coach, { backgroundColor: c.accent, borderColor: c.tabBar, opacity: pressed ? 0.85 : 1 }, isFocused && s.coachOn]} accessibilityRole="tab" accessibilityLabel="Coach" accessibilityState={{ selected: isFocused }}>
        <Icon name="coach" size={26} color="#fff" stroke={2} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        {/* one flat style object: on the web the tab list merges styles by spreading, which breaks style arrays */}
        <View style={StyleSheet.flatten([s.bar, { backgroundColor: c.tabBar, borderColor: c.line, marginBottom: Math.max(bottom - 8, 10) }])}>
          <TabTrigger name="index" href="/" asChild><TabButton icon="today" label="Today" /></TabTrigger>
          <TabTrigger name="plan" href="/plan" asChild><TabButton icon="plan" label="Plan" /></TabTrigger>
          <TabTrigger name="coach" href="/coach" asChild><CoachButton /></TabTrigger>
          <TabTrigger name="progress" href="/progress" asChild><TabButton icon="progress" label="Progress" /></TabTrigger>
          <TabTrigger name="fuel" href="/fuel" asChild><TabButton icon="fuel" label="Fuel" /></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const s = StyleSheet.create({
  // a floating capsule, inset from the edges, with the selected tab in a soft pill
  bar: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginTop: 6, height: 66, borderRadius: 33, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  tab: { flex: 1, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", gap: 3 },
  mid: { flex: 1, alignItems: "center", justifyContent: "center", height: 54 },
  label: { fontSize: 11, fontWeight: "600" },
  coach: { width: 58, height: 58, borderRadius: 29, borderWidth: 4, alignItems: "center", justifyContent: "center", marginTop: -30, shadowColor: "#2459FE", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  coachOn: { transform: [{ scale: 1.04 }] },
});
