// The athlete's other calendar events (Google, Outlook, Apple), read live from the website's API with the app's
// sign-in, never stored. Shown on Plan as grey blockers next to the training.
import { useEffect, useState } from "react";
import { useAuth } from "./auth";

export interface OtherEvent { id: string; cal: string; title: string; date: string; start?: string; end?: string; allDay: boolean; color: string | null }

const API = process.env.EXPO_PUBLIC_API_URL ?? "https://www.velocityathletes.com";
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } };

/** Events between two dates (YYYY-MM-DD, at most 42 days apart, as the API allows). */
export function useCalendarEvents(from: string, to: string) {
  const { session } = useAuth();
  const [events, setEvents] = useState<OtherEvent[]>([]);
  const token = session?.access_token;
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetch(`${API}/api/calendar/events?from=${from}&to=${to}&tz=${encodeURIComponent(tz())}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j: { events?: OtherEvent[] }) => { if (live) setEvents(j.events ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, [from, to, token]);
  return events;
}
