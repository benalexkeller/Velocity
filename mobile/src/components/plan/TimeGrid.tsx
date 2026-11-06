// The Day, 3 Day and Week views: hours down the left, days across, sessions and calendar events as blocks.
// Swiping sideways snaps to whole days (Day, 3 Day: it moves as many days as you drag) or whole weeks (Week).
// Hold a future session to lift it, then drag: it snaps to 15 minutes and to days, and turns red on a clash.
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureDetector, ScrollView as GHScrollView, useExclusiveGestures, usePanGesture, useTapGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Session } from "@shared/data";
import { DAYS, fromYmd } from "@shared/format";
import { Icon } from "../Icon";
import { SportIcon } from "../SportIcon";
import { busyOn, clashOf, isKey, lanes, toHm, toMin } from "./blocks";
import type { OtherEvent } from "@/lib/calendar";
import { useTheme } from "@/lib/theme";

const HOUR = 50, GUT = 44, STEP = 15;
const AScroll = Animated.createAnimatedComponent(GHScrollView);
const haptic = (kind: "lift" | "tick" | "drop") => {
  if (Platform.OS === "web") return;
  if (kind === "lift") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else if (kind === "tick") Haptics.selectionAsync().catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Block colours: planned light blue with a blue line (as on the website), done black, other events grey. */
export function blockInk(dark: boolean) {
  return {
    plan: { bg: dark ? "#17244A" : "#E5F0FE", line: dark ? "#4C7BFF" : "#2459FE", ink: dark ? "#F3F4F6" : "#101114", icon: dark ? "#7FA6F5" : "#2459FE", sub: dark ? "#B8C2D6" : "#3D4150" },
    done: { bg: dark ? "#F3F4F6" : "#2C2D31", line: dark ? "#9AA1AD" : "rgba(255,255,255,0.55)", ink: dark ? "#101114" : "#FFFFFF", icon: dark ? "#101114" : "#FFFFFF", sub: dark ? "#3D4150" : "rgba(255,255,255,0.75)" },
    other: { bg: dark ? "#22252C" : "#EEF0F3", line: dark ? "#4A4F5A" : "#B9BDC6", ink: dark ? "#D6D9DF" : "#3D4150", icon: dark ? "#9AA1AD" : "#6B7280", sub: dark ? "#9AA1AD" : "#6B7280" },
    clash: { bg: dark ? "#3A1714" : "#FDECEC", line: "#D92D20", ink: dark ? "#FFD7D2" : "#7A1A12", icon: "#D92D20", sub: dark ? "#FFB4AB" : "#B42318" },
  };
}

type Placed = { start: number; end: number; s?: Session; e?: OtherEvent };

function SessionBlock({ p, colW, col, minCol, maxCol, selected, clash, draggable, missed, onTap, onLift, onMove, onDrop }: {
  p: Placed & { lane: number; of: number }; colW: number; col: number; minCol: number; maxCol: number; selected: boolean; clash: boolean; draggable: boolean; missed: boolean;
  onTap: () => void; onLift: () => void; onMove: (dCol: number, dSteps: number) => void; onDrop: (dCol: number, dSteps: number) => void;
}) {
  const { dark } = useTheme();
  const s = p.s!;
  const done = !!s.actual;
  const ink = blockInk(dark)[clash ? "clash" : done ? "done" : "plan"];
  const tx = useSharedValue(0), ty = useSharedValue(0), lift = useSharedValue(0);
  const last = useSharedValue("0:0");
  const dur = p.end - p.start;
  const pan = usePanGesture({
    enabled: draggable,
    activateAfterLongPress: 260,
    onActivate: () => { "worklet"; lift.value = withTiming(1, { duration: 120 }); scheduleOnRN(onLift); },
    onUpdate: (e) => {
      "worklet";
      const dc = Math.max(minCol - col, Math.min(maxCol - col, Math.round(e.translationX / colW)));
      const ds = Math.max(-p.start / STEP, Math.min((24 * 60 - p.end) / STEP, Math.round((e.translationY / HOUR) * (60 / STEP))));
      tx.value = withTiming(dc * colW, { duration: 70 });
      ty.value = withTiming((ds * STEP * HOUR) / 60, { duration: 70 });
      const key = `${dc}:${ds}`;
      if (key !== last.value) { last.value = key; scheduleOnRN(onMove, dc, ds); }
    },
    onDeactivate: (e) => {
      "worklet";
      const dc = Math.max(minCol - col, Math.min(maxCol - col, Math.round(e.translationX / colW)));
      const ds = Math.max(-p.start / STEP, Math.min((24 * 60 - p.end) / STEP, Math.round((e.translationY / HOUR) * (60 / STEP))));
      lift.value = withTiming(0, { duration: 140 });
      last.value = "0:0";
      scheduleOnRN(onDrop, dc, ds);
    },
    onFinalize: () => { "worklet"; tx.value = withSpring(0, { damping: 30, stiffness: 300 }); ty.value = withSpring(0, { damping: 30, stiffness: 300 }); lift.value = withTiming(0, { duration: 140 }); },
  });
  const tap = useTapGesture({ runOnJS: true, onActivate: () => onTap() });
  const gesture = useExclusiveGestures(pan, tap);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: 1 + lift.value * 0.03 }],
    zIndex: lift.value > 0 ? 50 : 1,
    shadowOpacity: lift.value * 0.25,
  }));
  const w = (colW - 4) / p.of;
  const h = Math.max(20, (dur / 60) * HOUR - 2);
  const showSub = h >= 32;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[st.block, { top: (p.start / 60) * HOUR + 1, height: h, left: 2 + p.lane * w, width: w - 1, backgroundColor: ink.bg, borderLeftColor: ink.line, opacity: missed ? 0.45 : 1 }, selected && { borderColor: dark ? "#7FA6F5" : "#2459FE", borderWidth: 2, borderLeftWidth: 3 }, anim]}>
        <View style={st.bRow}>
          {colW >= 38 && <SportIcon sport={s.sport} size={11} color={ink.icon} />}
          <Text style={[st.bTitle, { color: ink.ink }]} numberOfLines={1}>{s.title}</Text>
        </View>
        {showSub && <Text style={[st.bSub, { color: ink.sub }]} numberOfLines={1}>{done ? `${s.actual!.min} min` : `${s.min} min`}</Text>}
        {isKey(s) && !done && colW >= 44 && <View style={st.key}><Icon name="bolt" size={10} color={ink.icon} stroke={2} /></View>}
      </Animated.View>
    </GestureDetector>
  );
}

function EventBlock({ p, colW, selected, onTap }: { p: Placed & { lane: number; of: number }; colW: number; selected: boolean; onTap: () => void }) {
  const { dark } = useTheme();
  const ink = blockInk(dark).other;
  const tap = useTapGesture({ runOnJS: true, onActivate: () => onTap() });
  const w = (colW - 4) / p.of, h = Math.max(16, ((p.end - p.start) / 60) * HOUR - 2);
  return (
    <GestureDetector gesture={tap}>
      <View style={[st.block, st.event, { top: (p.start / 60) * HOUR + 1, height: h, left: 2 + p.lane * w, width: w - 1, backgroundColor: ink.bg, borderLeftColor: p.e!.color ?? ink.line }, selected && { borderColor: ink.line, borderWidth: 1.5, borderLeftWidth: 3 }]}>
        <Text style={[st.eTitle, { color: ink.ink }]} numberOfLines={h >= 30 ? 2 : 1}>{p.e!.title || "Busy"}</Text>
      </View>
    </GestureDetector>
  );
}

export function TimeGrid({ days, perScreen, startIndex, sessions, events, today, selectedId, onSelectSession, onSelectEvent, onDrop, onVisible }: {
  days: string[]; perScreen: 1 | 3 | 7; startIndex: number; sessions: Session[]; events: OtherEvent[]; today: string; selectedId: string | null;
  onSelectSession: (s: Session) => void; onSelectEvent: (e: OtherEvent) => void; onDrop: (s: Session, date: string, start: number) => void; onVisible: (firstIndex: number) => void;
}) {
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  const colW = (Math.min(width, 700) - GUT) / perScreen;
  const x = useSharedValue(startIndex * colW);
  const hRef = useRef<React.ComponentRef<typeof GHScrollView>>(null);
  const vRef = useRef<React.ComponentRef<typeof GHScrollView>>(null);
  const [drag, setDrag] = useState<{ id: string; date: string; start: number; min: number } | null>(null);
  const todayIdx = days.indexOf(today);
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();

  const onScroll = useAnimatedScrollHandler({ onScroll: (e) => { x.value = e.contentOffset.x; } });
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -x.value }] }));

  // first paint: today's columns, from just before the first thing of the day
  const firstHour = useMemo(() => {
    const vis = days.slice(startIndex, startIndex + perScreen);
    const starts = sessions.filter((s) => vis.includes(s.date) && s.sport !== "rest").map((s) => toMin(s.actual?.start ?? s.start));
    return Math.max(0, Math.floor((Math.min(6 * 60, ...starts) - 45) / 60));
  }, [days, startIndex, perScreen, sessions]);
  const placedOnce = useRef(false);
  const place = useCallback(() => {
    if (placedOnce.current) return; placedOnce.current = true;
    setTimeout(() => { hRef.current?.scrollTo({ x: startIndex * colW, animated: false }); vRef.current?.scrollTo({ y: firstHour * HOUR, animated: false }); }, 0);
  }, [startIndex, colW, firstHour]);

  const byDay = useMemo(() => {
    const m = new Map<string, Placed[]>();
    for (const s of sessions) if (s.sport !== "rest") { const a = toMin(s.actual?.start ?? s.start); const p: Placed = { start: a, end: a + (s.actual?.min ?? s.min), s }; m.set(s.date, [...(m.get(s.date) ?? []), p]); }
    for (const e of events) if (!e.allDay && e.start) { const a = toMin(e.start); const p: Placed = { start: a, end: toMin(e.end, a + 60), e }; m.set(e.date, [...(m.get(e.date) ?? []), p]); }
    return m;
  }, [sessions, events]);
  const allDay = useMemo(() => { const m = new Map<string, OtherEvent[]>(); for (const e of events) if (e.allDay) m.set(e.date, [...(m.get(e.date) ?? []), e]); return m; }, [events]);
  const hasAllDay = days.some((d) => allDay.has(d));

  const report = (ox: number) => onVisible(Math.round(ox / colW));
  const clashFor = (d: { id: string; date: string; start: number; min: number } | null) => d ? !!clashOf(d.start, d.min, busyOn(d.date, events, sessions, d.id)) : false;
  const isClash = clashFor(drag);

  return (
    <View style={{ flex: 1 }}>
      {/* day header, moved in step with the grid */}
      <View style={[st.head, { borderColor: c.line }]}>
        <View style={{ width: GUT }} />
        <View style={{ flex: 1, overflow: "hidden" }}>
          <Animated.View style={[{ flexDirection: "row", width: days.length * colW }, headStyle]}>
            {days.map((d) => {
              const dt = fromYmd(d), isT = d === today;
              return (
                <View key={d} style={{ width: colW, alignItems: "center", paddingVertical: 4 }}>
                  <Text style={[st.dow, { color: isT ? c.accent : c.muted }]}>{perScreen === 7 ? DAYS[(dt.getDay() + 6) % 7].slice(0, 3) : DAYS[(dt.getDay() + 6) % 7]}</Text>
                  <View style={[st.dnum, isT && { backgroundColor: c.accent }]}><Text style={[st.dnumText, { color: isT ? "#fff" : d < today ? c.muted : c.ink }]}>{dt.getDate()}</Text></View>
                </View>
              );
            })}
          </Animated.View>
          {hasAllDay && (
            <Animated.View style={[{ flexDirection: "row", width: days.length * colW, paddingBottom: 3 }, headStyle]}>
              {days.map((d) => (
                <View key={d} style={{ width: colW, paddingHorizontal: 2, gap: 2 }}>
                  {(allDay.get(d) ?? []).slice(0, 2).map((e) => (
                    <Text key={e.id} onPress={() => onSelectEvent(e)} numberOfLines={1} style={[st.allDay, { backgroundColor: blockInk(dark).other.bg, color: blockInk(dark).other.ink }]}>{e.title}</Text>
                  ))}
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </View>

      <GHScrollView ref={vRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} onLayout={place} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ flexDirection: "row", height: 24 * HOUR + 16, paddingTop: 8 }}>
          <View style={{ width: GUT }}>
            {Array.from({ length: 24 }, (_, h) => h > 0 && (
              <Text key={h} style={[st.hour, { top: h * HOUR - 6, color: c.muted }]}>{`${String(h).padStart(2, "0")}:00`}</Text>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {Array.from({ length: 25 }, (_, h) => <View key={h} style={[st.line, { top: h * HOUR, backgroundColor: c.line }]} />)}
            <AScroll
              ref={hRef} horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}
              snapToInterval={colW * (perScreen === 7 ? 7 : 1)} decelerationRate="fast" disableIntervalMomentum={perScreen === 7}
              contentOffset={{ x: startIndex * colW, y: 0 }} scrollEnabled={!drag}
              onMomentumScrollEnd={(e) => report(e.nativeEvent.contentOffset.x)} onScrollEndDrag={(e) => report(e.nativeEvent.contentOffset.x)}
            >
              {days.map((d, col) => {
                const placed = lanes(byDay.get(d) ?? []);
                return (
                  <View key={d} style={[st.col, { width: colW, borderLeftColor: c.line }, d === today && { backgroundColor: dark ? "rgba(76,123,255,0.06)" : "rgba(36,89,254,0.035)" }]}>
                    {placed.map((p) => p.s ? (
                      <SessionBlock
                        key={`${p.s.id}${p.s.date}${p.s.start}`} p={p} colW={colW} col={col} minCol={Math.max(0, todayIdx)} maxCol={days.length - 1}
                        selected={selectedId === p.s.id} clash={drag?.id === p.s.id && isClash}
                        draggable={!p.s.actual && p.s.date >= today && !p.s.locked} missed={!p.s.actual && p.s.date < today}
                        onTap={() => onSelectSession(p.s!)}
                        onLift={() => { haptic("lift"); setDrag({ id: p.s!.id, date: d, start: p.start, min: p.end - p.start }); }}
                        onMove={(dc, ds) => { haptic("tick"); setDrag({ id: p.s!.id, date: days[col + dc], start: p.start + ds * STEP, min: p.end - p.start }); }}
                        onDrop={(dc, ds) => { haptic("drop"); setDrag(null); if (dc || ds) onDrop(p.s!, days[col + dc], p.start + ds * STEP); }}
                      />
                    ) : (
                      <EventBlock key={`${p.e!.id}${d}`} p={p} colW={colW} selected={selectedId === p.e!.id} onTap={() => onSelectEvent(p.e!)} />
                    ))}
                    {d === today && <View style={[st.now, { top: (nowMin / 60) * HOUR, backgroundColor: c.accent }]}><View style={[st.nowDot, { backgroundColor: c.accent }]} /></View>}
                  </View>
                );
              })}
            </AScroll>
          </View>
        </View>
      </GHScrollView>
      {drag && (
        <View pointerEvents="none" style={[st.dragTip, { backgroundColor: isClash ? "#D92D20" : dark ? "#F3F4F6" : "#101114" }]}>
          <Text style={[st.dragTipText, { color: isClash ? "#fff" : dark ? "#101114" : "#fff" }]}>
            {`${DAYS[(fromYmd(drag.date).getDay() + 6) % 7]} ${fromYmd(drag.date).getDate()}, ${toHm(drag.start)}${isClash ? ", clash" : ""}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  dow: { fontSize: 11, fontWeight: "500" },
  dnum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1 },
  dnumText: { fontSize: 15, fontWeight: "600" },
  allDay: { fontSize: 10, fontWeight: "600", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  hour: { position: "absolute", right: 6, fontSize: 10, fontVariant: ["tabular-nums"] },
  line: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  col: { height: 24 * HOUR, borderLeftWidth: StyleSheet.hairlineWidth },
  block: { position: "absolute", borderRadius: 6, borderLeftWidth: 3, paddingHorizontal: 4, paddingVertical: 3, overflow: "hidden", shadowColor: "#000", shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  event: { paddingVertical: 2 },
  bRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  bTitle: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  bSub: { fontSize: 10, marginTop: 1 },
  key: { position: "absolute", top: 3, right: 3 },
  eTitle: { fontSize: 10, fontWeight: "500" },
  now: { position: "absolute", left: 0, right: 0, height: 2, zIndex: 40 },
  nowDot: { position: "absolute", left: -4, top: -3, width: 8, height: 8, borderRadius: 4 },
  dragTip: { position: "absolute", alignSelf: "center", top: 70, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  dragTipText: { fontSize: 12, fontWeight: "600" },
});
