// "Built for ___" on the welcome screen: the word rolls through who Velocity is for, slow enough to read at
// first, faster and faster (each word tipping over like a drum), then snaps onto the last word, holds, and starts again. The line stays centred:
// the word's box eases to each word's width. With Reduce Motion on, only the last word shows.
import { useFocusEffect } from "expo-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";

interface Props {
  words: string[];        // rolled through in order; the last one is where it lands
  first?: number;         // ms the first word stays
  speedUp?: number;       // each next word stays this share of the one before
  rest?: number;          // ms the last word stays before starting again
  style: TextStyle;       // font of the rolling word (colour included)
  lineHeight: number;
}

export function RollingWord({ words, first = 800, speedUp = 0.8, rest = 3000, style, lineHeight }: Props) {
  const reduced = useReducedMotion();
  const last = words.length - 1;
  const [width, setWidth] = useState<Record<string, number>>({});
  const measured = words.every((w) => width[w]);

  const [slots, setSlots] = useState<[string, string]>([words[0], words[0]]);
  const front = useRef(0);
  const pending = useRef<{ slot: number; ms: number; land: boolean } | null>(null);
  const a = useSharedValue(0), b = useSharedValue(1); // 0 shown, 1 below, -1 gone above
  const box = useSharedValue(0);
  const pos = [a, b];

  // start each roll once the incoming word is on screen (hidden below), so no old word flashes
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const out = pos[1 - p.slot], inc = pos[p.slot];
    // the old word leaves at once; the next follows a beat later, so the two barely cross
    out.value = withTiming(-1, { duration: p.ms * 0.7, easing: Easing.out(Easing.quad) });
    const lag = p.ms * 0.22;
    inc.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(lag, p.land ? withSpring(0, { damping: 13, stiffness: 520, mass: 0.7 }) : withTiming(0, { duration: p.ms * 0.8, easing: Easing.out(Easing.cubic) })),
    );
    front.current = p.slot;
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => {
    if (!measured || reduced) return;
    box.value = width[words[0]];
    const hold = (i: number) => (i === last ? rest : Math.round(first * Math.pow(speedUp, i)));
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const next = (i + 1) % words.length;
      const land = next === last;
      const ms = next === 0 ? 300 : Math.max(45, Math.min(300, hold(i) * 0.7));
      const inc = 1 - front.current;
      pending.current = { slot: inc, ms, land };
      setSlots((s) => { const n: [string, string] = [s[0], s[1]]; n[inc] = words[next]; return n; });
      box.value = withTiming(width[words[next]], { duration: land ? 260 : Math.max(ms * 1.6, 160), easing: Easing.out(Easing.cubic) });
      i = next;
      timer = setTimeout(step, hold(next));
    };
    timer = setTimeout(step, hold(0));
    return () => clearTimeout(timer);
  }, [measured, reduced])); // eslint-disable-line react-hooks/exhaustive-deps

  const boxStyle = useAnimatedStyle(() => ({ width: box.value }));
  const sA = useSlot(a, lineHeight), sB = useSlot(b, lineHeight);

  if (reduced) return <Text style={[style, { lineHeight }]}>{words[last]}</Text>;
  return (
    <>
      {/* measures every word once, off screen */}
      <View style={st.measure} pointerEvents="none" aria-hidden>
        {words.map((w) => (
          <Text key={w} style={[style, { lineHeight }]} onLayout={(e) => { const v = Math.ceil(e.nativeEvent.layout.width); setWidth((m) => (m[w] === v ? m : { ...m, [w]: v })); }}>{w}</Text>
        ))}
      </View>
      <Animated.View style={[{ height: lineHeight, opacity: measured ? 1 : 0 }, boxStyle]} accessibilityLabel={words[last]}>
        <Animated.Text style={[style, st.slot, { lineHeight, width: (width[slots[0]] ?? 0) + 2 }, sA]}>{slots[0]}</Animated.Text>
        <Animated.Text style={[style, st.slot, { lineHeight, width: (width[slots[1]] ?? 0) + 2 }, sB]}>{slots[1]}</Animated.Text>
      </Animated.View>
    </>
  );
}

function useSlot(p: SharedValue<number>, h: number) {
  // a drum: the word tips away as it rolls up and out, the next one tips in from below
  return useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.abs(p.value) * 1.5),
    transform: [{ perspective: 500 }, { translateY: p.value * h * 0.8 }, { rotateX: `${-p.value * 72}deg` }],
  }));
}

const st = StyleSheet.create({
  measure: { position: "absolute", top: -2000, left: 0, opacity: 0, alignItems: "flex-start" },
  slot: { position: "absolute", top: 0, left: 0 },
});
