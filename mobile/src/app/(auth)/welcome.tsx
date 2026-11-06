// The front door: the mark, Velocity, and "Built for ___" rolling through who it is for before landing on
// Winners. Create an Account or Sign In; the same accounts as velocityathletes.com.
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mark } from "@/components/Mark";
import { RollingWord } from "@/components/RollingWord";
import { API } from "@/lib/calendar";
import { LIGHT, useTheme } from "@/lib/theme";

// who it is for first, then the mindset (readable for about nine words, then a blur), landing on the last
export const WORDS = ["Athletes", "Runners", "Cyclists", "Swimmers", "Triathletes", "Early Risers", "Planners", "Racers", "Finishers", "Competitors", "Contenders", "Underdogs", "Grinders", "Closers", "Champions", "Winners"];

const LINE = 40;

export default function Welcome() {
  const { c, dark } = useTheme();
  const blue = LIGHT.accent;
  const open = (path: string) => WebBrowser.openBrowserAsync(`${API}${path}`).catch(() => {});
  // "Built for Winners" is centred and never moves; longer words run on to the right. On a narrow phone the
  // line shifts left just enough for the longest word to fit.
  const [fit, setFit] = useState({ space: 0, row: 0, over: 0 });
  const shift = fit.space && fit.row ? Math.max(0, fit.over - (fit.space - fit.row) / 2) : 0;
  return (
    <SafeAreaView style={[s.page, { backgroundColor: c.bg }]}>
      <View style={{ flex: 1.15 }} />
      <View style={s.brand}>
        <Mark width={76} color={blue} />
        <Text style={[s.name, { color: c.ink }]}>Velocity</Text>
      </View>
      <View style={{ flex: 1.5 }} />
      <View style={s.lineSpace} onLayout={(e) => { const w = e.nativeEvent.layout.width; setFit((f) => ({ ...f, space: w })); }}>
        <View style={[s.lineRow, { transform: [{ translateX: -shift }] }]} onLayout={(e) => { const w = e.nativeEvent.layout.width; setFit((f) => ({ ...f, row: w })); }}>
          <Text style={[s.line, { color: c.ink, lineHeight: LINE }]}>Built for</Text>
          <RollingWord words={WORDS} style={{ ...s.line, color: blue }} lineHeight={LINE} onMeasure={(last, longest) => setFit((f) => ({ ...f, over: longest - last }))} />
        </View>
      </View>
      <View style={{ flex: 1.2 }} />
      <View style={s.actions}>
        <Pressable style={({ pressed }) => [s.btn, { backgroundColor: blue }, pressed && { opacity: 0.85 }]} onPress={() => router.push({ pathname: "/sign-in", params: { mode: "up" } })} accessibilityRole="button">
          <Text style={[s.btnText, { color: "#fff" }]}>Create an Account</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [s.btn, s.outline, { borderColor: dark ? c.line : "#D5D9E0" }, pressed && { backgroundColor: c.surface2 }]} onPress={() => router.push("/sign-in")} accessibilityRole="button">
          <Text style={[s.btnText, { color: c.ink }]}>Sign In</Text>
        </Pressable>
        <Text style={[s.legal, { color: c.muted }]}>
          By continuing, you agree to our{" "}
          <Text style={s.link} onPress={() => open("/terms")}>Terms</Text> and{" "}
          <Text style={s.link} onPress={() => open("/privacy")}>Privacy Policy</Text>.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 22 },
  brand: { alignItems: "center", gap: 14 },
  name: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  lineSpace: { marginHorizontal: -10, alignItems: "center" },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  line: { fontSize: 31, fontWeight: "800", letterSpacing: -0.8 },
  actions: { gap: 12, paddingBottom: 8 },
  btn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  outline: { borderWidth: 1.5 },
  btnText: { fontSize: 18, fontWeight: "700" },
  legal: { textAlign: "center", fontSize: 12.5, marginTop: 8, lineHeight: 18 },
  link: { textDecorationLine: "underline" },
});
