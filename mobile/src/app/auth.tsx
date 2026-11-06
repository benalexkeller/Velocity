// Where Google sign-in returns if the phone opens the app link directly (some Android phones do): finish the
// sign-in from the link, then go to Today.
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { finishSignIn } from "@/lib/supabase";

export default function AuthReturn() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url) return;
    finishSignIn(url).finally(() => router.replace("/"));
  }, [url]);
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B0C0F" }}><ActivityIndicator color="#fff" /></View>;
}
