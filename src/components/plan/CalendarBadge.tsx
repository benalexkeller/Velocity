"use client";
// Plan header: whether the plan goes to a calendar, with a shortcut to connect Google Calendar. Accounts only.
import Link from "next/link";
import { useEffect, useState } from "react";
import { connectGoogle, isLinked, refreshCalendar, useCalendar } from "@/lib/calendar/client";
import { GoogleCalendarIcon } from "@/components/GoogleCalendarIcon";

export function CalendarBadge() {
  const cal = useCalendar();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!cal.status) void refreshCalendar(); }, [cal.status]);
  if (!cal.status?.accounts) return null;
  const s = cal.status, g = s?.connection;
  const on = isLinked(s) && g?.status !== "error";
  const text = !s ? "Checking" : g?.status === "connected" ? `Sessions go to the Velocity training calendar in Google${g.email ? ` (${g.email})` : ""}.${g.showEvents ? " Your other Google events show in grey, read-only." : ""}` :g?.status === "error" ? g.error ?? "Google Calendar needs connecting again." : s.link ? "Your calendar link is on." : "Not connected.";
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
