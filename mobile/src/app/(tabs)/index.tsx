// Today (PR's layout, 5 Nov 2026): a small week strip, the session card (dark before, white once done),
// the last result, body this morning, training volume, then sessions / load / race with the phase bar.
import { useMemo, useState } from "react";
import { Text, useWindowDimensions } from "react-native";
import { createAnalysis } from "@shared/analysis";
import { weekStatus } from "@shared/data";
import { dateFull, today as todayDate, ymd } from "@shared/format";
import { Screen } from "@/components/Screen";
import { AddManually, BodyToday, LastResult, SessionCard, WeekAndRace, WeekStrip, WeeklyVolume, mainOf } from "@/components/today";
import { useAthlete } from "@/lib/athlete";
import { type, useTheme } from "@/lib/theme";

export default function Today() {
  const { c } = useTheme();
  const { data, loading } = useAthlete();
  const t = ymd(todayDate());
  const [picked, setPicked] = useState(t);
  const { width } = useWindowDimensions();

  const an = useMemo(() => (data ? createAnalysis(data.activities, data.weeks, { phases: data.phases }) : null), [data]);
  if (!data) return <Screen title="Today" brand>{loading ? <Text style={{ color: c.muted }}>Loading</Text> : null}</Screen>;

  const week = data.weeks.find((w) => w.sessions.some((x) => x.date === t)) ?? data.weeks.find((w) => w.start > t) ?? data.weeks[data.weeks.length - 1];
  const s = mainOf((week?.sessions ?? []).filter((x) => x.date === picked));
  const scoreOf = (id: string | undefined, sport: string | undefined) => {
    if (!an || !id || (sport !== "run" && sport !== "bike" && sport !== "swim")) return null;
    const r = an.sessionScore(sport);
    return r && r.activity.id === id ? r.score : null;
  };

  // the wearable shown on the card: a connected one, else the maker of the latest synced activity
  const conn = (data.raw.devices ?? []).find((d) => d.status === "connected");
  const lastSynced = [...data.activities].reverse().find((a) => a.source !== "manual");
  const device = conn ? { key: conn.provider, status: "connected" as const } : lastSynced ? { key: lastSynced.source, status: "imported" as const } : { key: "garmin", status: "none" as const };

  const heroId = s?.actual?.id;
  const last = [...data.activities].reverse().find((a) => a.date <= t && a.id !== heroId);
  const ws = week ? weekStatus(week, data.activities) : null;
  const race = data.raw.race ? { name: data.raw.race.name, days: Math.max(0, Math.ceil((new Date(data.raw.race.date + "T00:00:00").getTime() - todayDate().getTime()) / 864e5)) } : null;

  return (
    <Screen title="Today" brand>
      {week && <WeekStrip week={week} selected={picked} today={t} onPick={setPicked} c={c} />}
      <SessionCard
        s={s} label={picked === t ? null : dateFull(picked)} zones={data.raw.profile?.zones ?? null}
        device={device} weightKg={data.raw.weightKg ?? 70} score={scoreOf(s?.actual?.id, s?.actual?.sport)} c={c}
      />
      <AddManually c={c} />
      {last && <LastResult a={last} score={scoreOf(last.id, last.sport)} lthr={null} c={c} />}
      <BodyToday body={data.raw.body ?? []} today={t} width={Math.min(width, 520) - 32} c={c} />
      {week && <WeeklyVolume week={week} activities={data.activities} width={Math.min(width, 520) - 64} c={c} />}
      {ws && <WeekAndRace sessions={{ done: ws.done, total: ws.total }} load={ws.load} race={race} phases={data.phases} weekNo={week?.week ?? null} c={c} />}
      {!week && <Text style={[type.body, { color: c.muted }]}>No plan yet</Text>}
    </Screen>
  );
}
