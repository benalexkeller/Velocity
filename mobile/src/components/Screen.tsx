// Every tab's frame: the title on the left, the athlete's photo (profile, connections, settings) on the right.
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./Icon";
import { useAthlete } from "@/lib/athlete";
import { space, type, useTheme } from "@/lib/theme";

export function Screen({ title, children, scroll = true, brand = false, right }: { title: string; children: ReactNode; scroll?: boolean; brand?: boolean; right?: ReactNode }) {
  const { c } = useTheme();
  const { offline, data } = useAthlete();
  const initials = (data?.raw.profile?.name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const body = <View style={[s.body, !scroll && { flex: 1 }]}>{children}</View>;
  return (
    <SafeAreaView edges={["top"]} style={[s.page, { backgroundColor: c.bg }]}>
      <View style={s.head}>
        {brand ? <Text style={[s.brand, { color: c.accent }]} accessibilityLabel={title}>VELOCITY</Text> : <Text style={[type.title, { color: c.ink }]}>{title}</Text>}
        <View style={s.right}>
          {right}
          <Pressable onPress={() => router.push("/profile")} style={[s.me, { backgroundColor: c.surface2 }]} accessibilityLabel="Profile and settings" hitSlop={8}>
            {initials ? <Text style={[s.initials, { color: c.ink }]}>{initials}</Text> : <Icon name="user" size={18} color={c.ink2} />}
          </Pressable>
        </View>
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
  // pinned to the tab area: the tab slot lets a screen grow with its content, which would stop lists scrolling
  page: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.l, paddingTop: space.s, paddingBottom: space.m },
  right: { flexDirection: "row", alignItems: "center", gap: space.s },
  me: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 28, fontWeight: "900", letterSpacing: -0.6 },
  initials: { fontSize: 14, fontWeight: "700" },
  body: { paddingHorizontal: space.l, gap: space.m },
  offline: { ...type.tiny, paddingHorizontal: space.l, paddingBottom: space.s },
  ph: { borderRadius: 14, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
});
