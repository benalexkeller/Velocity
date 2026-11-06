// Signed out: the welcome screen, then Sign In or Create an Account pushed on top.
import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export const unstable_settings = { initialRouteName: "welcome" };

export default function AuthLayout() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
