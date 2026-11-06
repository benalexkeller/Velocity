// Add an activity by hand: sport, day, start, duration, and distance and heart rate if known. Saved like the
// website's manual log, so it counts toward the plan and the analysis straight away.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DAYS, addDays, fmtDur, fromYmd, today as todayDate, ymd } from "@shared/format";
import { unitWords, toMi, toYd } from "@shared/units";
import { Icon } from "./Icon";
import { SportIcon } from "./SportIcon";
import { useAthlete } from "@/lib/athlete";
import { useTheme, type Palette } from "@/lib/theme";

const SPORTS = [{ k: "run", label: "Run" }, { k: "bike", label: "Bike" }, { k: "swim", label: "Swim" }, { k: "strength", label: "Strength" }, { k: "other", label: "Other" }] as const;
type Sp = (typeof SPORTS)[number]["k"];
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function Stepper({ label, value, onMinus, onPlus, c }: { label: string; value: string; onMinus: () => void; onPlus: () => void; c: Palette }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[st.k, { color: c.muted }]}>{label}</Text>
      <View style={[st.stepper, { backgroundColor: c.surface2 }]}>
        <Pressable onPress={onMinus} hitSlop={6} style={st.stepBtn} accessibilityLabel={`Less ${label}`}><Text style={[st.sign, { color: c.ink }]}>−</Text></Pressable>
        <Text style={[st.stepV, { color: c.ink }]}>{value}</Text>
        <Pressable onPress={onPlus} hitSlop={6} style={st.stepBtn} accessibilityLabel={`More ${label}`}><Text style={[st.sign, { color: c.ink }]}>+</Text></Pressable>
      </View>
    </View>
  );
}

export function AddActivityBody({ onDone, onClose }: { onDone: (text: string) => void; onClose: () => void }) {
  const { c } = useTheme();
  const { addActivity } = useAthlete();
  const t = todayDate();
  const [sport, setSport] = useState<Sp>("run");
  const [date, setDate] = useState(ymd(t));
  const now = new Date();
  const [start, setStart] = useState(Math.max(0, Math.round((now.getHours() * 60 + now.getMinutes() - 60) / 15) * 15)); // an hour ago
  const [min, setMin] = useState(45);
  const [distance, setDistance] = useState("");
  const [hr, setHr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setDistance(""); }, [sport]);
  const w = unitWords();
  const distUnit = sport === "swim" ? w.swim : w.dist;
  const days = Array.from({ length: 7 }, (_, i) => ymd(addDays(t, i - 6)));

  const save = async () => {
    setBusy(true); setErr(null);
    const d = parseFloat(distance.replace(",", "."));
    const label = SPORTS.find((s) => s.k === sport)!.label;
    const ok = await addActivity({
      date, start: hm(start), sport: sport as never, name: label, min,
      ...(d > 0 ? (sport === "swim" ? { yd: toYd(d) } : sport === "run" || sport === "bike" ? { mi: +toMi(d).toFixed(2) } : {}) : {}),
      ...(parseInt(hr, 10) > 0 ? { hr: parseInt(hr, 10) } : {}),
    });
    setBusy(false);
    if (ok) onDone(`${label} added, ${fmtDur(min)}`);
    else setErr("Could not save. Check your connection");
  };

  return (
    <View style={st.body}>
      <View style={st.titleRow}>
        <Text style={[st.title, { color: c.ink }]}>Add Activity</Text>
        <Pressable onPress={onClose} hitSlop={10} style={[st.x, { backgroundColor: c.surface2 }]} accessibilityLabel="Close"><Icon name="close" size={14} color={c.ink2} stroke={2.2} /></Pressable>
      </View>
      <View style={st.chips}>
        {SPORTS.map((s) => {
          const on = s.k === sport;
          return (
            <Pressable key={s.k} onPress={() => setSport(s.k)} style={[st.sport, { backgroundColor: on ? c.ink : c.surface2 }]} accessibilityRole="button" accessibilityLabel={s.label} accessibilityState={{ selected: on }}>
              {s.k !== "other" ? <SportIcon sport={s.k} size={16} color={on ? c.bg : c.ink2} /> : <Icon name="plus" size={16} color={on ? c.bg : c.ink2} stroke={2} />}
              <Text style={[st.sportText, { color: on ? c.bg : c.ink2 }]} numberOfLines={1}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={st.days}>
        {days.map((d) => {
          const on = d === date, x = fromYmd(d);
          return (
            <Pressable key={d} onPress={() => setDate(d)} style={[st.day, { backgroundColor: on ? c.ink : c.surface2 }]}>
              <Text style={[st.dayK, { color: on ? c.bg : c.muted }]}>{DAYS[(x.getDay() + 6) % 7].slice(0, 1)}</Text>
              <Text style={[st.dayV, { color: on ? c.bg : c.ink }]}>{x.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={st.row}>
        <Stepper label="Start" value={hm(start)} onMinus={() => setStart((x) => Math.max(0, x - 15))} onPlus={() => setStart((x) => Math.min(23 * 60 + 45, x + 15))} c={c} />
        <Stepper label="Duration" value={fmtDur(min)} onMinus={() => setMin((x) => Math.max(5, x - 5))} onPlus={() => setMin((x) => Math.min(12 * 60, x + 5))} c={c} />
      </View>
      <View style={st.row}>
        {(sport === "run" || sport === "bike" || sport === "swim") && (
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[st.k, { color: c.muted }]}>Distance ({distUnit})</Text>
            <TextInput value={distance} onChangeText={setDistance} keyboardType="decimal-pad" placeholder="Optional" placeholderTextColor={c.muted} style={[st.input, { backgroundColor: c.surface2, color: c.ink }]} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[st.k, { color: c.muted }]}>Average Heart Rate</Text>
          <TextInput value={hr} onChangeText={setHr} keyboardType="number-pad" placeholder="Optional" placeholderTextColor={c.muted} style={[st.input, { backgroundColor: c.surface2, color: c.ink }]} />
        </View>
      </View>
      {err && <Text style={[st.k, { color: c.danger }]}>{err}</Text>}
      <Pressable onPress={save} disabled={busy} style={({ pressed }) => [st.save, { backgroundColor: c.accent }, (pressed || busy) && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={st.saveText}>{busy ? "Saving" : "Save Activity"}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  x: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: 6 },
  sport: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 9, borderRadius: 12 },
  sportText: { fontSize: 12, fontWeight: "600" },
  days: { flexDirection: "row", gap: 6 },
  day: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 10 },
  dayK: { fontSize: 10, fontWeight: "600" },
  dayV: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10 },
  k: { fontSize: 12 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, height: 46, paddingHorizontal: 4 },
  stepBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  sign: { fontSize: 22 },
  stepV: { fontSize: 17, fontWeight: "700", fontVariant: ["tabular-nums"] },
  input: { height: 46, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, fontWeight: "600" },
  save: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
