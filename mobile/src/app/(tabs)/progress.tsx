// Progress: two tabs under the app bar. Analysis (scores, volume, body, performance) and Activities (the archive).
import { useState } from "react";
import { View } from "react-native";
import { Activities } from "@/components/progress/Activities";
import { Analysis } from "@/components/progress/Analysis";
import { Screen } from "@/components/Screen";
import { TopTabs } from "@/components/TopTabs";

export default function Progress() {
  const [tab, setTab] = useState<"analysis" | "activities">("analysis");
  return (
    <Screen title="Progress" brand scroll={false} bleed>
      <TopTabs tabs={[{ k: "analysis", label: "Analysis" }, { k: "activities", label: "Activities" }]} value={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>{tab === "analysis" ? <Analysis /> : <Activities />}</View>
    </Screen>
  );
}
