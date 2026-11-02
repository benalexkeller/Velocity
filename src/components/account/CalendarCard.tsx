"use client";
// Profile → Calendar. Every calendar in one place: Google Calendar, Outlook and Apple Calendar (each gets Velocity's
// own "Velocity training" calendar, updated within seconds of a change, and can show the athlete's other events on
// the Plan page), and the calendar link (a private address for any other calendar app).
import { useCallback, useEffect, useState } from "react";
import { usePlan } from "@/lib/store";
import { calendarPayload, connectApple, connectGoogle, connectOutlook, disconnectCalendar, otherCalendars, queueSync, refreshCalendar, setCalendarLink, setReading, useCalendar } from "@/lib/calendar/client";
import { PROVIDER_NAME, type AccountStatus, type CalProvider, type OtherCalendar } from "@/lib/calendar/events";
import { GoogleCalendarIcon } from "@/components/GoogleCalendarIcon";
import { PasswordInput } from "@/components/account/PasswordInput";

const FLAG: Record<string, string> = {
  connected: "Google Calendar connected. Your sessions are being added to the Velocity training calendar.",
  denied: "Google Calendar was not connected: the permission was not given.",
  scope: "Google Calendar was not connected: the calendar box on Google's screen was not ticked. Connect again and leave it ticked.",
  error: "Google Calendar did not connect. Try again; if it fails twice, send feedback.",
  off: "Google Calendar is not switched on for this site yet.",
  setup: "Calendars are not set up on this site yet.",
  reading: "Google Calendar connected. Your other events now show on the Plan page, read-only.",
  readscope: "Google Calendar connected, but your other events are not shown: the box to see your events was not ticked on Google's screen.",
  "outlook-connected": "Outlook connected. Your sessions are being added to a calendar called Velocity training.",
  "outlook-denied": "Outlook was not connected: the permission was not given.",
  "outlook-scope": "Outlook was not connected: Microsoft did not give access to calendars. Connect again and accept.",
  "outlook-error": "Outlook did not connect. Try again; if it fails twice, send feedback.",
  "outlook-off": "Outlook is not switched on for this site yet.",
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "30 Oct, 14:02" */
const clock = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function CalendarCard() {
  const plan = usePlan();
  const cal = useCalendar();
  const s = cal.status;
  // ?calendar=connected (or denied, error…) when Google or Microsoft sends the athlete back; the page only renders in the browser
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

  const act = async (f: () => Promise<unknown>) => { setBusy(true); setErr(null); setFlag(null); try { await f(); } catch (e) { setErr(e instanceof Error ? e.message : "Did not work. Try again."); } finally { setBusy(false); } };
  // rewrites every event, which also brings back events deleted or changed by hand in the calendar
  const syncNow = () => queueSync({ ...calendarPayload(plan.weeks, plan.athlete.zones), full: true });
  const copy = async (link: string) => { try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };

  if (!s) return <p className="muted small">Loading</p>;
  if (!s.accounts) return <p className="muted small">Calendar connections need an account.</p>;
  if (!s.ready) return <p className="muted small">{plan.athlete.isAdmin ? "Not set up yet: run supabase/schema-calendar.sql in Supabase." : "Not available yet."}</p>;

  const g = s.connection;
  const note = flag ? FLAG[flag] : cal.note;
  return (
    <div className="cal-card">
      <p className="muted small" style={{ margin: "0 0 12px" }}>Your sessions in your own calendars, so the people who share them see when you are training, and your other events on the Plan page, so you can plan around them.</p>
      {note && <p className="small" style={{ margin: "0 0 12px" }}>{note}</p>}

      {/* ---------- Google Calendar ---------- */}
      <div className="cal-row">
        <div>
          <b>Google Calendar</b>
          <span className="muted">
            {!s.google ? "Not available yet"
              : !g ? "Your sessions go to a separate calendar called Velocity training."
              : g.status === "error" ? (g.error ?? "Needs connecting again")
              : <>Connected{g.email ? `, ${g.email}` : ""}<span className="at">{cal.syncing ? "Updating" : s.syncedAt ? `Updated ${clock(s.syncedAt)}` : "Waiting for the first update"}</span></>}
          </span>
        </div>
        {s.google && (
          <div className="row">
            {!g && <button type="button" className="btn google small" disabled={busy} onClick={() => connectGoogle()}><GoogleCalendarIcon />Connect Google Calendar</button>}
            {g?.status === "error" && <button type="button" className="btn google small" disabled={busy} onClick={() => connectGoogle()}><GoogleCalendarIcon />Connect again</button>}
            {g?.status === "connected" && <button type="button" className="btn ghost small" disabled={busy || cal.syncing} onClick={syncNow}>Update now</button>}
            {g && !asking && <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(true)}>Disconnect</button>}
          </div>
        )}
      </div>
      {asking && g && (
        <div className="cal-ask">
          <span>Also delete the Velocity training calendar from your Google account?</span>
          <div className="row">
            <button type="button" className="btn danger small" disabled={busy} onClick={() => act(async () => { await disconnectCalendar("google", true); setAsking(false); })}>Delete it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(async () => { await disconnectCalendar("google", false); setAsking(false); })}>Keep it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {s.google && (!g || g.status === "connected") && (
        <div className="cal-row">
          <div>
            <b>Your Google events</b>
            <span className="muted">
              {g?.showEvents ? "Shown on the Plan page, read-only. Velocity reads them when you open the Plan page and does not store them."
                : "See your other Google Calendar events on the Plan page, read-only, so you can plan around them."}
              {!g?.canRead && " Google asks you for one more permission."}
            </span>
          </div>
          <div className="row">
            {!g?.canRead && <button type="button" className="btn google small" disabled={busy} onClick={() => connectGoogle(undefined, true)}><GoogleCalendarIcon />{g ? "Show my events" : "Connect and show"}</button>}
            {g?.canRead && !g.showEvents && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setReading({ show: true }))}>Show my events</button>}
            {g?.showEvents && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setReading({ show: false }))}>Hide</button>}
          </div>
        </div>
      )}
      {g?.showEvents && <CalendarChoice provider="google" onError={setErr} />}

      {/* ---------- Outlook and Apple ---------- */}
      <Account provider="outlook" on={s.outlookOn} acc={s.other?.outlook ?? null} syncing={cal.syncing} busy={busy} act={act} syncNow={syncNow} onError={setErr} />
      <Account provider="apple" on={s.appleOn} acc={s.other?.apple ?? null} syncing={cal.syncing} busy={busy} act={act} syncNow={syncNow} onError={setErr} />

      {/* ---------- calendar link ---------- */}
      <div className="cal-row">
        <div>
          <b>Calendar link</b>
          <span className="muted">{s.link ? "A private address for any other calendar app." : "For any other calendar app. Those apps check the link on their own schedule, from every hour to once a day."}</span>
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
            <li>Most calendar apps: add a calendar, choose subscribe or from URL, and paste the link.</li>
            <li>Google, Outlook and Apple connect directly above, which updates within seconds instead of hours.</li>
            <li>Anyone with the link can see your sessions. Turn it off and create a new one to stop an old link.</li>
          </ul>
        </div>
      )}
      {err && <p className="small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}

const WHERE: Record<CalProvider, string> = { outlook: "Outlook", apple: "iCloud" };

/** One Outlook or Apple account: connect, its two switches, which calendars to show, disconnect. */
function Account({ provider, on, acc, syncing, busy, act, syncNow, onError }: {
  provider: CalProvider; on: boolean; acc: AccountStatus | null; syncing: boolean; busy: boolean;
  act: (f: () => Promise<unknown>) => Promise<void>; syncNow: () => void; onError: (e: string | null) => void;
}) {
  const name = PROVIDER_NAME[provider];
  const [asking, setAsking] = useState(false);
  const [form, setForm] = useState(false);
  const connect = () => (provider === "outlook" ? connectOutlook() : setForm(true));
  const ok = acc?.status === "connected";
  return (
    <>
      <div className="cal-row">
        <div>
          <b>{name}</b>
          <span className="muted">
            {!on ? "Not available yet"
              : !acc ? (provider === "outlook" ? "Outlook.com, Hotmail or a work Microsoft 365 account. Your sessions go to a separate calendar called Velocity training." : "iCloud calendars on iPhone, iPad and Mac. Your sessions go to a separate calendar called Velocity training.")
              : !ok ? (acc.error ?? "Needs connecting again")
              : <>Connected{acc.email ? `, ${acc.email}` : ""}{acc.write && <span className="at">{syncing ? "Updating" : acc.syncedAt ? `Updated ${clock(acc.syncedAt)}` : "Waiting for the first update"}</span>}</>}
          </span>
        </div>
        {on && (
          <div className="row">
            {!acc && !form && <button type="button" className="btn ghost small" disabled={busy} onClick={connect}>Connect {name}</button>}
            {acc && !ok && !form && <button type="button" className="btn ghost small" disabled={busy} onClick={connect}>Connect again</button>}
            {ok && acc.write && <button type="button" className="btn ghost small" disabled={busy || syncing} onClick={syncNow}>Update now</button>}
            {acc && !asking && <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(true)}>Disconnect</button>}
          </div>
        )}
      </div>
      {form && provider === "apple" && <AppleForm onDone={() => setForm(false)} />}
      {asking && acc && (
        <div className="cal-ask">
          <span>Also delete the Velocity training calendar from {WHERE[provider]}?</span>
          <div className="row">
            <button type="button" className="btn danger small" disabled={busy} onClick={() => act(async () => { await disconnectCalendar(provider, true); setAsking(false); })}>Delete it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(async () => { await disconnectCalendar(provider, false); setAsking(false); })}>Keep it</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
          {provider === "outlook" && <span className="muted small">To also remove Velocity&apos;s permission at Microsoft: account.microsoft.com, Privacy, Apps and services.</span>}
          {provider === "apple" && <span className="muted small">To also cancel the app-specific password: account.apple.com, Sign-In and Security, App-Specific Passwords.</span>}
        </div>
      )}
      {ok && (
        <div className="cal-switches">
          <label><input type="checkbox" checked={acc.write} disabled={busy} onChange={(e) => { const v = e.target.checked; void act(() => setReading({ provider, write: v })); }} />Add my training</label>
          <label><input type="checkbox" checked={acc.show} disabled={busy} onChange={(e) => { const v = e.target.checked; void act(() => setReading({ provider, show: v })); }} />Show my events on Plan</label>
        </div>
      )}
      {ok && acc.show && <CalendarChoice provider={provider} onError={onError} />}
    </>
  );
}

/** Apple has no sign-in screen for other apps: the athlete makes an app-specific password and enters it once. */
function AppleForm({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await connectApple(id, pw); setPw(""); onDone(); }
    catch (x) { setErr(x instanceof Error ? x.message : "Apple Calendar did not connect. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <form className="form cal-apple" onSubmit={submit}>
      <ol className="small muted">
        <li>Go to <a href="https://account.apple.com" target="_blank" rel="noreferrer">account.apple.com</a> and sign in.</li>
        <li>Open Sign-In and Security, then App-Specific Passwords.</li>
        <li>Make one called Velocity and paste it below. It looks like abcd-efgh-ijkl-mnop.</li>
      </ol>
      <label><b>Apple ID</b><input type="email" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} placeholder="name@icloud.com" required /></label>
      <label><b>App-specific password</b><PasswordInput autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="abcd-efgh-ijkl-mnop" required /></label>
      <span className="hint">Not your normal Apple ID password. Velocity stores it encrypted and uses it only for your calendars. You can cancel it at account.apple.com at any time.</span>
      {err && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
      <div className="row">
        <button type="submit" className="btn small" disabled={busy || !id || !pw}>{busy ? "Checking with Apple" : "Connect Apple Calendar"}</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

/** Which of the athlete's calendars in one account show on the Plan page. */
function CalendarChoice({ provider, onError }: { provider: CalProvider | "google"; onError: (e: string | null) => void }) {
  const [list, setList] = useState<OtherCalendar[] | null>(null);
  const fail = useCallback((e: unknown) => onError(e instanceof Error ? e.message : "Your calendars did not load."), [onError]);
  useEffect(() => { let live = true; otherCalendars(provider).then((l) => { if (live) setList(l); }).catch((e) => { if (live) { setList([]); fail(e); } }); return () => { live = false; }; }, [provider, fail]);
  if (!list) return <p className="muted small cal-choice">Loading your calendars</p>;
  if (!list.length) return null;
  const toggle = async (id: string) => {
    const next = list.map((c) => (c.id === id ? { ...c, on: !c.on } : c));
    setList(next);
    try { await setReading({ ...(provider === "google" ? {} : { provider }), calendars: next.filter((c) => c.on).map((c) => c.id) }); } catch (e) { onError(e instanceof Error ? e.message : "Did not save."); }
  };
  return (
    <div className="cal-choice">
      {list.map((c) => (
        <label key={c.id}>
          <input type="checkbox" checked={c.on} onChange={() => toggle(c.id)} />
          <i style={{ background: c.color ?? "var(--muted-2, #B9BDC6)" }} />
          <span>{c.name}</span>
        </label>
      ))}
    </div>
  );
}
