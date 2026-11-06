// Progress, Activities: every session done, newest first, grouped by month. Filter by sport; tap one to open it.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import type { Activity } from "@shared/data";
import { DAYS, fmtHMS, fmtPace, fromYmd } from "@shared/format";
import { fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@shared/units";
import { AddActivityBody } from "../AddActivity";
import { Icon } from "../Icon";
import { RouteThumb } from "../RouteThumb";
import { Sheet } from "../Sheet";
import { SportIcon } from "../SportIcon";
import { RangePills } from "./charts";
import { useAthlete } from "@/lib/athlete";
import { useTheme } from "@/lib/theme";

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SPORT: Record<string, string> = { swim: "Swim", bike: "Bike", run: "Run", strength: "Strength", hike: "Hike", brick: "Brick" };
type F = "all" | "swim" | "bike" | "run" | "other";

const factsOf = (a: Activity) => [
  a.mi != null ? fmtDist(a.mi) : a.yd != null ? `${swimDist(a.yd).v.toLocaleString()} ${swimDist(a.yd).u}` : null,
  fmtHMS(a.min),
  a.pace_s ? `${fmtPace(runPace(a.pace_s).s)} ${runPace(a.pace_s).u}` : a.mph ? fmtSpeed(a.mph) : a.p100_s ? `${fmtPace(swimPace(a.p100_s).s)} ${swimPace(a.p100_s).u}` : null,
  a.hr ? `${a.hr} bpm` : null,
].filter(Boolean).slice(0, 3) as string[]; // three facts fit beside the map; the rest is one tap away

export function Activities() {
  const { c, dark } = useTheme();
  const { data } = useAthlete();
  const [f, setF] = useState<F>("all");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sections = useMemo(() => {
    const acts = [...(data?.activities ?? [])].reverse().filter((a) => f === "all" || (f === "other" ? !["swim", "bike", "run"].includes(a.sport) : a.sport === f));
    const out: { title: string; total: number; data: Activity[] }[] = [];
    for (const a of acts) {
      const d = fromYmd(a.date), title = `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
      const last = out[out.length - 1];
      if (last?.title === title) { last.data.push(a); last.total += a.min; } else out.push({ title, total: a.min, data: [a] });
    }
    return out;
  }, [data, f]);

  return (
    <View style={{ flex: 1 }}>
      <View style={st.filter}>
        <Pressable onPress={() => setAdding(true)} style={({ pressed }) => [st.plus, { backgroundColor: c.surface2 }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel="Add activity">
          <Icon name="plus" size={16} color={c.ink} stroke={2.2} />
        </Pressable>
        <RangePills options={[{ k: "all", label: "All" }, { k: "swim", label: "Swim" }, { k: "bike", label: "Bike" }, { k: "run", label: "Run" }, { k: "other", label: "Other" }]} value={f} onChange={setF} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(a) => a.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={<Text style={[st.empty, { color: c.muted }]}>No Activities Yet</Text>}
        renderSectionHeader={({ section }) => (
          <View style={[st.head, { backgroundColor: c.bg }]}>
            <Text style={[st.headText, { color: c.ink }]}>{section.title}</Text>
            <Text style={[st.headSub, { color: c.muted }]}>{section.data.length} sessions, {Math.round(section.total / 60)} h</Text>
          </View>
        )}
        renderItem={({ item: a }) => {
          const d = fromYmd(a.date);
          return (
            <Pressable onPress={() => router.push(`/activity/${encodeURIComponent(a.id)}`)} style={({ pressed }) => [st.row, { borderColor: c.line }, pressed && { backgroundColor: c.surface2 }]}>
              <View style={[st.chip, { backgroundColor: dark ? "#F3F4F6" : "#2C2D31" }]}><SportIcon sport={a.sport} size={16} color={dark ? "#101114" : "#fff"} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={st.top}>
                  <Text style={[st.name, { color: c.ink }]} numberOfLines={1}>{SPORT[a.sport] ?? a.name}</Text>
                  <Text style={[st.when, { color: c.muted }]}>{DAYS[(d.getDay() + 6) % 7]} {d.getDate()}{a.start ? `, ${a.start}` : ""}</Text>
                </View>
                {a.name && a.name !== SPORT[a.sport] && <Text style={[st.sub, { color: c.muted }]} numberOfLines={1}>{a.name}</Text>}
                <View style={st.facts}>
                  {factsOf(a).map((x, i) => (
                    <View key={i} style={st.fact}>
                      {i > 0 && <View style={[st.sep, { backgroundColor: c.line }]} />}
                      <Text style={[st.factText, { color: c.ink2 }]}>{x}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <RouteThumb route={a.route} sport={a.sport} size={58} />
            </Pressable>
          );
        }}
      />
      {toast && <View style={[st.toast, { backgroundColor: dark ? "#F3F4F6" : "#101114" }]}><Text style={[st.toastText, { color: dark ? "#101114" : "#fff" }]}>{toast}</Text></View>}
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <AddActivityBody onClose={() => setAdding(false)} onDone={(msg) => { setAdding(false); setToast(msg); setTimeout(() => setToast(null), 3000); }} />
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  filter: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  plus: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 104, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  toastText: { fontSize: 14, fontWeight: "500" },
  empty: { padding: 24, textAlign: "center" },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headText: { fontSize: 17, fontWeight: "700" },
  headSub: { fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: 2 },
  top: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  when: { fontSize: 12 },
  sub: { fontSize: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: 4 },
  fact: { flexDirection: "row", alignItems: "center" },
  sep: { width: 1, height: 12, marginHorizontal: 8 },
  factText: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
