"use client";
// Profile → Calendar. Every calendar in one list: Google Calendar, Outlook and Apple Calendar (each gets Velocity's
// own "Velocity training" calendar, updated within seconds of a change, and can show the athlete's other events on
// the Plan page), and the calendar link (a private address for any other calendar app). One row per calendar: name,
// account, one button; the switches appear under a row once it is connected.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePlan } from "@/lib/store";
import { calendarPayload, connectApple, connectGoogle, connectOutlook, disconnectCalendar, otherCalendars, queueSync, refreshCalendar, setCalendarLink, setReading, useCalendar } from "@/lib/calendar/client";
import { PROVIDER_NAME, type AccountStatus, type CalProvider, type OtherCalendar } from "@/lib/calendar/events";
import { GoogleCalendarIcon } from "@/components/GoogleCalendarIcon";
import { PasswordInput } from "@/components/account/PasswordInput";

const FLAG: Record<string, string> = {
  connected: "Google Calendar connected. Your sessions are being added.",
  denied: "Google Calendar was not connected: the permission was not given.",
  scope: "Google Calendar was not connected: the calendar box on Google's screen was not ticked. Connect again and leave it ticked.",
  error: "Google Calendar did not connect. Try again; if it fails twice, send feedback.",
  off: "Google Calendar is not switched on for this site yet.",
  setup: "Calendars are not set up on this site yet.",
  reading: "Google Calendar connected. Your other events now show on the Plan page.",
  readscope: "Your Google events are not shown: the box to see your events was not ticked on Google's screen.",
  "outlook-connected": "Outlook connected. Your sessions are being added.",
  "outlook-denied": "Outlook was not connected: the permission was not given.",
  "outlook-scope": "Outlook was not connected: Microsoft did not give access to calendars. Connect again and accept.",
  "outlook-error": "Outlook did not connect. Try again; if it fails twice, send feedback.",
  "outlook-off": "Outlook is not switched on for this site yet.",
};

/** false: Google has the same "Show my events on Plan" switch as Outlook and Apple (chosen 2 Nov 2026, while Google
 *  was still reviewing calendar.events.readonly). true brings back the exact words sent to Google's reviewers on
 *  1 Nov ("Connect Google Calendar", "Your other events", "Connect and show"), if a reviewer cannot follow the new
 *  layout. Either way the permissions asked for are the same. */
const GOOGLE_AS_REVIEWED = false;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "30 Oct, 14:02" */
const clock = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/** A plain calendar outline, for calendars whose own icon Velocity may not use. */
const CalendarGlyph = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" /><path d="M3 8.5h14M7 2.8v3.2M13 2.8v3.2" />
  </svg>
);
const LinkGlyph = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1" /><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1" />
  </svg>
);

/** One calendar in the list: icon, name, account or state, one button; switches and forms underneath. */
function Item({ icon, name, status, error, action, children }: { icon: ReactNode; name: string; status: ReactNode; error?: boolean; action?: ReactNode; children?: ReactNode }) {
  return (
    <li className="cal-item">
      <div className="cal-head">
        <span className="cal-ic">{icon}</span>
        <div className="cal-txt"><b>{name}</b><span className={error ? "err" : "muted"}>{status}</span></div>
        {action && <div className="cal-act">{action}</div>}
      </div>
      {children && <div className="cal-sub">{children}</div>}
    </li>
  );
}

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
  // rewrites every event everywhere, which also brings back events deleted or changed by hand in a calendar
  const syncNow = () => queueSync({ ...calendarPayload(plan.weeks, plan.athlete.zones), full: true });
  const copy = async (link: string) => { try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };

  if (!s) return <p className="muted small">Loading</p>;
  if (!s.accounts) return <p className="muted small">Calendar connections need an account.</p>;
  if (!s.ready) return <p className="muted small">{plan.athlete.isAdmin ? "Not set up yet: run supabase/schema-calendar.sql in Supabase." : "Not available yet."}</p>;

  const g = s.connection;
  const note = flag ? FLAG[flag] : cal.note;
  const writing = g?.status === "connected" || Object.values(s.other ?? {}).some((a) => a?.status === "connected" && a.write);
  return (
    <div className="cal-card">
      <div className="cal-top">
        <p className="muted small">Your sessions go into your calendar. Your other events can show on the Plan page.</p>
        {writing && (
          <span className="small cal-upd">
            <span className="muted">{cal.syncing ? "Updating" : s.syncedAt ? `Updated ${clock(s.syncedAt)}` : "Waiting for the first update"}</span>
            <button type="button" className="link-btn" disabled={busy || cal.syncing} onClick={syncNow}>Update now</button>
          </span>
        )}
      </div>
      {note && <p className="small cal-note">{note}</p>}

      <ul className="cal-list">
        {/* ---------- Google Calendar ---------- */}
        <Item icon={<GoogleCalendarIcon size={20} />} name="Google Calendar"
          status={!s.google ? "Not available yet" : !g ? "Not connected" : g.status === "error" ? (g.error ?? "Needs connecting again") : g.email ?? "Connected"}
          error={g?.status === "error"}
          action={s.google && (
            !g ? (GOOGLE_AS_REVIEWED
              ? <button type="button" className="btn google small" disabled={busy} onClick={() => connectGoogle()}><GoogleCalendarIcon />Connect Google Calendar</button>
              : <button type="button" className="btn small" disabled={busy} onClick={() => connectGoogle()}>Connect</button>)
              : g.status === "error" ? <button type="button" className="btn small" disabled={busy} onClick={() => connectGoogle()}>Connect again</button>
              : !asking && <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(true)}>Disconnect</button>
          )}>
          {asking && g && <Ask where="your Google account" busy={busy} onAnswer={(remove) => act(async () => { if (remove !== null) await disconnectCalendar("google", remove); setAsking(false); })} />}
          {/* the wording Google's reviewers were given: "Your other events", "Connect and show" */}
          {GOOGLE_AS_REVIEWED && s.google && !asking && (!g || g.status === "connected") && (
            <>
              <div className="cal-subrow">
                <div>
                  <b>Your other events</b>
                  <span className="muted">{g?.showEvents ? "Shown on the Plan page, read-only. Not stored." : "See your other Google Calendar events on the Plan page, read-only."}{!g?.canRead && " Google asks you for one more permission."}</span>
                </div>
                {!g?.canRead && <button type="button" className="btn google small" disabled={busy} onClick={() => connectGoogle(undefined, true)}><GoogleCalendarIcon />{g ? "Show my events" : "Connect and show"}</button>}
                {g?.canRead && !g.showEvents && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setReading({ show: true }))}>Show my events</button>}
                {g?.showEvents && <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setReading({ show: false }))}>Hide</button>}
              </div>
              {g?.showEvents && <Choice provider="google" onError={setErr} />}
            </>
          )}
          {!GOOGLE_AS_REVIEWED && g?.status === "connected" && !asking && (
            <>
              <div className="cal-switches">
                <label>
                  <input type="checkbox" checked={g.showEvents} disabled={busy}
                    onChange={(e) => { const v = e.target.checked; if (v && !g.canRead) connectGoogle(undefined, true); else void act(() => setReading({ show: v })); }} />
                  Show my events on Plan
                </label>
                {!g.canRead && <span className="muted">Google asks for one more permission</span>}
              </div>
              {g.showEvents && <Choice provider="google" onError={setErr} />}
            </>
          )}
        </Item>

        {/* ---------- Outlook and Apple ---------- */}
        <Account provider="outlook" on={s.outlookOn} acc={s.other?.outlook ?? null} busy={busy} act={act} onError={setErr} />
        <Account provider="apple" on={s.appleOn} acc={s.other?.apple ?? null} busy={busy} act={act} onError={setErr} />

        {/* ---------- calendar link ---------- */}
        <Item icon={<LinkGlyph />} name="Calendar link" status={s.link ? "On" : "For any other calendar app"}
          action={s.link
            ? <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(() => setCalendarLink(false))}>Turn off</button>
            : <button type="button" className="btn ghost small" disabled={busy} onClick={() => act(async () => { await setCalendarLink(true); queueSync(calendarPayload(plan.weeks, plan.athlete.zones)); })}>Create link</button>}>
          {s.link && (
            <div className="cal-link">
              <div className="row">
                <input readOnly value={s.link} aria-label="Calendar link" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className="btn small" onClick={() => copy(s.link!)}>{copied ? "Copied" : "Copy"}</button>
              </div>
              <span className="muted small">Paste it into any calendar app that can subscribe to a calendar. Anyone with the link can see your sessions.</span>
            </div>
          )}
        </Item>
      </ul>
      {err && <p className="small" style={{ color: "var(--danger)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}

/** "Also delete the Velocity training calendar?" before disconnecting. null = Cancel. */
function Ask({ where, busy, onAnswer, extra }: { where: string; busy: boolean; onAnswer: (remove: boolean | null) => void; extra?: string }) {
  return (
    <div className="cal-ask">
      <span>Also delete the Velocity training calendar from {where}?</span>
      <div className="row">
        <button type="button" className="btn danger small" disabled={busy} onClick={() => onAnswer(true)}>Delete it</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => onAnswer(false)}>Keep it</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => onAnswer(null)}>Cancel</button>
      </div>
      {extra && <span className="muted small">{extra}</span>}
    </div>
  );
}

const WHERE: Record<CalProvider, string> = { outlook: "Outlook", apple: "iCloud" };
const AFTER: Record<CalProvider, string> = {
  outlook: "To also remove Velocity's permission at Microsoft: account.microsoft.com, Privacy, Apps and services.",
  apple: "To also cancel the app-specific password: account.apple.com, Sign-In and Security, App-Specific Passwords.",
};

/** One Outlook or Apple account: connect, its two switches, which calendars to show, disconnect. */
function Account({ provider, on, acc, busy, act, onError }: {
  provider: CalProvider; on: boolean; acc: AccountStatus | null; busy: boolean;
  act: (f: () => Promise<unknown>) => Promise<void>; onError: (e: string | null) => void;
}) {
  const name = PROVIDER_NAME[provider];
  const [asking, setAsking] = useState(false);
  const [form, setForm] = useState(false);
  const connect = () => (provider === "outlook" ? connectOutlook() : setForm(true));
  const ok = acc?.status === "connected";
  return (
    <Item icon={<CalendarGlyph />} name={name}
      status={!on ? "Not available yet" : !acc ? (provider === "outlook" ? "Personal, work or school account" : "Not connected") : !ok ? (acc.error ?? "Needs connecting again") : acc.email ?? "Connected"}
      error={!!acc && !ok}
      action={on && !form && (
        !acc ? <button type="button" className="btn small" disabled={busy} onClick={connect}>Connect</button>
          : !ok ? <button type="button" className="btn small" disabled={busy} onClick={connect}>Connect again</button>
          : !asking && <button type="button" className="btn ghost small" disabled={busy} onClick={() => setAsking(true)}>Disconnect</button>
      )}>
      {form && provider === "apple" && <AppleForm onDone={() => setForm(false)} />}
      {asking && acc && <Ask where={WHERE[provider]} busy={busy} extra={AFTER[provider]} onAnswer={(remove) => act(async () => { if (remove !== null) await disconnectCalendar(provider, remove); setAsking(false); })} />}
      {ok && !asking && (
        <>
          <div className="cal-switches">
            <label><input type="checkbox" checked={acc.write} disabled={busy} onChange={(e) => { const v = e.target.checked; void act(() => setReading({ provider, write: v })); }} />Add my training</label>
            <label><input type="checkbox" checked={acc.show} disabled={busy} onChange={(e) => { const v = e.target.checked; void act(() => setReading({ provider, show: v })); }} />Show my events on Plan</label>
          </div>
          {acc.show && <Choice provider={provider} onError={onError} />}
        </>
      )}
    </Item>
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
      <p className="small muted">At <a href="https://account.apple.com" target="_blank" rel="noreferrer">account.apple.com</a>, open Sign-In and Security, then App-Specific Passwords, and make one called Velocity.</p>
      <label><b>Apple ID</b><input type="email" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} placeholder="name@icloud.com" required /></label>
      <label><b>App-specific password</b><PasswordInput autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="abcd-efgh-ijkl-mnop" required /></label>
      <span className="hint">Not your normal Apple ID password. Stored encrypted, used only for your calendars.</span>
      {err && <span className="small" style={{ color: "var(--danger)" }}>{err}</span>}
      <div className="row">
        <button type="submit" className="btn small" disabled={busy || !id || !pw}>{busy ? "Checking with Apple" : "Connect"}</button>
        <button type="button" className="btn ghost small" disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

/** Which of the athlete's calendars in one account show on the Plan page, behind a "Choose calendars" button. */
function Choice({ provider, onError }: { provider: CalProvider | "google"; onError: (e: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<OtherCalendar[] | null>(null);
  const fail = useCallback((e: unknown) => onError(e instanceof Error ? e.message : "Your calendars did not load."), [onError]);
  useEffect(() => {
    if (!open || list) return;
    let live = true;
    otherCalendars(provider).then((l) => { if (live) setList(l); }).catch((e) => { if (live) { setList([]); fail(e); } });
    return () => { live = false; };
  }, [open, list, provider, fail]);
  const toggle = async (id: string) => {
    if (!list) return;
    const next = list.map((c) => (c.id === id ? { ...c, on: !c.on } : c));
    setList(next);
    try { await setReading({ ...(provider === "google" ? {} : { provider }), calendars: next.filter((c) => c.on).map((c) => c.id) }); } catch (e) { onError(e instanceof Error ? e.message : "Did not save."); }
  };
  return (
    <div className="cal-choice-wrap">
      <button type="button" className="link-btn small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Hide calendars" : "Choose calendars"}</button>
      {open && (!list ? <p className="muted small cal-choice">Loading your calendars</p> : list.length > 0 && (
        <div className="cal-choice">
          {list.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={c.on} onChange={() => toggle(c.id)} />
              <i style={{ background: c.color ?? "var(--muted-2, #B9BDC6)" }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
