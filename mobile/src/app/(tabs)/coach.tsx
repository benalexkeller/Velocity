// Coach: talk or type. The conversation is wired to the website's coach once the app can call it with its sign-in.
import { StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Placeholder, Screen } from "@/components/Screen";
import { radius, space, type, useTheme } from "@/lib/theme";

export default function Coach() {
  const { c } = useTheme();
  return (
    <Screen title="Coach" scroll={false}>
      <Placeholder label="Conversation" h={420} />
      <View style={[s.bar, { backgroundColor: c.surface2, borderColor: c.line }]}>
        <TextInput style={[s.input, { color: c.ink }]} placeholder="Ask Your Coach" placeholderTextColor={c.muted} editable={false} />
        <View style={[s.mic, { backgroundColor: c.accent }]}><Icon name="mic" size={18} color="#fff" /></View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", borderRadius: radius.round, borderWidth: StyleSheet.hairlineWidth, paddingLeft: space.l, paddingRight: 5, height: 48 },
  input: { flex: 1, ...type.body },
  mic: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
