// Sign-in and sign-up: one of the few places the brand voice speaks. Same accounts as velocityathletes.com.
// Google sign-in comes later (it needs the app's own sign-in return address set up in Supabase).
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CONFIGURED, supabase } from "@/lib/supabase";
import { radius, space, type } from "@/lib/theme";

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
});
