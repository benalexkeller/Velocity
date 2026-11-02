"use client";
// Plan header: where the plan goes (Google, Outlook, Apple, the calendar link), with a shortcut to connect Google
// Calendar. Accounts only.
import Link from "next/link";
import { useEffect, useState } from "react";
import { connectGoogle, isLinked, refreshCalendar, useCalendar } from "@/lib/calendar/client";
import { GoogleCalendarIcon } from "@/components/GoogleCalendarIcon";
import { PROVIDER_NAME } from "@/lib/calendar/events";

export function CalendarBadge() {
  const cal = useCalendar();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!cal.status) void refreshCalendar(); }, [cal.status]);
  if (!cal.status?.accounts) return null;
  const s = cal.status, g = s?.connection;
  const on = isLinked(s) && g?.status !== "error" && !Object.values(s?.other ?? {}).some((a) => a?.status === "error");
  // where the sessions go, and whose events show in grey
  const to: string[] = [], shown: string[] = [], broken: string[] = [];
  if (g?.status === "connected") { to.push("Google"); if (g.showEvents) shown.push("Google"); }
  if (g?.status === "error") broken.push(g.error ?? "Google Calendar needs connecting again.");
  for (const p of ["outlook", "apple"] as const) {
    const a = s?.other?.[p];
    if (!a) continue;
    if (a.status === "error") { broken.push(a.error ?? `${PROVIDER_NAME[p]} needs connecting again.`); continue; }
    if (a.write) to.push(PROVIDER_NAME[p]);
    if (a.show) shown.push(PROVIDER_NAME[p]);
  }
  const and = (l: string[]) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`);
  const text = !s ? "Checking" : [
    to.length ? `Sessions go to the Velocity training calendar in ${and(to)}.` : s.link ? "Your calendar link is on." : broken.length ? "" : "Not connected.",
    shown.length ? `Your other events from ${and(shown)} show in grey, read-only.` : "",
    ...broken,
  ].filter(Boolean).join(" ");
  return (
    <span style={{ position: "relative" }}>
      <button type="button" className={`badge${on ? "" : " ok-off"}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}><span className="ok">{on ? "✓" : "-"}</span>Calendar</button>
      {open && (
        <div className="menu" role="dialog">
          <div className="small"><b>Calendar</b><br />{text}</div>
          {s?.google && (!g || g.status === "error") && <button type="button" className="with-icon" onClick={() => connectGoogle("/plan")}><GoogleCalendarIcon />{g ? "Connect again" : "Connect Google Calendar"}</button>}
          <Link href="/profile#calendar" onClick={() => setOpen(false)}>Calendar settings</Link>
        </div>
      )}
    </span>
  );
}
