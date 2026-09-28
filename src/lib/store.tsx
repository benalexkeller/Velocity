"use client";
// Local plan store. Until accounts + database exist, every change the athlete makes
// (move / edit / add / delete a session, log an activity, coach messages) lives in this
// browser's storage and is layered on top of the seed plan. Same shapes as the database will use.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACTIVITIES, SPORT_LABEL, WEEKS, intensityOf, sportOf, sumH, whyOf, type Activity, type Session, type Sport, type Week } from "./data";
import { addDays, fromYmd, today, ymd } from "./format";

export interface SessionPatch { date?: string; start?: string; min?: number; intensity?: string; text?: string; sport?: Sport; deleted?: boolean }
export interface AddedSession { id: string; date: string; start?: string; min: number; sport: Sport; intensity: string; text: string }
export interface ManualActivity { id: string; name: string; sport: Sport; date: string; start: string; min: number; mi?: number; yd?: number; pace_s?: number; mph?: number; p100_s?: number; elev_ft?: number; exertion?: number; feel?: string; note?: string; source: "manual" }
export interface ThreadMsg { who: "You" | "Coach" | "action"; at: string; text: string }
interface State { patches: Record<string, SessionPatch>; added: AddedSession[]; manual: ManualActivity[]; hidden: string[]; excluded: string[]; thread: ThreadMsg[]; undone: boolean; calendar: boolean }

const KEY = "velocity.store.v1";
const EMPTY: State = { patches: {}, added: [], manual: [], hidden: [], excluded: [], thread: [], undone: false, calendar: true };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    const s: State = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
    // pick up activities saved by the dashboard form before this store existed
    const legacy = JSON.parse(localStorage.getItem("velocity.manualActivities") || "[]") as ManualActivity[];
    for (const a of legacy) if (!s.manual.some((m) => m.id === a.id)) s.manual.push(a);
    return s;
  } catch { return { ...EMPTY }; }
}
function save(s: State) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

// ---------- derive plan + activities from seed + local changes ----------
function toActivity(m: ManualActivity): Activity {
  return { id: m.id, date: m.date, start: m.start, sport: m.sport, name: m.name, min: m.min, mi: m.mi, yd: m.yd, pace_s: m.pace_s, mph: m.mph, p100_s: m.p100_s, elev_ft: m.elev_ft, source: "manual", note: m.note, exertion: m.exertion };
}
function derive(state: State) {
  // deleted activities are gone everywhere; excluded ones stay in the list but count nowhere
  const hidden = new Set(state.hidden), excluded = new Set(state.excluded);
  const activities = [...ACTIVITIES, ...state.manual.map(toActivity)].filter((a) => !hidden.has(a.id)).map((a) => (excluded.has(a.id) ? { ...a, excluded: true } : a)).sort((a, b) => (a.date + (a.start ?? "")).localeCompare(b.date + (b.start ?? "")));
  const counted = activities.filter((a) => !a.excluded);
  const on = (date: string) => counted.filter((a) => a.date === date);
  const t = today();
  // all base sessions with patches applied, plus added ones
  const base: Session[] = [];
  for (const w of WEEKS) for (const s of w.sessions) {
    const p = state.patches[s.id];
    if (p?.deleted) continue;
    const text = p?.text ?? s.text;
    const sport = p?.sport ?? (p?.text ? sportOf(text) : s.sport);
    const intensity = p?.intensity ?? (p?.text ? intensityOf(text) : s.intensity);
    base.push({ ...s, date: p?.date ?? s.date, start: p?.start ?? s.start, min: p?.min ?? s.min, sport, intensity, text, title: SPORT_LABEL[sport], detail: sport === "rest" ? "No session" : `${intensity} · ${p?.min ?? s.min} min`, why: whyOf(text, sport) });
  }
  for (const a of state.added) base.push({ id: a.id, date: a.date, dayIndex: 0, start: a.start, min: a.min, sport: a.sport, title: SPORT_LABEL[a.sport], detail: `${a.intensity} · ${a.min} min`, text: a.text, intensity: a.intensity, why: whyOf(a.text, a.sport), status: "planned" });
  const weeks: Week[] = WEEKS.map((w) => {
    const start = fromYmd(w.start);
    const sessions = base.filter((s) => { const d = fromYmd(s.date); return d >= start && d <= addDays(start, 6); }).map((s) => {
      const d = fromYmd(s.date);
      const dayIndex = Math.round((d.getTime() - start.getTime()) / 86400000);
      const acts = on(s.date);
      const isPast = d < t;
      const status: Session["status"] = acts.length ? "done" : s.sport === "rest" ? (isPast ? "done" : "planned") : isPast ? "missed" : "planned";
      return { ...s, dayIndex, status };
    }).sort((a, b) => a.dayIndex - b.dayIndex || (a.start ?? "").localeCompare(b.start ?? ""));
    return { ...w, sessions, plannedMin: sessions.reduce((x, s) => x + (s.min || 0), 0) - (w.race ? 780 : 0) };
  });
  return { activities, counted, weeks, activitiesOn: on };
}

export interface PlanStore {
  ready: boolean;
  weeks: Week[];
  activities: Activity[]; // everything still in the list, including excluded
  counted: Activity[]; // what analysis, volume and session status use
  activitiesOn: (date: string) => Activity[];
  weekOf: (d: Date) => Week | undefined;
  currentWeek: () => Week;
  weekByNumber: (n: number) => Week;
  weekStatus: (w: Week) => { done: number; total: number; actualH: number; plannedH: number; bySport: { swim: number; bike: number; run: number; other: number } };
  sessionOn: (date: string) => Session | undefined;
  findSession: (id: string | null) => { s: Session; w: Week } | null;
  moveSession: (id: string, to: { date: string; start?: string }) => void;
  editSession: (id: string, patch: SessionPatch) => void;
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
}

const Ctx = createContext<PlanStore | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => { setState(load()); setReady(true); }, []);
  const update = useCallback((f: (s: State) => State) => setState((s) => { const n = f(s); save(n); return n; }), []);

  const d = useMemo(() => derive(state), [state]);
  const store = useMemo<PlanStore>(() => {
    const weekOf = (x: Date) => d.weeks.find((w) => { const s = fromYmd(w.start); return x >= s && x <= addDays(s, 6); });
    const currentWeek = () => weekOf(today()) ?? d.weeks[0];
    const weekByNumber = (n: number) => d.weeks[Math.min(Math.max(n, 1), d.weeks.length) - 1];
    const weekStatus = (w: Week) => {
      const sessions = w.sessions.filter((s) => s.sport !== "rest");
      const by = { swim: 0, bike: 0, run: 0, other: 0 };
      for (let i = 0; i < 7; i++) for (const a of d.activitiesOn(ymd(addDays(fromYmd(w.start), i)))) { const h = a.min / 60; if (a.sport === "swim" || a.sport === "bike" || a.sport === "run") by[a.sport] += h; else by.other += h; }
      return { done: sessions.filter((s) => s.status === "done").length, total: sessions.length, actualH: sumH(by), plannedH: w.plannedMin / 60, bySport: by };
    };
    const sessionOn = (date: string) => { const w = weekOf(fromYmd(date)); return w?.sessions.find((s) => s.date === date); };
    const findSession = (id: string | null) => { if (!id) return null; for (const w of d.weeks) { const s = w.sessions.find((x) => x.id === id); if (s) return { s, w }; } return null; };
    const changes = Object.keys(state.patches).length + state.added.length + state.manual.length + state.hidden.length + state.excluded.length;
    return {
      ready, weeks: d.weeks, activities: d.activities, counted: d.counted, activitiesOn: d.activitiesOn, weekOf, currentWeek, weekByNumber, weekStatus, sessionOn, findSession,
      moveSession: (id, to) => update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], date: to.date, ...(to.start ? { start: to.start } : {}) } } })),
      editSession: (id, patch) => update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], ...patch } } })),
      deleteSession: (id) => update((s) => ({ ...s, patches: { ...s.patches, [id]: { ...s.patches[id], deleted: true } }, added: s.added.filter((a) => a.id !== id) })),
      addSession: (a) => { const id = `add-${Date.now()}`; update((s) => ({ ...s, added: [...s.added, { ...a, id }] })); return id; },
      logActivity: (a) => update((s) => ({ ...s, manual: [...s.manual.filter((m) => m.id !== a.id), a] })),
      deleteActivity: (id) => update((s) => ({ ...s, manual: s.manual.filter((m) => m.id !== id), hidden: s.manual.some((m) => m.id === id) || s.hidden.includes(id) ? s.hidden : [...s.hidden, id], excluded: s.excluded.filter((x) => x !== id) })),
      toggleExcluded: (id) => update((s) => ({ ...s, excluded: s.excluded.includes(id) ? s.excluded.filter((x) => x !== id) : [...s.excluded, id] })),
      post: (text) => update((s) => ({ ...s, thread: [...s.thread, { who: "You", at: nowHM(), text }, { who: "Coach", at: nowHM(), text: coachReply(text, d) }] })),
      thread: state.thread, undone: state.undone,
      undoPlanUpdate: () => update((s) => ({ ...s, undone: !s.undone })),
      calendar: state.calendar, toggleCalendar: () => update((s) => ({ ...s, calendar: !s.calendar })),
      changes,
      reset: () => update(() => ({ ...EMPTY })),
    };
  }, [d, state, ready, update]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function usePlan(): PlanStore {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlan outside PlanProvider");
  return c;
}

// The coach service (Claude API) is not connected yet. Until it is, answer from the data for the
// questions the data can answer, and say plainly when it cannot.
function coachReply(text: string, d: ReturnType<typeof derive>): string {
  const q = text.toLowerCase();
  const t = today();
  const wk = d.weeks.find((w) => { const s = fromYmd(w.start); return t >= s && t <= addDays(s, 6); }) ?? d.weeks[0];
  const done = wk.sessions.filter((s) => s.sport !== "rest" && s.status === "done").length, total = wk.sessions.filter((s) => s.sport !== "rest").length;
  const todayS = wk.sessions.find((s) => s.date === ymd(t));
  const tomorrow = ymd(addDays(t, 1));
  const tom = d.weeks.flatMap((w) => w.sessions).find((s) => s.date === tomorrow);
  const say = (s: Session) => (s.sport === "rest" ? "rest day. " + s.text : `${s.title} · ${s.intensity} · ${s.min} min${s.start ? ` at ${s.start}` : ""}. ${s.text}`);
  if (/today/.test(q)) return todayS ? `Today: ${say(todayS)}` : "Nothing planned today.";
  if (/tomorrow/.test(q)) return tom ? `Tomorrow: ${say(tom)}` : "Nothing planned tomorrow.";
  if (/this week|week/.test(q)) return `Week ${wk.week} (${wk.phaseShort}): ${done} of ${total} sessions done, ${(wk.plannedMin / 60).toFixed(1)} h planned. Focus: ${wk.focus}.`;
  if (/move|swap|change|reschedule/.test(q)) return "To move or edit a session, open it in the Plan calendar and use Move or Edit — changes save on this device. The coach's own plan changes come with the Sunday review once the coach service is connected.";
  if (/race|texas|goal/.test(q)) return "Race: IRONMAN Texas, Sat 24 Apr 2027, goal sub-13. Projection and readiness are on the Analysis tab.";
  return "The coach service isn't connected yet, so this message is saved but not answered. Questions about today, tomorrow, this week, moving sessions, or the race get a data answer now.";
}
