// Root of the app: sign-in state, the athlete's data, and the two areas (sign-in, and the tabs once signed in).
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AthleteProvider } from "@/lib/athlete";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

function Areas() {
  const { session, ready } = useAuth();
  const { c, dark } = useTheme();
  if (!ready) return null;
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" options={{ presentation: "modal" }} />
          <Stack.Screen name="activity/[id]" />
          <Stack.Screen name="session/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Screen name="auth" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AthleteProvider>
            <Areas />
          </AthleteProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
