"use client";
// Analysis over the athlete's live data: their plan, activities, body metrics and race.
import { useMemo } from "react";
import { usePlan } from "./store";
import { createAnalysis } from "./analysis";

export function useAnalysis() {
  const plan = usePlan();
  return useMemo(() => createAnalysis(plan.counted, plan.weeks, { phases: plan.phases, body: plan.body, athlete: plan.athlete }), [plan.counted, plan.weeks, plan.phases, plan.body, plan.athlete]);
}
