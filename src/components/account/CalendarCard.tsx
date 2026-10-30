"use client";
// Profile → Calendar. Google Calendar (Velocity's own "Velocity training" calendar in the athlete's Google account,
// updated within seconds of a change) and the calendar link (a private address for Apple Calendar, Outlook and
// others, refreshed whenever that app checks it).
import { useEffect, useState } from "react";
import { usePlan } from "@/lib/store";
import { calendarPayload, connectGoogle, disconnectGoogle, queueSync, refreshCalendar, setCalendarLink, useCalendar } from "@/lib/calendar/client";

const FLAG: Record<string, string> = {
  connected: "Google Calendar connected. Your sessions are being added to the Velocity training calendar.",
  denied: "Google Calendar was not connected: the permission was not given.",
  scope: "Google Calendar was not connected: the calendar box on Google's screen was not ticked. Connect again and leave it ticked.",
  error: "Google Calendar did not connect. Try again; if it fails twice, send feedback.",
  off: "Google Calendar is not switched on for this site yet.",
  setup: "Google Calendar is not set up on this site yet.",
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "30 Oct, 14:02" */
const clock = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function CalendarCard() {
  const plan = usePlan();
  const cal = useCalendar();
  const s = cal.status;
  // ?calendar=connected (or denied, error…) when Google sends the athlete back; the page only renders in the browser
  const [flag, setFlag] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("calendar")));
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void refreshCalendar();
    // the flag is read once; take it out of the address so a reload does not show it again
    const u = new URL(window.location.href);
    if (u.searchParams.has("calendar")) { u.searchParams.delete("calendar"); window.history.replaceState(null, "", u.toString()); }
  }, []);

  const act = async (f: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : "Did not work. Try again."); } finally { setBusy(false); } };
  // rewrites every event, which also brings back events deleted or changed by hand in Google
  const syncNow = () => queueSync({ ...calendarPayload(plan.weeks, plan.athlete.zones), full: true });
  const copy = async (link: string) => { try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };

  if (!s) return <p className="muted small">Loading</p>;
  if (!s.accounts) return <p className="muted small">Calendar connections need an account.</p>;
  if (!s.ready) return <p className="muted small">{plan.athlete.isAdmin ? "Not set up yet: run supabase/schema-calendar.sql in Supabase." : "Not available yet."}</p>;

  const g = s.connection;
  const note = flag ? FLAG[flag] : cal.note;
  return (
    <div className="cal-card">
      <p className="muted small" style={{ margin: "0 0 12px" }}>Your sessions in your own calendar, so the people who share it see when you are training.</p>
      {note && <p className="small" style={{ margin: "0 0 12px" }}>{note}</p>}

      <div className="cal-row">
        <div>
          <b>Google Calendar</b>
          <span className="muted">
            {!s.google ? "Not available yet"
              : !g ? "A separate calendar called Velocity training. Velocity cannot see your other calendars or events."
              : g.status === "error" ? (g.error ?? "Needs connecting again")
              : <>Connected{g.email ? `, ${g.email}` : ""}<span className="at">{cal.syncing ? "Updating" : s.syncedAt ? `Updated ${clock(s.syncedAt)}` : "Waiting for the first update"}</span></>}
          </span>
        </div>
        {s.google && (
          <div className="row">
            {!g && <button type="button" className="btn small" disabled={busy} onClick={() => connectGoogle()}>Connect Google Calendar</button>}
            {g?.status === "error" && <button type="button" className="btn small" disabled={busy} onClick={() => connectGoogle()}>Connect again</button>}
            {g?.status === "connected" && <button type="button" className="btn ghost small" disabled={busy || cal.syncing} onClick={syncNow}>Update now</button>}
            {g && !asking && <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(true)}>Disconnect</button>}
          </div>
        )}
      </div>
      {asking && g && (
        <div className="cal-ask">
          <span>Also delete the Velocity training calendar from your Google account?</span>
          <div className="row">
            <button type="button" className="btn danger small" disabled={busy} onClick={() => act(async () => { await disconnectGoogle(true); setAsking(false); setFlag(null); })}>Delete it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(async () => { await disconnectGoogle(false); setAsking(false); setFlag(null); })}>Keep it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="cal-row">
        <div>
          <b>Calendar link</b>
          <span className="muted">{s.link ? "A private address for Apple Calendar, Outlook or any other calendar app." : "For Apple Calendar, Outlook or any other calendar app. Those apps check the link on their own schedule, from every hour to once a day."}</span>
        </div>
        <div className="row">
          {!s.link && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(async () => { await setCalendarLink(true); queueSync(calendarPayload(plan.weeks, plan.athlete.zones)); })}>Create link</button>}
          {s.link && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setCalendarLink(false))}>Turn off</button>}
        </div>
      </div>
      {s.link && (
        <div className="cal-link">
          <div className="row">
            <input readOnly value={s.link} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn small" onClick={() => copy(s.link!)}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <ul className="small muted">
            <li>Apple Calendar: File, New Calendar Subscription, paste the link, set Auto-refresh to every hour.</li>
            <li>Outlook: Add calendar, Subscribe from web, paste the link.</li>
            <li>Google Calendar: Other calendars, the plus sign, From URL. Google checks the link about once a day, so Connect Google Calendar above is faster.</li>
            <li>Anyone with the link can see your sessions. Turn it off and create a new one to stop an old link.</li>
          </ul>
        </div>
      )}
      {err && <p className="small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}
