// View Workout: the planned session step by step (warm-up, main set, cool-down), each with its zone and target.
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fmtDur } from "@shared/format";
import { workoutFor } from "@shared/workout";
import { Icon } from "@/components/Icon";
import { longDate } from "@/components/plan/SessionSheet";
import { SportIcon } from "@/components/SportIcon";
import { zoneOfSession } from "@/components/today";
import { useAthlete } from "@/lib/athlete";
import { useTheme } from "@/lib/theme";

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { data } = useAthlete();
  const s = data?.weeks.flatMap((w) => w.sessions).find((x) => x.id === id);
  const zones = data?.raw.profile?.zones ?? null;
  const wk = s && zones ? workoutFor(s, zones) : s ? workoutFor(s) : null;
  return (
    <SafeAreaView style={[st.page, { backgroundColor: c.bg }]}>
      <View style={st.top}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={st.backBtn}><Icon name="back" size={20} color={c.accent} stroke={2.2} /><Text style={[st.backText, { color: c.accent }]}>Plan</Text></Pressable>
      </View>
      {s && wk && (
        <ScrollView contentContainerStyle={st.body}>
          <Text style={[st.date, { color: c.muted }]}>{longDate(s.date)}{s.start ? `, ${s.start}` : ""}</Text>
          <View style={st.head}>
            <View style={[st.icon, { backgroundColor: c.accentSoft }]}><SportIcon sport={s.sport} size={20} color={c.accent} /></View>
            <Text style={[st.title, { color: c.ink }]}>{s.title}</Text>
          </View>
          <View style={st.facts}>
            <View><Text style={[st.k, { color: c.muted }]}>Duration</Text><Text style={[st.v, { color: c.ink }]}>{fmtDur(s.min)}</Text></View>
            <View><Text style={[st.k, { color: c.muted }]}>Intensity</Text><Text style={[st.v, { color: c.ink }]}>Zone {zoneOfSession(s, zones)}</Text></View>
          </View>
          <Text style={[st.h2, { color: c.ink }]}>Steps</Text>
          <View style={[st.list, { borderColor: c.line }]}>
            {wk.segments.map((g, i) => (
              <View key={i} style={[st.step, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}>
                <View style={[st.zone, { backgroundColor: g.zone >= 4 ? c.ink : g.zone === 3 ? c.accent : c.accentSoft }]}>
                  <Text style={[st.zoneText, { color: g.zone >= 3 ? "#fff" : c.accent }]}>Z{g.zone}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.stepName, { color: c.ink }]}>{g.label}</Text>
                  {!!g.target && <Text style={[st.stepSub, { color: c.muted }]}>{g.target}</Text>}
                </View>
                <Text style={[st.stepMin, { color: c.ink2 }]}>{fmtDur(g.min)}</Text>
              </View>
            ))}
          </View>
          {!!wk.note && <Text style={[st.note, { color: c.muted }]}>{wk.note}</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  page: { flex: 1 },
  top: { paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { fontSize: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  date: { fontSize: 13 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -6 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  facts: { flexDirection: "row", gap: 28 },
  k: { fontSize: 11 },
  v: { fontSize: 17, fontWeight: "600", marginTop: 2 },
  h2: { fontSize: 17, fontWeight: "700", marginTop: 6 },
  list: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  step: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  zone: { width: 34, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  zoneText: { fontSize: 12, fontWeight: "700" },
  stepName: { fontSize: 15, fontWeight: "600" },
  stepSub: { fontSize: 12, marginTop: 1 },
  stepMin: { fontSize: 14, fontWeight: "600" },
  note: { fontSize: 13, lineHeight: 18 },
});
