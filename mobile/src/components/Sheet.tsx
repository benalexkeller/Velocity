// A panel that slides up from the bottom, iOS style. Drag the handle or the top down to close it (or tap outside);
// with two heights it snaps between a peek and full height instead of closing.
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTheme } from "@/lib/theme";

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/** Closable sheet that fits its content. `open` false slides it away; onClose fires once it is gone. */
export function Sheet({ open, onClose, children, dim = false }: { open: boolean; onClose: () => void; children: ReactNode; dim?: boolean }) {
  const { c, dark } = useTheme();
  const [h, setH] = useState(0);
  const y = useSharedValue(800);
  useEffect(() => {
    if (!h) return;
    y.value = open ? withSpring(0, SPRING) : withTiming(h + 40, { duration: 220, easing: Easing.in(Easing.quad) });
  }, [open, h, y]);
  const close = () => { y.value = withTiming(h + 40, { duration: 200 }, () => { scheduleOnRN(onClose); }); };
  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (e) => { "worklet"; y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15; },
    onDeactivate: (e) => {
      "worklet";
      if (e.translationY > h * 0.28 || e.velocityY > 900) y.value = withTiming(h + 40, { duration: 180 }, () => { scheduleOnRN(onClose); });
      else y.value = withSpring(0, SPRING);
    },
  });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: h ? interpolate(y.value, [0, h], [1, 0], "clamp") : 0 }));
  return (
    // clipped to the screen area, so a closed sheet never shows below it (around the floating tab bar)
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents={open ? "box-none" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dim ? (dark ? "rgba(0,0,0,0.35)" : "rgba(16,17,20,0.10)") : "transparent" }, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)} style={[st.sheet, { backgroundColor: c.surface, borderColor: c.line }, sheetStyle]}>
          <View style={[st.handle, { backgroundColor: c.line }]} />
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** Sheet with two heights (peek and full) that the athlete drags between; it never closes. */
export function SnapSheet({ peek, full, expanded, onChange, header, children }: { peek: number; full: number; expanded: boolean; onChange: (expanded: boolean) => void; header: ReactNode; children: ReactNode }) {
  const { c } = useTheme();
  const gap = Math.max(0, full - peek);
  const y = useSharedValue(expanded ? 0 : gap);
  useEffect(() => { y.value = withSpring(expanded ? 0 : gap, SPRING); }, [expanded, gap, y]);
  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (e) => { "worklet"; const base = expanded ? 0 : gap; y.value = Math.min(gap + 30, Math.max(-20, base + e.translationY)); },
    onDeactivate: (e) => {
      "worklet";
      const open = e.velocityY < -500 ? true : e.velocityY > 500 ? false : y.value < gap / 2;
      y.value = withSpring(open ? 0 : gap, SPRING);
      scheduleOnRN(onChange, open);
    },
  });
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[st.snap, { height: full, backgroundColor: c.surface, borderColor: c.line }, style]}>
      <GestureDetector gesture={pan}>
        <View>
          <Pressable onPress={() => onChange(!expanded)} accessibilityLabel={expanded ? "Collapse" : "Expand"}>
            <View style={[st.handle, { backgroundColor: c.line }]} />
          </Pressable>
          {header}
        </View>
      </GestureDetector>
      {children}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingBottom: 24, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  snap: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -3 }, elevation: 10, overflow: "hidden" },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: "center", marginTop: 7, marginBottom: 6 },
});
