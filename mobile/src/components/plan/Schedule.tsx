// Plan, Schedule: the calendar. A slim bar (view menu, month, Today, calendar connection) over the Day, 3 Day, Week
// or Month view. Tapping a block slides up its details; holding a future session lets the athlete drag it.
import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@shared/data";
import { DAYS, addDays, fromYmd, today as todayDate, ymd } from "@shared/format";
import { Icon } from "../Icon";
import { Sheet } from "../Sheet";
import { busyOn, clashOf, toHm } from "./blocks";
import { MonthGrid } from "./MonthGrid";
import { SessionSheetBody, type SheetState } from "./SessionSheet";
import { TimeGrid } from "./TimeGrid";
import { useAthlete } from "@/lib/athlete";
import { API, useCalendarEvents, type OtherEvent } from "@/lib/calendar";
import { useTheme } from "@/lib/theme";

type Mode = "day" | "three" | "week" | "month";
const MODES: { k: Mode; label: string }[] = [{ k: "day", label: "Day" }, { k: "three", label: "3 Day" }, { k: "week", label: "Week" }, { k: "month", label: "Month" }];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export function Schedule() {
  const { c, dark } = useTheme();
  const { data, moveSession } = useAthlete();
  const t = ymd(todayDate());
  const [mode, setMode] = useState<Mode>("week");
  const [first, setFirst] = useState(t); // first visible day
  const [gridKey, setGridKey] = useState(0);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);

  const sessions = useMemo(() => (data?.weeks ?? []).flatMap((w) => w.sessions), [data]);
  // every day from the plan's first Monday to two weeks after race week (or two months either side of today)
  const days = useMemo(() => {
    const ws = data?.weeks ?? [];
    const a = ws.length ? fromYmd(ws[0].start) : mondayOf(addDays(todayDate(), -56));
    const b = ws.length ? addDays(fromYmd(ws[ws.length - 1].start), 20) : addDays(mondayOf(todayDate()), 69);
    const out: string[] = []; for (let d = mondayOf(a); d <= b; d = addDays(d, 1)) out.push(ymd(d));
    if (!out.includes(t)) { const x: string[] = []; for (let d = mondayOf(addDays(todayDate(), -28)); d <= addDays(todayDate(), 70); d = addDays(d, 1)) x.push(ymd(d)); return x; }
    return out;
  }, [data, t]);
  const months = useMemo(() => { const out: Date[] = []; const a = fromYmd(days[0]), b = fromYmd(days[days.length - 1]); for (let m = new Date(a.getFullYear(), a.getMonth(), 1); m <= b; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) out.push(m); return out; }, [days]);

  // calendar events around what is on screen (the website allows 42 days per request)
  const wk = ymd(mondayOf(fromYmd(first)));
  const { events, off } = useCalendarEvents(ymd(addDays(fromYmd(wk), -7)), ymd(addDays(fromYmd(wk), 34)));

  const per = mode === "day" ? 1 : mode === "three" ? 3 : 7;
  const startIndex = Math.max(0, days.indexOf(mode === "week" ? ymd(mondayOf(fromYmd(first))) : first));
  const monthIdx = Math.max(0, months.findIndex((m) => m.getFullYear() === fromYmd(first).getFullYear() && m.getMonth() === fromYmd(first).getMonth()));
  const mid = fromYmd(days[Math.min(days.length - 1, startIndex + Math.floor(per / 2))] ?? t);
  const label = mode === "month" ? months[monthIdx] : mid;

  const goToday = () => { setFirst(t); setGridKey((k) => k + 1); };
  const showToast = (text: string, undo?: () => void) => { setToast({ text, undo }); setTimeout(() => setToast((x) => (x?.text === text ? null : x)), 4000); };
  const closeSheet = () => { setOpen(false); setTimeout(() => setSheet(null), 260); };
  const openSheet = (st: SheetState) => { setSheet(st); setOpen(true); };

  const move = async (s: Session, date: string, start: string) => {
    const from = { date: s.date, start: s.start ?? "06:00" };
    closeSheet();
    const ok = await moveSession(s.id, date, start);
    const d = fromYmd(date);
    if (ok) showToast(`Moved to ${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}, ${start}`, () => { moveSession(s.id, from.date, from.start); setToast(null); });
    else showToast("Could not save the move. Check your connection");
  };
  const onDrop = (s: Session, date: string, startMin: number) => {
    const clash = clashOf(startMin, s.min, busyOn(date, events, sessions, s.id));
    if (clash) openSheet({ kind: "session", s, clash: { date, start: startMin } });
    else move(s, date, toHm(startMin));
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={st.bar}>
        <Pressable onPress={() => setMenu((m) => !m)} hitSlop={8} style={st.iconBtn} accessibilityLabel="Calendar view"><Icon name="menu" size={20} color={c.ink} /></Pressable>
        <Pressable onPress={() => setMenu((m) => !m)} style={st.month} accessibilityLabel="Change view">
          <Text style={[st.monthText, { color: c.ink }]}>{MONTH[label.getMonth()]}{label.getFullYear() !== todayDate().getFullYear() ? ` ${label.getFullYear()}` : ""}</Text>
          <Icon name="down" size={14} color={c.muted} stroke={2.2} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={goToday} style={[st.pill, { borderColor: c.line }]} accessibilityRole="button"><Text style={[st.pillText, { color: c.ink }]}>Today</Text></Pressable>
        <Pressable onPress={() => Linking.openURL(`${API}/profile#calendar`)} style={[st.pill, st.cal, { borderColor: c.line }]} accessibilityRole="button" accessibilityLabel={off ? "Connect calendar" : "Calendar settings"}>
          <Icon name={off ? "calendarPlus" : "calendar"} size={16} color={c.ink} />
          {off ? <Text style={[st.pillText, { color: c.ink }]}>Connect</Text> : <View style={[st.on, { backgroundColor: dark ? "#3FB97A" : "#157347", borderColor: c.bg }]} />}
        </Pressable>
      </View>

      {mode === "month" ? (
        <MonthGrid key={`m${gridKey}`} months={months} startIndex={monthIdx} sessions={sessions} events={events} today={t}
          onPickDay={(d) => { setFirst(d); setMode("day"); setGridKey((k) => k + 1); }} onVisible={(i) => months[i] && setFirst(ymd(months[i]))} />
      ) : (
        <TimeGrid
          key={`${mode}${gridKey}`} days={days} perScreen={per} startIndex={startIndex} sessions={sessions} events={events} today={t}
          selectedId={open && sheet ? (sheet.kind === "session" ? sheet.s.id : sheet.e.id) : null}
          onSelectSession={(s) => openSheet({ kind: "session", s })} onSelectEvent={(e: OtherEvent) => openSheet({ kind: "event", e })}
          onDrop={onDrop} onVisible={(i) => days[i] && setFirst(days[i])}
        />
      )}

      {menu && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel="Close menu" />
          <View style={[st.menu, { backgroundColor: c.surface, borderColor: c.line }]}>
            {MODES.map((m, i) => (
              <Pressable key={m.k} onPress={() => { setMode(m.k); setMenu(false); setGridKey((k) => k + 1); }} style={({ pressed }) => [st.menuRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.surface2 }]}>
                <Text style={[st.menuText, { color: c.ink }]}>{m.label}</Text>
                {mode === m.k && <Icon name="check" size={16} color={c.accent} stroke={2.4} />}
              </Pressable>
            ))}
          </View>
        </>
      )}

      {toast && (
        <View style={[st.toast, { backgroundColor: dark ? "#F3F4F6" : "#101114" }]}>
          <Text style={[st.toastText, { color: dark ? "#101114" : "#fff" }]}>{toast.text}</Text>
          {toast.undo && <Pressable onPress={toast.undo} hitSlop={8}><Text style={[st.toastBtn, { color: dark ? "#2459FE" : "#8FB0FF" }]}>Undo</Text></Pressable>}
        </View>
      )}

      <Sheet open={open} onClose={() => { setOpen(false); setSheet(null); }}>
        {sheet && (
          <SessionSheetBody state={sheet} sessions={sessions} events={events} zones={data?.raw.profile?.zones ?? null} weightKg={data?.raw.weightKg ?? 70} today={t}
            onMove={move} onClose={closeSheet} />
        )}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  month: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  monthText: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  pill: { height: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  pillText: { fontSize: 13, fontWeight: "600" },
  cal: { flexDirection: "row", gap: 5, paddingHorizontal: 9 },
  on: { position: "absolute", top: 5, right: 6, width: 7, height: 7, borderRadius: 4, borderWidth: 1 },
  menu: { position: "absolute", top: 42, left: 12, width: 180, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, height: 44 },
  menuText: { fontSize: 15 },
  toast: { position: "absolute", left: 16, right: 16, bottom: 104, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  toastText: { fontSize: 14, fontWeight: "500", flexShrink: 1 },
  toastBtn: { fontSize: 14, fontWeight: "700", marginLeft: 12 },
});
