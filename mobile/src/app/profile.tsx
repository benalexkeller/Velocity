// Profile, connections and settings (opened from the photo in the top corner). Sign-out for now.
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Placeholder } from "@/components/Screen";
import { useAthlete } from "@/lib/athlete";
import { useAuth } from "@/lib/auth";
import { radius, space, type, useTheme } from "@/lib/theme";

export default function Profile() {
  const { c } = useTheme();
  const { session, signOut } = useAuth();
  const { data } = useAthlete();
  return (
    <SafeAreaView style={[s.page, { backgroundColor: c.bg }]}>
      <View style={s.head}>
        <Text style={[type.title, { color: c.ink }]}>Profile</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={[type.body, { color: c.accent }]}>Done</Text></Pressable>
      </View>
      <View style={s.body}>
        <Text style={[type.h2, { color: c.ink }]}>{data?.raw.profile?.name ?? ""}</Text>
        <Text style={[type.small, { color: c.muted }]}>{session?.user.email}</Text>
        <Placeholder label="Connections and settings" h={160} />
        <Pressable onPress={signOut} style={[s.out, { borderColor: c.line }]}><Text style={[type.body, { color: c.danger }]}>Sign out</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: space.l },
  body: { paddingHorizontal: space.l, gap: space.m },
  out: { height: 48, borderRadius: radius.m, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: space.l },
});
