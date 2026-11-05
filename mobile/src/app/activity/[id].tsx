// One activity, full screen: the core numbers at the very top, then the route map, then pace, heart rate
// and elevation over time. Map and charts are placeholders until the designs arrive.
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { dateFull } from "@shared/format";
import { Placeholder } from "@/components/Screen";
import { doneFacts } from "@/components/today";
import { useAthlete } from "@/lib/athlete";
import { space, type, useTheme } from "@/lib/theme";

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { data } = useAthlete();
  const a = data?.activities.find((x) => x.id === id);
  return (
    <SafeAreaView style={[s.page, { backgroundColor: c.bg }]}>
      <View style={s.head}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={[type.body, { color: c.accent }]}>Back</Text></Pressable>
      </View>
      {a && (
        <ScrollView contentContainerStyle={s.body}>
          <Text style={[type.small, { color: c.muted }]}>{dateFull(a.date)}{a.start ? ` · ${a.start}` : ""}</Text>
          <Text style={[type.title, { color: c.ink }]}>{a.name}</Text>
          <View style={s.facts}>
            {doneFacts(a).map((f) => (
              <View key={f.k}>
                <Text style={[type.tiny, { color: c.muted }]}>{f.k}</Text>
                <Text style={[s.v, { color: c.ink }]}>{f.v}<Text style={[type.small, { color: c.muted }]}>{f.u ? ` ${f.u}` : ""}</Text></Text>
              </View>
            ))}
          </View>
          <Placeholder label="Route map" h={220} />
          <Placeholder label="Pace over time" h={120} />
          <Placeholder label="Heart rate over time" h={120} />
          <Placeholder label="Elevation over time" h={120} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  head: { paddingHorizontal: space.l, paddingVertical: space.m },
  body: { paddingHorizontal: space.l, gap: space.m, paddingBottom: 40 },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 22, rowGap: 10, marginVertical: space.s },
  v: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
});
