// What slides up when a block is tapped: the session (or the calendar event), its fuel, and how it sits in the day.
// Three states: viewing, changing the time (day + 15-minute steps), and a clash after a drag with the coach's pick.
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@shared/data";
import { DAYS, addDays, fmtDur, fromYmd, ymd } from "@shared/format";
import { sessionFuel } from "@shared/nutrition/targets";
import { Icon } from "../Icon";
import { SportIcon } from "../SportIcon";
import { doneFacts, zoneOfSession } from "../today";
import { busyOn, clashOf, fmtGap, isKey, suggestTime, toHm, toMin } from "./blocks";
import type { OtherEvent } from "@/lib/calendar";
import { useTheme, type Palette } from "@/lib/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const longDate = (d: string) => { const x = fromYmd(d); return `${DAY_NAME[(x.getDay() + 6) % 7]} ${x.getDate()} ${MONTHS[x.getMonth()]}`; };

export type SheetState =
  | { kind: "session"; s: Session; clash?: { date: string; start: number } }
  | { kind: "event"; e: OtherEvent };

function Btn({ label, primary, onPress, c }: { label: string; primary?: boolean; onPress: () => void; c: Palette }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btn, { backgroundColor: primary ? c.accent : c.surface2 }, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Text style={[st.btnText, { color: primary ? "#fff" : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Fact({ k, v, c }: { k: string; v: string; c: Palette }) {
  return <View style={{ flex: 1 }}><Text style={[st.k, { color: c.muted }]}>{k}</Text><Text style={[st.v, { color: c.ink }]} numberOfLines={1}>{v}</Text></View>;
}

/** One line on how the session sits in the day: the next event after it, else the one just before. Only when there is one. */
function dayContext(s: Session, events: OtherEvent[]) {
  const start = toMin(s.start), end = start + s.min;
  const timed = events.filter((e) => e.date === s.date && !e.allDay && e.start);
  const next = timed.filter((e) => toMin(e.start) >= end).sort((a, b) => toMin(a.start) - toMin(b.start))[0];
  if (next) return `${next.title || "Busy"} at ${next.start}, ${fmtGap(toMin(next.start) - end)} after you finish`;
  const prev = timed.filter((e) => toMin(e.end, toMin(e.start) + 60) <= start).sort((a, b) => toMin(b.end) - toMin(a.end))[0];
  if (prev) return `${prev.title || "Busy"} ends at ${prev.end}, ${fmtGap(start - toMin(prev.end, start))} before you start`;
  return null;
}

export function SessionSheetBody({ state, sessions, events, zones, weightKg, today, onMove, onClose }: {
  state: SheetState; sessions: Session[]; events: OtherEvent[]; zones: Record<string, Record<string, string>> | null; weightKg: number; today: string;
  onMove: (s: Session, date: string, start: string) => void; onClose: () => void;
}) {
  const { c, dark } = useTheme();
  const [editing, setEditing] = useState(false);
  const s = state.kind === "session" ? state.s : null;
  const [date, setDate] = useState(s?.date ?? today);
  const [start, setStart] = useState(toMin(s?.start));
  useEffect(() => { setEditing(false); if (s) { setDate(state.kind === "session" && state.clash ? state.clash.date : s.date); setStart(state.kind === "session" && state.clash ? state.clash.start : toMin(s.start)); } }, [state, s]);
  const busy = useMemo(() => (s ? busyOn(date, events, sessions, s.id) : []), [s, date, events, sessions]);

  if (state.kind === "event") {
    const e = state.e;
    return (
      <View style={st.body}>
        <View style={st.titleRow}>
          <Text style={[st.date, { color: c.muted }]}>{longDate(e.date)}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={[st.x, { backgroundColor: c.surface2 }]} accessibilityLabel="Close"><Icon name="close" size={14} color={c.ink2} stroke={2.2} /></Pressable>
        </View>
        <View style={st.head}>
          <View style={[st.dot, { backgroundColor: e.color ?? c.muted }]} />
          <Text style={[st.name, { color: c.ink }]} numberOfLines={2}>{e.title || "Busy"}</Text>
        </View>
        <Text style={[st.ctx, { color: c.muted }]}>{e.allDay ? "All Day" : `${e.start} to ${e.end}`}, from your calendar</Text>
      </View>
    );
  }

  const ss = state.s;
  const done = ss.actual;
  const clashNow = s ? clashOf(start, ss.min, busy) : null;
  const pick = clashNow ? suggestTime(start, ss.min, busy) : null;
  const ctx = !done ? dayContext(ss, events) : null;
  const f = !done ? sessionFuel(ss, weightKg) : null;
  const litres = f ? Math.round(((f.fluidLh * ss.min) / 60) * 10) / 10 : 0;
  const weekDays = Array.from({ length: 7 }, (_, i) => ymd(addDays(fromYmd(ss.date), i - ((fromYmd(ss.date).getDay() + 6) % 7))));
  const changed = date !== ss.date || start !== toMin(ss.start);
  const fromDrag = state.kind === "session" && !!state.clash;

  return (
    <View style={st.body}>
      <View style={st.titleRow}>
        <Text style={[st.date, { color: c.muted }]}>{longDate(fromDrag || editing ? date : ss.date)}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={[st.x, { backgroundColor: c.surface2 }]} accessibilityLabel="Close"><Icon name="close" size={14} color={c.ink2} stroke={2.2} /></Pressable>
      </View>
      <View style={st.head}>
        <View style={[st.icon, { backgroundColor: done ? (dark ? "#F3F4F6" : "#2C2D31") : c.accentSoft }]}>
          <SportIcon sport={ss.sport} size={18} color={done ? (dark ? "#101114" : "#fff") : c.accent} />
        </View>
        <Text style={[st.name, { color: c.ink }]}>{ss.title}</Text>
        {isKey(ss) && !done && <View style={[st.tag, { borderColor: c.line }]}><Icon name="bolt" size={11} color={c.ink2} stroke={2} /><Text style={[st.tagText, { color: c.ink2 }]}>Key Session</Text></View>}
        {done && <View style={[st.tag, { borderColor: c.line }]}><Icon name="check" size={11} color={c.ok} stroke={2.6} /><Text style={[st.tagText, { color: c.ink2 }]}>Done</Text></View>}
      </View>

      {done ? (
        <View style={st.facts}>{doneFacts(done).map((x) => <Fact key={x.k} k={x.k} v={`${x.v}${x.u ? ` ${x.u}` : ""}`} c={c} />)}</View>
      ) : (
        <View style={st.facts}>
          <Fact k="Start" v={toHm(fromDrag || editing ? start : toMin(ss.start))} c={c} />
          <Fact k="Duration" v={fmtDur(ss.min)} c={c} />
          <Fact k="Intensity" v={`Zone ${zoneOfSession(ss, zones)}`} c={c} />
        </View>
      )}

      {(editing || fromDrag) && !done ? (
        <View style={{ gap: 12 }}>
          {editing && (
            <>
              <View style={st.days}>
                {weekDays.map((d, i) => {
                  const on = d === date, off = d < today;
                  return (
                    <Pressable key={d} disabled={off} onPress={() => setDate(d)} style={[st.dayChip, { backgroundColor: on ? c.ink : c.surface2, opacity: off ? 0.35 : 1 }]}>
                      <Text style={[st.dayK, { color: on ? c.bg : c.muted }]}>{DAYS[i].slice(0, 1)}</Text>
                      <Text style={[st.dayV, { color: on ? c.bg : c.ink }]}>{fromYmd(d).getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={[st.stepper, { backgroundColor: c.surface2 }]}>
                <Pressable onPress={() => setStart((x) => Math.max(0, x - 15))} hitSlop={8} style={st.stepBtn}><Text style={[st.stepSign, { color: c.ink }]}>−</Text></Pressable>
                <Text style={[st.stepTime, { color: c.ink }]}>{toHm(start)}</Text>
                <Pressable onPress={() => setStart((x) => Math.min(24 * 60 - ss.min, x + 15))} hitSlop={8} style={st.stepBtn}><Text style={[st.stepSign, { color: c.ink }]}>+</Text></Pressable>
              </View>
            </>
          )}
          {clashNow && (
            <View style={[st.warn, { borderColor: "#F4B4AE", backgroundColor: dark ? "#3A1714" : "#FEF3F2" }]}>
              <Text style={[st.warnTitle, { color: c.danger }]}>Clashes with {clashNow.title}, {toHm(clashNow.start)} to {toHm(clashNow.end)}</Text>
              {pick != null && <Text style={[st.warnText, { color: c.ink2 }]}>Coach suggests {toHm(pick)}, the closest free time that day.</Text>}
            </View>
          )}
          <View style={st.btns}>
            {clashNow && pick != null
              ? <><Btn primary label={`Move to ${toHm(pick)}`} onPress={() => onMove(ss, date, toHm(pick))} c={c} /><Btn label={`Keep ${toHm(start)}`} onPress={() => onMove(ss, date, toHm(start))} c={c} /></>
              : <><Btn primary label="Save" onPress={() => (changed ? onMove(ss, date, toHm(start)) : onClose())} c={c} /><Btn label="Cancel" onPress={() => (fromDrag ? onClose() : setEditing(false))} c={c} /></>}
          </View>
        </View>
      ) : (
        <>
          {ctx && <View style={st.ctxRow}><Icon name="calendar" size={14} color={c.muted} /><Text style={[st.ctx, { color: c.muted }]}>{ctx}</Text></View>}
          {f && ss.sport !== "strength" && (
            <View style={st.fuel}>
              <View style={[st.fuelTile, { backgroundColor: c.surface2 }]}><Icon name="gel" size={18} color={c.ink2} /><View><Text style={[st.k, { color: c.muted }]}>Before</Text><Text style={[st.fuelV, { color: c.ink }]}>{f.before ? `${f.before} g carbs` : "Normal Meal"}</Text></View></View>
              <View style={[st.fuelTile, { backgroundColor: c.surface2 }]}><Icon name="bottle" size={18} color={c.ink2} /><View><Text style={[st.k, { color: c.muted }]}>During</Text><Text style={[st.fuelV, { color: c.ink }]}>{[f.perHour ? `${f.perHour} g/h` : null, litres ? `${litres} L` : null].filter(Boolean).join(", ") || "Water"}</Text></View></View>
            </View>
          )}
          <View style={st.btns}>
            {done
              ? <Btn primary label="View Activity" onPress={() => { onClose(); router.push(`/activity/${encodeURIComponent(done.id)}`); }} c={c} />
              : <><Btn primary label="View Workout" onPress={() => { onClose(); router.push(`/session/${encodeURIComponent(ss.id)}`); }} c={c} />{ss.date >= today && !ss.locked && <Btn label="Edit Time" onPress={() => setEditing(true)} c={c} />}</>}
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 2, gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  date: { fontSize: 13, fontWeight: "500" },
  x: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: -6 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, flexShrink: 1 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "600" },
  facts: { flexDirection: "row", gap: 12 },
  k: { fontSize: 11 },
  v: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  ctxRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctx: { fontSize: 13, flexShrink: 1 },
  fuel: { flexDirection: "row", gap: 8 },
  fuelTile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12 },
  fuelV: { fontSize: 14, fontWeight: "600", marginTop: 1 },
  btns: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontWeight: "600" },
  days: { flexDirection: "row", gap: 6 },
  dayChip: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 10 },
  dayK: { fontSize: 10, fontWeight: "600" },
  dayV: { fontSize: 15, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, paddingHorizontal: 8, height: 50 },
  stepBtn: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  stepSign: { fontSize: 24, fontWeight: "400" },
  stepTime: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  warn: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  warnTitle: { fontSize: 13, fontWeight: "600" },
  warnText: { fontSize: 13 },
});
