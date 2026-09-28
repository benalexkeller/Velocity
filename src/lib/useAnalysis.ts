"use client";
// Analysis over the live plan store: seed data plus everything logged or changed on this device.
import { useMemo } from "react";
import { usePlan } from "./store";
import { createAnalysis } from "./analysis";

export function useAnalysis() {
  const plan = usePlan();
  return useMemo(() => createAnalysis(plan.activities, plan.weeks), [plan.activities, plan.weeks]);
}
