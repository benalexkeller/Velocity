// Sign In and Create an Account, opened from the welcome screen. Same accounts as velocityathletes.com.
// Email and password, or Google (Supabase opens Google in an in-app browser and the app finishes with a one-time code).
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { CONFIGURED, finishSignIn, supabase } from "@/lib/supabase";
import { Icon } from "@/components/Icon";
import { LIGHT, useTheme } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

/** Google's own "G" mark, as on the website's sign-in. */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <Path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z" />
      <Path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" />
      <Path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </Svg>
  );
}

export default function SignIn() {
  const { c, dark } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"in" | "up">(params.mode === "up" ? "up" : "in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const blue = LIGHT.accent;

  const go = async () => {
    if (!supabase) return;
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg({ text: error.message, bad: true });
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: "https://www.velocityathletes.com/auth/callback?next=/setup" } });
      if (error) setMsg({ text: error.message, bad: true });
      else if (!data.session) setMsg({ text: "Check your email to confirm your account, then sign in." });
    }
    setBusy(false);
  };

  // Google: Supabase opens Google in an in-app browser and sends the athlete back to the app with a one-time code
  const google = async () => {
    if (!supabase) return;
    setMsg(null);
    const redirectTo = makeRedirectUri({ scheme: "velocity", path: "auth" });
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data?.url) { setMsg({ text: error?.message ?? "Google sign-in did not start", bad: true }); return; }
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type === "success" && !(await finishSignIn(res.url))) setMsg({ text: "Google sign-in did not finish. Try again", bad: true });
  };

  const field = [s.input, { backgroundColor: c.surface2, color: c.ink }];
  const outline = dark ? c.line : "#D5D9E0";
  return (
    <SafeAreaView style={[s.page, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={s.bar}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={s.back}>
            <Icon name="back" size={26} color={c.ink} stroke={2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
          <Text style={[s.title, { color: c.ink }]}>{mode === "in" ? "Sign In" : "Create an Account"}</Text>

          <Pressable style={({ pressed }) => [s.btn, s.outline, { borderColor: outline }, pressed && { backgroundColor: c.surface2 }]} onPress={google} accessibilityRole="button">
            <GoogleMark />
            <Text style={[s.btnText, { color: c.ink }]}>Continue with Google</Text>
          </Pressable>

          <View style={s.or}><View style={[s.orLine, { backgroundColor: c.line }]} /><Text style={[s.orText, { color: c.muted }]}>or</Text><View style={[s.orLine, { backgroundColor: c.line }]} /></View>

          {mode === "up" && <TextInput style={field} placeholder="Name" placeholderTextColor={c.muted} value={name} onChangeText={setName} autoComplete="name" />}
          <TextInput style={field} placeholder="Email" placeholderTextColor={c.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <TextInput style={field} placeholder="Password" placeholderTextColor={c.muted} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "in" ? "current-password" : "new-password"} />
          {msg && <Text style={[s.msg, { color: msg.bad ? c.danger : c.muted }]}>{msg.text}</Text>}
          {!CONFIGURED && <Text style={[s.msg, { color: c.danger }]}>Supabase settings missing (mobile/.env.local)</Text>}

          <Pressable style={({ pressed }) => [s.btn, { backgroundColor: blue, marginTop: 6 }, (pressed || busy) && { opacity: 0.85 }]} onPress={go} disabled={busy || !email || !password}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: "#fff" }]}>{mode === "in" ? "Sign In" : "Create an Account"}</Text>}
          </Pressable>

          <Pressable onPress={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} hitSlop={10}>
            <Text style={[s.switch, { color: c.muted }]}>
              {mode === "in" ? "New here? " : "Have an account? "}
              <Text style={{ color: blue, fontWeight: "600" }}>{mode === "in" ? "Create an Account" : "Sign In"}</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  bar: { height: 48, justifyContent: "center", paddingHorizontal: 14 },
  back: { width: 40, height: 40, justifyContent: "center" },
  wrap: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, marginBottom: 16 },
  input: { height: 54, borderRadius: 14, paddingHorizontal: 16, fontSize: 16 },
  btn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  outline: { borderWidth: 1.5 },
  btnText: { fontSize: 17, fontWeight: "700" },
  msg: { fontSize: 13 },
  switch: { textAlign: "center", paddingVertical: 10, fontSize: 15 },
  or: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 6 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13 },
});
