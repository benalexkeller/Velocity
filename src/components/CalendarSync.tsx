"use client";
// Keeps the athlete's calendar up to date without a button: once the plan is loaded, and a few seconds after any
// change to it (moved, edited, added or deleted sessions, coach changes, a rebuilt plan), the sessions are sent to
// the server when a calendar is linked and the list differs from the last one sent. Renders nothing.
import { useEffect, useMemo } from "react";
import { usePlan } from "@/lib/store";
import { calendarPayload, isLinked, queueSync, refreshCalendar, useCalendar } from "@/lib/calendar/client";

export function CalendarSync() {
  const plan = usePlan();
  const cal = useCalendar();
  useEffect(() => { if (plan.accounts && plan.ready) void refreshCalendar(); }, [plan.accounts, plan.ready]);
  const payload = useMemo(() => calendarPayload(plan.weeks, plan.athlete.zones), [plan.weeks, plan.athlete.zones]);
  const linked = isLinked(cal.status);
  const lastSig = cal.status?.sig ?? null;
  useEffect(() => {
    if (!plan.accounts || !plan.ready || !linked || payload.sig === lastSig) return;
    const t = window.setTimeout(() => queueSync(payload), 2500);
    return () => window.clearTimeout(t);
  }, [plan.accounts, plan.ready, linked, payload, lastSig]);
  return null;
}
