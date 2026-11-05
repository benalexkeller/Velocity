// Every tab's frame: the title on the left, the athlete's photo (profile, connections, settings) on the right.
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { useAthlete } from "@/lib/athlete";
import { space, type, useTheme } from "@/lib/theme";

export function Screen({ title, children, scroll = true }: { title: string; children: ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const { offline } = useAthlete();
  const body = <View style={s.body}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={[s.page, { backgroundColor: c.bg }]}>
      <View style={s.head}>
        <Text style={[type.title, { color: c.ink }]}>{title}</Text>
        <Pressable onPress={() => router.push("/profile")} style={[s.me, { backgroundColor: c.surface2 }]} accessibilityLabel="Profile and settings" hitSlop={8}>
          <Icon name="user" size={18} color={c.ink2} />
        </Pressable>
      </View>
      {offline && <Text style={[s.offline, { color: c.muted }]}>Offline. Showing the last saved copy</Text>}
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

/** Grey box standing in for a screen part until PR's designs arrive. */
export function Placeholder({ label, h = 120 }: { label: string; h?: number }) {
  const { c } = useTheme();
  return (
    <View style={[s.ph, { height: h, backgroundColor: c.surface2, borderColor: c.line }]}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.m },
  me: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: space.l, gap: space.m },
  offline: { ...type.tiny, paddingHorizontal: space.l, paddingBottom: space.s },
  ph: { borderRadius: 14, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
