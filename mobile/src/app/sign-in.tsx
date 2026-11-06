// Sign-in and sign-up: one of the few places the brand voice speaks. Same accounts as velocityathletes.com.
// Google sign-in comes later (it needs the app's own sign-in return address set up in Supabase).
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { CONFIGURED, finishSignIn, supabase } from "@/lib/supabase";
import { radius, space, type } from "@/lib/theme";

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

// The door is always dark, whatever the phone's setting: it is the brand's moment, not a screen to work in.
const C = { bg: "#0B0C0F", ink: "#FFFFFF", muted: "#9AA1AD", field: "#16181D", line: "#2A2D35", accent: "#2459FE", danger: "#F26B5E" };

export default function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

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

  return (
    <SafeAreaView style={s.page}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
        <Text style={s.brand}>VELOCITY</Text>
        <View style={s.lineBox}>
          <Text style={s.line}>Let them call it talent</Text>
        </View>

        <View style={s.form}>
          {mode === "up" && <TextInput style={s.input} placeholder="Name" placeholderTextColor={C.muted} value={name} onChangeText={setName} autoComplete="name" />}
          <TextInput style={s.input} placeholder="Email" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={C.muted} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "in" ? "current-password" : "new-password"} />
          {msg && <Text style={[s.msg, msg.bad && { color: C.danger }]}>{msg.text}</Text>}
          {!CONFIGURED && <Text style={[s.msg, { color: C.danger }]}>Supabase settings missing (mobile/.env.local)</Text>}
          <Pressable style={({ pressed }) => [s.btn, (pressed || busy) && { opacity: 0.8 }]} onPress={go} disabled={busy || !email || !password}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{mode === "in" ? "Sign in" : "Create account"}</Text>}
          </Pressable>
          <View style={s.or}><View style={s.orLine} /><Text style={s.orText}>or</Text><View style={s.orLine} /></View>
          <Pressable style={({ pressed }) => [s.google, pressed && { opacity: 0.85 }]} onPress={google} accessibilityRole="button">
            <GoogleMark />
            <Text style={s.googleText}>Continue with Google</Text>
          </Pressable>
          <Pressable onPress={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} hitSlop={10}>
            <Text style={s.switch}>{mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  wrap: { flex: 1, paddingHorizontal: space.xl, justifyContent: "space-between", paddingTop: space.xl, paddingBottom: space.l },
  brand: { color: C.ink, fontSize: 15, fontWeight: "700", letterSpacing: 4 },
  lineBox: { flex: 1, justifyContent: "center" },
  line: { color: C.ink, fontSize: 46, lineHeight: 50, fontWeight: "800", letterSpacing: -1.5 },
  form: { gap: space.m },
  input: { height: 50, borderRadius: radius.m, backgroundColor: C.field, borderWidth: 1, borderColor: C.line, color: C.ink, paddingHorizontal: space.l, ...type.body },
  btn: { height: 52, borderRadius: radius.m, backgroundColor: C.accent, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  msg: { color: C.muted, ...type.small },
  switch: { color: C.muted, textAlign: "center", paddingVertical: space.s, ...type.small },
  or: { flexDirection: "row", alignItems: "center", gap: space.m },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.line },
  orText: { color: C.muted, ...type.small },
  google: { height: 52, borderRadius: radius.m, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  googleText: { color: "#1F1F1F", fontSize: 16, fontWeight: "600" },
});
