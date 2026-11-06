// Plan: two tabs under the app bar. Schedule (the calendar, around the athlete's life) and Training Plan (the season).
import { useState } from "react";
import { View } from "react-native";
import { Schedule } from "@/components/plan/Schedule";
import { TrainingPlan } from "@/components/plan/TrainingPlan";
import { Screen } from "@/components/Screen";
import { TopTabs } from "@/components/TopTabs";

export default function Plan() {
  const [tab, setTab] = useState<"schedule" | "plan">("schedule");
  return (
    <Screen title="Plan" brand scroll={false} bleed>
      <TopTabs tabs={[{ k: "schedule", label: "Schedule" }, { k: "plan", label: "Training Plan" }]} value={tab} onChange={setTab} />
      <View style={{ flex: 1 }}>{tab === "schedule" ? <Schedule /> : <TrainingPlan />}</View>
    </Screen>
  );
}
