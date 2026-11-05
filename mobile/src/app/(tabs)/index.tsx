// Today. Real data, plain layout: the session card is styled once PR's designs arrive
// (planned: dark card with the watch; done: white card with distance, pace, heart rate and the score).
import { StyleSheet, Text, View } from "react-native";
import { fmtDur, today, ymd } from "@shared/format";
import { Placeholder, Screen } from "@/components/Screen";
import { useAthlete } from "@/lib/athlete";
import { radius, space, type, useTheme } from "@/lib/theme";

export default function Today() {
  const { c } = useTheme();
  const { data, loading } = useAthlete();
  const d = ymd(today());
  const sessions = (data?.weeks ?? []).flatMap((w) => w.sessions).filter((x) => x.date === d);
  const race = data?.raw.race;
  const days = race ? Math.ceil((new Date(race.date + "T00:00:00").getTime() - today().getTime()) / 864e5) : null;

  return (
    <Screen title="Today">
      {loading && !data && <Text style={{ color: c.muted }}>Loading</Text>}
      {data && sessions.length === 0 && <Text style={[type.body, { color: c.muted }]}>Nothing planned today</Text>}
      {sessions.map((x) => (
        <View key={x.id} style={[s.card, { backgroundColor: x.status === "done" ? c.surface : c.hero, borderColor: c.line }]}>
          <Text style={[type.tiny, { color: x.status === "done" ? c.muted : "#9AA1AD" }]}>{[x.start, fmtDur(x.min), x.intensity].filter(Boolean).join(" · ")}</Text>
          <Text style={[type.title, { color: x.status === "done" ? c.ink : "#fff" }]}>{x.title}</Text>
          <Text style={[type.small, { color: x.status === "done" ? c.ink2 : "#D6D9DF" }]}>{x.detail}</Text>
          {x.actual && <Text style={[type.small, { color: c.ok }]}>Done: {fmtDur(x.actual.min)}{x.actual.hr ? `, ${x.actual.hr} bpm` : ""}</Text>}
        </View>
      ))}
      {race && days != null && <Text style={[type.small, { color: c.muted }]}>{race.name}: {days} days</Text>}
      <Placeholder label="Fuel for this session" h={72} />
      <Placeholder label="Tomorrow and this week" h={96} />
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: space.l, gap: space.xs, minHeight: 168, justifyContent: "flex-end" },
});
