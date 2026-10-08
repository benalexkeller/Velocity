"use client";
import { useEffect, useState } from "react";

/** The current time, refreshed every minute (NOW line, greeting). */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), everyMs); return () => clearInterval(t); }, [everyMs]);
  return now;
}
