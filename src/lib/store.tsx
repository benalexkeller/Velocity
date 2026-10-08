"use client";
// The athlete's data, live in the app. Loads once from the backend (browser or account), keeps the
// working copy in memory, writes every change straight back. Everything the pages read comes from here.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ACTIVITIES as SEED_ACTIVITIES, PLAN_SEED, SPORT_LABEL, buildWeeks, intensityOf, isRaceDay, phasesOf, sportOf, sumH, virtualWeeks, whyOf, type Activity, type Phase, type PlanWeekJson, type Session, type Sport, type Week } from "./data";
import { BODY_SEED, type BodyDay } from "./analysis";
import { athleteOf, type Athlete, type Profile, type Race } from "./athlete";
import type { Intake } from "./plan/intake";
import type { Availability } from "./data";
import { EMPTY_DATA, makeBackend, readLocal, type AddedSession, type Backend, type PlanStateJson, type SessionPatch, type ThreadMsg, type UserData } from "./backend";
import { ACCOUNTS_ON } from "./supabase/env";
import { addDays, fromYmd, today, ymd } from "./format";

export type { AddedSession, SessionPatch, ThreadMsg } from "./backend";
export interface ManualActivity { id: string; name: string; sport: Sport; date: string; start: string; min: number; mi?: number; yd?: number; pace_s?: number; mph?: number; p100_s?: number; hr?: number; elev_ft?: number; exertion?: number; feel?: string; note?: string; source: "manual" }

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

// ---------- derive weeks + activities from the athlete's records ----------
function derive(data: UserData, athlete: Athlete) {
  const activities = [...data.activities].sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
  const counted = activities.filter((a) => !a.excluded);
  const on = (date: string) => counted.filter((a) => a.date === date);
  const t = today();
  const baseWeeks = data.plan.length ? buildWeeks(data.plan, [], athlete.availability) : virtualWeeks();
  const st = data.state;
  const base: Session[] = [];
  for (const w of baseWeeks) for (const s of w.sessions) {
    const p = st.patches[s.id];
    if (p?.deleted) continue;
    const text = p?.text ?? s.text;
    const sport = p?.sport ?? (p?.text ? sportOf(text) : s.sport);
    const intensity = p?.intensity ?? (p?.text ? intensityOf(text) : s.intensity);
    base.push({ ...s, date: p?.date ?? s.date, start: p?.start ?? s.start, min: p?.min ?? s.min, sport, intensity, text, title: SPORT_LABEL[sport], detail: sport === "rest" ? "No session" : `${intensity} · ${p?.min ?? s.min} min`, why: whyOf(text, sport), locked: !!p?.locked });
  }
  for (const a of st.added) {
    // sessions added by hand take the same patches (move, edit, lock) as plan sessions
    const p = st.patches[a.id];
    if (p?.deleted) continue;
    const sport = p?.sport ?? a.sport, min = p?.min ?? a.min, intensity = p?.intensity ?? a.intensity, text = p?.text ?? a.text;
    base.push({ id: a.id, date: p?.date ?? a.date, dayIndex: 0, start: p?.start ?? a.start, min, sport, title: SPORT_LABEL[sport], detail: `${intensity} · ${min} min`, text, intensity, why: whyOf(text, sport), status: "planned", locked: !!p?.locked });
  }
  const weeks: Week[] = baseWeeks.map((w) => {
    const start = fromYmd(w.start);
    const inWeek = base.filter((s) => { const d = fromYmd(s.date); return d >= start && d <= addDays(start, 6); });
    // pair each day's sessions with what was logged: same sport first (brick = bike or run), then whatever is left, longest first
    const actualOf = new Map<string, Activity>();
    for (const date of new Set(inWeek.map((s) => s.date))) {
      const acts = [...on(date)].sort((a, b) => b.min - a.min);
      const ss = inWeek.filter((s) => s.date === date && s.sport !== "rest");
      const free = new Set(acts.map((a) => a.id));
      const fits = (s: Session, a: Activity) => a.sport === s.sport || (s.sport === "brick" && (a.sport === "bike" || a.sport === "run"));
      for (const s of ss) { const a = acts.find((x) => free.has(x.id) && fits(s, x)); if (a) { actualOf.set(s.id, a); free.delete(a.id); } }
      for (const s of ss) { if (actualOf.has(s.id)) continue; const a = acts.find((x) => free.has(x.id)); if (a) { actualOf.set(s.id, a); free.delete(a.id); } }
    }
    const sessions = inWeek.map((s) => {
      const d = fromYmd(s.date);
      const dayIndex = Math.round((d.getTime() - start.getTime()) / 86400000);
      const acts = on(s.date);
      const isPast = d < t;
      const status: Session["status"] = acts.length ? "done" : s.sport === "rest" ? (isPast ? "done" : "planned") : isPast ? "missed" : "planned";
      return { ...s, dayIndex, status, actual: actualOf.get(s.id) };
    }).sort((a, b) => a.dayIndex - b.dayIndex || (a.start ?? "").localeCompare(b.start ?? ""));
    return { ...w, sessions, plannedMin: sessions.reduce((x, s) => x + (s.min || 0), 0) - (w.race ? sessions.filter((s) => isRaceDay(s.text)).reduce((x, s) => x + s.min, 0) : 0) };
  });
  return { activities, counted, weeks, activitiesOn: on, phases: phasesOf(weeks) };
}

export interface PlanStore {
  ready: boolean;
  accounts: boolean;
  athlete: Athlete;
  profile: Profile | null;
  race: Race | null;
  hasPlan: boolean;
  planJson: PlanWeekJson[];
  intake: Intake | null;
  /** Save a race + availability + a generated plan in one go (the plan builder). Resets moves/edits/locks. */
  buildPlan: (intake: Intake, weeks: PlanWeekJson[], race: Race, availability: Availability) => Promise<void>;
  /** Replace the plan with weeks from a file; keeps the intake, resets moves/edits/locks. */
  replacePlan: (weeks: PlanWeekJson[]) => Promise<void>;
  body: BodyDay[];
  weeks: Week[];
  phases: Phase[];
  activities: Activity[]; // everything still in the list, including excluded
  counted: Activity[]; // what analysis, volume and session status use
  activitiesOn: (date: string) => Activity[];
  /** First and last day of the plan (yyyy-mm-dd); sessions cannot be moved or added outside it. */
  planRange: { start: string; end: string } | null;
  weekOf: (d: Date) => Week | undefined;
  currentWeek: () => Week;
  weekByNumber: (n: number) => Week;
  weekStatus: (w: Week) => { done: number; total: number; actualH: number; plannedH: number; bySport: { swim: number; bike: number; run: number; other: number } };
  sessionOn: (date: string) => Session | undefined;
  findSession: (id: string | null) => { s: Session; w: Week } | null;
  moveSession: (id: string, to: { date: string; start?: string }) => void;
  editSession: (id: string, patch: SessionPatch) => void;
  toggleLock: (id: string) => void;
  deleteSession: (id: string) => void;
  addSession: (s: Omit<AddedSession, "id">) => string;
  logActivity: (a: ManualActivity) => void;
  deleteActivity: (id: string) => void;
  toggleExcluded: (id: string) => void;
  post: (text: string) => void;
  thread: ThreadMsg[];
  undone: boolean;
  undoPlanUpdate: () => void;
  calendar: boolean;
  toggleCalendar: () => void;
  changes: number;
  reset: () => void;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  saveRace: (r: Race | null) => Promise<void>;
  savePlan: (weeks: PlanWeekJson[]) => Promise<void>;
  importSeed: () => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<PlanStore | null>(null);
const PUBLIC = (p: string) => p === "/login" || p.startsWith("/auth");

export function PlanProvider({ children }: { children: ReactNode }) {
  const backend = useRef<Backend | null>(null);
  if (!backend.current) backend.current = makeBackend();
  const be = backend.current;
  const path = usePathname();
  const router = useRouter();
  const [data, setData] = useState<UserData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => { try { setData(await be.load()); } catch (e) { console.error("[velocity] load", e); } setReady(true); }, [be]);
  useEffect(() => { if (ACCOUNTS_ON && PUBLIC(path)) { setReady(true); return; } void reload(); }, [reload, path === "/login"]); // eslint-disable-line react-hooks/exhaustive-deps

  // first sign-in: finish the profile before anything else
  useEffect(() => {
    if (!ACCOUNTS_ON || !ready || PUBLIC(path)) return;
    if (data.profile && !data.profile.setup_done && path !== "/setup") router.replace("/setup");
  }, [ready, data.profile, path, router]);

  const athlete = useMemo(() => athleteOf(data.profile, data.race, data.plan[0]?.start ?? null, data.availability), [data.profile, data.race, data.plan, data.availability]);
  const d = useMemo(() => derive(data, athlete), [data, athlete]);

  // every write: update the working copy first (instant), then the backend
  const setState = useCallback((f: (s: PlanStateJson) => PlanStateJson) => setData((cur) => { const state = f(cur.state); void be.saveState(state); return { ...cur, state }; }), [be]);

  const store = useMemo<PlanStore>(() => {
    const weekOf = (x: Date) => d.weeks.find((w) => { const s = fromYmd(w.start); return x >= s && x <= addDays(s, 6); });
    const currentWeek = () => weekOf(today()) ?? d.weeks[Math.min(d.weeks.length - 1, Math.max(0, d.weeks.findIndex((w) => fromYmd(w.start) > today()) - 1))] ?? d.weeks[0];
    const weekByNumber = (n: number) => d.weeks[Math.min(Math.max(n, 1), d.weeks.length) - 1];
    const weekStatus = (w: Week) => {
      const sessions = w.sessions.filter((s) => s.sport !== "rest");
      const by = { swim: 0, bike: 0, run: 0, other: 0 };
      for (let i = 0; i < 7; i++) for (const a of d.activitiesOn(ymd(addDays(fromYmd(w.start), i)))) { const h = a.min / 60; if (a.sport === "swim" || a.sport === "bike" || a.sport === "run") by[a.sport] += h; else by.other += h; }
      return { done: sessions.filter((s) => s.status === "done").length, total: sessions.length, actualH: sumH(by), plannedH: w.plannedMin / 60, bySport: by };
    };
    const sessionOn = (date: string) => { const w = weekOf(fromYmd(date)); return w?.sessions.find((s) => s.date === date); };
    const findSession = (id: string | null) => { if (!id) return null; for (const w of d.weeks) { const s = w.sessions.find((x) => x.id === id); if (s) return { s, w }; } return null; };
    const st = data.state;
    const changes = Object.keys(st.patches).length + st.added.length + data.activities.filter((a) => a.source === "manual").length;
    const planRange = d.weeks.length ? { start: d.weeks[0].start, end: ymd(addDays(fromYmd(d.weeks[d.weeks.length - 1].start), 6)) } : null;
    const inPlan = (date: string) => !planRange || (date >= planRange.start && date <= planRange.end);
    const toActivity = (m: ManualActivity): Activity => ({ id: m.id, date: m.date, start: m.start, sport: m.sport, name: m.name, min: m.min, mi: m.mi, yd: m.yd, pace_s: m.pace_s, mph: m.mph, p100_s: m.p100_s, hr: m.hr, elev_ft: m.elev_ft, source: "manual", note: m.note, exertion: m.exertion });
    return {
      ready, accounts: ACCOUNTS_ON, athlete, profile: data.profile, race: data.race, hasPlan: data.plan.length > 0, planJson: data.plan, body: data.body, intake: data.intake,
      buildPlan: async (intake, weeks, race, availability) => {
        const state: PlanStateJson = { ...data.state, patches: {}, added: [], undone: false };
        await be.saveRace(race);
        await be.saveProfile({ availability });
        await be.savePlan(weeks, intake);
        await be.saveState(state);
        setData((cur) => ({ ...cur, race, plan: weeks, intake, state, availability, profile: cur.profile ? { ...cur.profile, availability } : cur.profile }));
      },
      replacePlan: async (weeks) => {
        const state: PlanStateJson = { ...data.state, patches: {}, added: [], undone: false };
        await be.savePlan(weeks);
        await be.saveState(state);
        setData((cur) => ({ ...cur, plan: weeks, state }));
      },
      weeks: d.weeks, phases: d.phases, activities: d.activities, counted: d.counted, activitiesOn: d.activitiesOn, planRange, weekOf, currentWeek, weekByNumber, weekStatus, sessionOn, findSession,
      moveSession: (id, to) => { if (!inPlan(to.date)) return; setState((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], date: to.date, ...(to.start ? { start: to.start } : {}) } } })); },
      editSession: (id, patch) => setState((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } } })),
      toggleLock: (id) => setState((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], locked: !s.patches[id]?.locked } } })),
      deleteSession: (id) => setState((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], deleted: true } }, added: s.added.filter((a) => a.id !== id) })),
      addSession: (a) => { if (!inPlan(a.date)) return ""; const id = `add-${Date.now()}`; setState((s) => ({ ...s, added: [...s.added, { ...a, id }] })); return id; },
      logActivity: (m) => { const a = toActivity(m); setData((cur) => ({ ...cur, activities: [...cur.activities.filter((x) => x.id !== a.id), a] })); void be.upsertActivity(a); },
      deleteActivity: (id) => { setData((cur) => ({ ...cur, activities: cur.activities.filter((x) => x.id !== id) })); void be.deleteActivity(id); },
      toggleExcluded: (id) => { const cur = data.activities.find((a) => a.id === id); if (!cur) return; const excluded = !cur.excluded; setData((c) => ({ ...c, activities: c.activities.map((a) => (a.id === id ? { ...a, excluded: excluded || undefined } : a)) })); void be.setExcluded(id, excluded); },
      post: (text) => { const msgs: ThreadMsg[] = [{ who: "You", at: nowHM(), text }, { who: "Coach", at: nowHM(), text: coachReply(text, d, athlete) }]; setData((cur) => ({ ...cur, thread: [...cur.thread, ...msgs] })); void be.appendThread(msgs); },
      thread: data.thread, undone: st.undone,
      undoPlanUpdate: () => setState((s) => ({ ...s, undone: !s.undone })),
      calendar: st.calendar, toggleCalendar: () => setState((s) => ({ ...s, calendar: !s.calendar })),
      changes,
      reset: () => { void be.reset().then(reload); },
      saveProfile: async (p) => { await be.saveProfile(p); setData((cur) => ({ ...cur, profile: cur.profile ? { ...cur.profile, ...p } : cur.profile })); },
      saveRace: async (r) => { await be.saveRace(r); setData((cur) => ({ ...cur, race: r })); },
      savePlan: async (weeks) => { await be.savePlan(weeks); setData((cur) => ({ ...cur, plan: weeks })); },
      importSeed: async () => {
        // PR's data: the seed plan, Garmin activities and body data, plus whatever this browser saved in local mode
        const local = readLocal();
        const hidden = new Set(local.hidden), excluded = new Set(local.excluded);
        const acts = [...SEED_ACTIVITIES, ...local.manual].filter((a) => !hidden.has(a.id)).map((a) => ({ ...a, excluded: excluded.has(a.id) || undefined }));
        await be.savePlan(PLAN_SEED);
        await be.replaceActivities(acts);
        await be.saveBody(BODY_SEED);
        await be.saveState({ patches: local.patches, added: local.added, undone: local.undone, calendar: local.calendar });
        if (local.thread.length) await be.appendThread(local.thread);
        await reload();
      },
      signOut: async () => { await be.signOut(); router.replace("/login"); },
      reload,
    };
  }, [d, data, ready, athlete, be, setState, reload, router]);

  return <Ctx.Provider value={store}>{ACCOUNTS_ON && !ready ? <div className="app-loading" aria-busy="true" /> : children}</Ctx.Provider>;
}

export function usePlan(): PlanStore {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlan outside PlanProvider");
  return c;
}

// The coach service (Claude API) is not connected yet. Until it is, answer from the data for the
// questions the data can answer, and say plainly when it cannot.
function coachReply(text: string, d: ReturnType<typeof derive>, athlete: Athlete): string {
  const q = text.toLowerCase();
  const t = today();
  const wk = d.weeks.find((w) => { const s = fromYmd(w.start); return t >= s && t <= addDays(s, 6); }) ?? d.weeks[0];
  if (!wk) return "No plan yet. Add workouts in the Plan tab; the coach service that builds plans isn't connected yet.";
  const done = wk.sessions.filter((s) => s.sport !== "rest" && s.status === "done").length, total = wk.sessions.filter((s) => s.sport !== "rest").length;
  const todayS = wk.sessions.find((s) => s.date === ymd(t));
  const tomorrow = ymd(addDays(t, 1));
  const tom = d.weeks.flatMap((w) => w.sessions).find((s) => s.date === tomorrow);
  const say = (s: Session) => (s.sport === "rest" ? "rest day. " + s.text : `${s.title} · ${s.intensity} · ${s.min} min${s.start ? ` at ${s.start}` : ""}. ${s.text}`);
  if (/today/.test(q)) return todayS ? `Today: ${say(todayS)}` : "Nothing planned today.";
  if (/tomorrow/.test(q)) return tom ? `Tomorrow: ${say(tom)}` : "Nothing planned tomorrow.";
  if (/this week|week/.test(q)) return `Week ${wk.week}${wk.phaseShort !== "No plan" ? ` (${wk.phaseShort})` : ""}: ${done} of ${total} sessions done, ${(wk.plannedMin / 60).toFixed(1)} h planned.${wk.focus ? ` Focus: ${wk.focus}.` : ""}`;
  if (/move|swap|change|reschedule/.test(q)) return "To move or edit a session, open it in the Plan calendar and use Move or Edit. The coach's own plan changes come with the Sunday review once the coach service is connected.";
  if (/race|goal/.test(q)) return athlete.hasRace ? `Race: ${athlete.race.name}, ${athlete.race.date}${athlete.race.goal ? `, goal ${athlete.race.goal}` : ""}. Projection and readiness are on the Analysis tab.` : "No race set yet. Add it under Profile.";
  return "The coach service isn't connected yet, so this message is saved but not answered. Questions about today, tomorrow, this week, moving sessions, or the race get a data answer now.";
}
