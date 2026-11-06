// The signed-in athlete's data: profile, race, plan and activities from Supabase, turned into weeks and sessions
// by the website's own plan maths (@shared/data). The last copy is kept on the phone, so the app opens with today's
// session even with no signal (pool, locker room) and refreshes when the network is back.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SPORT_LABEL, buildWeeks, fitsSession, intensityOf, isRaceDay, isTraining, phasesOf, sportOf, statusOf, whyOf, type Activity, type Availability, type Phase, type PlanWeekJson, type Session, type Sport, type Week } from "@shared/data";
import { addDays, fromYmd } from "@shared/format";
import { localize, setUnits } from "@shared/units";
import { createAnalysis } from "@shared/analysis";
import { athleteOf, type Athlete, type Profile, type Race } from "@shared/athlete";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

type Row = Record<string, unknown>;
interface Raw {
  profile: (Partial<Profile> & { name?: string | null; units?: "imperial" | "metric"; timezone?: string; availability?: Availability | null; zones?: Record<string, Record<string, string>> | null }) | null;
  race: (Partial<Race> & { name: string; date: string }) | null;
  plan: PlanWeekJson[];
  activities: Row[];
  body: BodyRow[];
  devices: { provider: string; status: string }[];
  weightKg: number | null;
  state: PlanState;
  fetchedAt: string;
}
/** The athlete's own changes over the plan, shared with the website (plan_state): moves, edits, added sessions. */
export interface Patch { date?: string; start?: string; min?: number; sport?: Sport; intensity?: string; text?: string; deleted?: boolean; locked?: boolean }
interface Added { id: string; date: string; start?: string; min: number; sport: Sport; intensity: string; text: string }
export interface PlanState { patches: Record<string, Patch>; added: Added[] }
export interface BodyRow { date: string; rhr: number | null; hrv: number | null; sleep_h: number | null; sleep_score: number | null; stress?: number | null; vo2?: number | null }
export type Analysis = ReturnType<typeof createAnalysis>;
export interface AthleteData { raw: Raw; weeks: Week[]; phases: Phase[]; activities: Activity[]; athlete: Athlete; an: Analysis }

const KEY = (uid: string) => `velocity.cache.v1.${uid}`;

const toActivity = (r: Row): Activity => ({
  id: String(r.id), date: String(r.date), start: (r.start as string) ?? undefined, sport: r.sport as Activity["sport"], name: String(r.name),
  min: Number(r.min), mi: r.mi != null ? Number(r.mi) : undefined, yd: (r.yd as number) ?? undefined, pace_s: (r.pace_s as number) ?? undefined,
  mph: r.mph != null ? Number(r.mph) : undefined, p100_s: (r.p100_s as number) ?? undefined, hr: (r.hr as number) ?? undefined,
  elev_ft: (r.elev_ft as number) ?? undefined, route: (r.route as [number, number][]) ?? undefined, source: (r.source as Activity["source"]) ?? "manual",
  note: (r.note as string) ?? undefined, exertion: (r.exertion as number) ?? undefined, excluded: Boolean(r.excluded),
});

/** Same steps as the website's plan store: plan weeks, the athlete's changes on top, then each day's sessions paired
 *  with what was done (same sport first, else another training activity of 30 min or more, a swapped session). */
function shape(raw: Raw): AthleteData {
  const units = raw.profile?.units ?? "imperial";
  setUnits(units);
  const activities = raw.activities.map(toActivity).filter((a) => !a.excluded);
  const on = (date: string) => activities.filter((a) => a.date === date);
  const baseWeeks = buildWeeks(raw.plan, [], raw.profile?.availability ?? undefined);
  const st: PlanState = raw.state ?? { patches: {}, added: [] };
  const base: Session[] = [];
  for (const w of baseWeeks) for (const x of w.sessions) {
    const p = st.patches[x.id];
    if (p?.deleted) continue;
    const text = localize(p?.text ?? x.text, units);
    const sport = p?.sport ?? (p?.text ? sportOf(text) : x.sport);
    const intensity = p?.intensity ?? (p?.text ? intensityOf(text) : x.intensity);
    base.push({ ...x, date: p?.date ?? x.date, start: p?.start ?? x.start, min: p?.min ?? x.min, sport, intensity, text, title: SPORT_LABEL[sport], detail: sport === "rest" ? "No session" : `${intensity}, ${p?.min ?? x.min} min`, why: whyOf(text, sport), locked: !!p?.locked });
  }
  for (const a of st.added ?? []) {
    const p = st.patches[a.id];
    if (p?.deleted) continue;
    const sport = p?.sport ?? a.sport, min = p?.min ?? a.min, intensity = p?.intensity ?? a.intensity, text = localize(p?.text ?? a.text, units);
    base.push({ id: a.id, date: p?.date ?? a.date, dayIndex: 0, start: p?.start ?? a.start, min, sport, title: SPORT_LABEL[sport], detail: `${intensity}, ${min} min`, text, intensity, why: whyOf(text, sport), status: "planned", locked: !!p?.locked });
  }
  const weeks: Week[] = baseWeeks.map((w) => {
    const start = fromYmd(w.start);
    const inWeek = base.filter((x) => { const d = fromYmd(x.date); return d >= start && d <= addDays(start, 6); });
    const actualOf = new Map<string, Activity>(), substOf = new Map<string, Activity>();
    for (const date of new Set(inWeek.map((x) => x.date))) {
      const acts = [...on(date)].sort((a, b) => b.min - a.min);
      const ss = inWeek.filter((x) => x.date === date && x.sport !== "rest").sort((a, b) => b.min - a.min);
      const free = new Set(acts.map((a) => a.id));
      for (const x of ss) { const a = acts.find((y) => free.has(y.id) && fitsSession(x.sport, y)); if (a) { actualOf.set(x.id, a); free.delete(a.id); } }
      for (const x of ss) { if (actualOf.has(x.id)) continue; const a = acts.find((y) => free.has(y.id) && isTraining(y) && y.min >= 30); if (a) { substOf.set(x.id, a); free.delete(a.id); } }
    }
    const sessions = inWeek.map((x) => {
      const dayIndex = Math.round((fromYmd(x.date).getTime() - start.getTime()) / 864e5);
      const paired = actualOf.get(x.id), subst = substOf.get(x.id);
      const others = on(x.date).filter((a) => a !== paired && ![...actualOf.values()].includes(a));
      const status = statusOf(x, paired, others);
      return { ...x, dayIndex, status, actual: paired ?? (status === "done" || status === "substituted" ? subst : undefined) };
    }).sort((a, b) => a.dayIndex - b.dayIndex || (a.start ?? "").localeCompare(b.start ?? ""));
    return { ...w, sessions, plannedMin: sessions.reduce((n, x) => n + (x.min || 0), 0) - (w.race ? sessions.filter((x) => isRaceDay(x.text)).reduce((n, x) => n + x.min, 0) : 0) };
  });
  const phases = phasesOf(weeks);
  // the website's athlete record and analysis (scores, volume, body, race projection) on the same data
  const athlete = athleteOf(raw.profile ? ({ created_at: new Date().toISOString(), ...raw.profile } as Profile) : null, (raw.race as Race) ?? null, weeks[0]?.start ?? null);
  const body = (raw.body ?? []).map((b) => ({ date: b.date, rhr: b.rhr ?? undefined, hrv: b.hrv ?? undefined, sleep_h: b.sleep_h != null ? Number(b.sleep_h) : undefined, sleep_score: b.sleep_score ?? undefined, stress: b.stress ?? undefined, vo2: b.vo2 != null ? Number(b.vo2) : undefined }));
  const an = createAnalysis(activities, weeks, { phases, body: body as never, athlete });
  return { raw, activities, weeks, phases, athlete, an };
}

async function fetchRaw(uid: string): Promise<Raw> {
  if (!supabase) throw new Error("Supabase is not set up");
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const since35 = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const [p, r, pl, a, b, i, n, ps] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("races").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("plans").select("weeks").eq("user_id", uid).maybeSingle(),
    supabase.from("activities").select("*").eq("user_id", uid).gte("date", since).order("date"),
    supabase.from("body_metrics").select("date, rhr, hrv, sleep_h, sleep_score, stress, vo2").eq("user_id", uid).gte("date", since35).order("date"),
    supabase.from("integrations").select("provider, status").eq("user_id", uid),
    supabase.from("nutrition_profile").select("weight_kg").eq("user_id", uid).maybeSingle(),
    supabase.from("plan_state").select("patches, added").eq("user_id", uid).maybeSingle(),
  ]);
  const err = p.error ?? r.error ?? pl.error ?? a.error;
  if (err) throw err;
  return {
    profile: p.data, race: r.data, plan: (pl.data?.weeks as PlanWeekJson[]) ?? [], activities: a.data ?? [],
    body: (b.data as BodyRow[]) ?? [], devices: i.data ?? [], weightKg: n.data?.weight_kg != null ? Number(n.data.weight_kg) : null,
    state: { patches: (ps.data?.patches as Record<string, Patch>) ?? {}, added: (ps.data?.added as Added[]) ?? [] },
    fetchedAt: new Date().toISOString(),
  };
}

export type NewActivity = { date: string; start: string; sport: Activity["sport"]; name: string; min: number; mi?: number; yd?: number; hr?: number };
type Ctx = { data: AthleteData | null; loading: boolean; offline: boolean; refresh: () => Promise<void>; moveSession: (id: string, date: string, start: string) => Promise<boolean>; addActivity: (a: NewActivity) => Promise<boolean> };
const AthleteCtx = createContext<Ctx>({ data: null, loading: true, offline: false, refresh: async () => {}, moveSession: async () => false, addActivity: async () => false });

export function AthleteProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const fresh = await fetchRaw(uid);
      setRaw(fresh); setOffline(false);
      AsyncStorage.setItem(KEY(uid), JSON.stringify(fresh)).catch(() => {});
    } catch { setOffline(true); } finally { setLoading(false); }
  }, [uid]);

  useEffect(() => {
    if (!uid) { setRaw(null); return; }
    let live = true;
    AsyncStorage.getItem(KEY(uid)).then((s) => { if (live && s) { setRaw(JSON.parse(s)); setLoading(false); } }).catch(() => {}).finally(() => { if (live) refresh(); });
    return () => { live = false; };
  }, [uid, refresh]);

  /** Moves a session (shown at once, saved to plan_state like the website does; put back if saving fails). */
  const moveSession = useCallback(async (id: string, date: string, start: string) => {
    if (!uid || !raw || !supabase) return false;
    const before = raw;
    const state = raw.state ?? { patches: {}, added: [] };
    const patches = { ...state.patches, [id]: { ...state.patches[id], date, start } };
    const next = { ...raw, state: { ...state, patches } };
    setRaw(next);
    const { error } = await supabase.from("plan_state").upsert({ user_id: uid, patches, added: state.added ?? [], updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { setRaw(before); return false; }
    AsyncStorage.setItem(KEY(uid), JSON.stringify(next)).catch(() => {});
    return true;
  }, [uid, raw]);

  /** Logs an activity by hand (same row as the website's manual log), shown at once and saved to activities. */
  const addActivity = useCallback(async (a: NewActivity) => {
    if (!uid || !raw || !supabase) return false;
    const row = {
      user_id: uid, id: `manual-${Date.now()}`, date: a.date, start: a.start, sport: a.sport, name: a.name, min: a.min,
      mi: a.mi ?? null, yd: a.yd ?? null, hr: a.hr ?? null,
      pace_s: a.sport === "run" && a.mi ? Math.round((a.min * 60) / a.mi) : null,
      mph: a.sport === "bike" && a.mi ? +(a.mi / (a.min / 60)).toFixed(1) : null,
      p100_s: a.sport === "swim" && a.yd ? Math.round((a.min * 60) / (a.yd / 100)) : null,
      source: "manual", excluded: false,
    };
    const before = raw;
    const next = { ...raw, activities: [...raw.activities, row].sort((x, y) => String(x.date).localeCompare(String(y.date))) };
    setRaw(next);
    const { error } = await supabase.from("activities").insert(row);
    if (error) { setRaw(before); return false; }
    AsyncStorage.setItem(KEY(uid), JSON.stringify(next)).catch(() => {});
    return true;
  }, [uid, raw]);

  const data = useMemo(() => (raw ? shape(raw) : null), [raw]);
  return <AthleteCtx.Provider value={{ data, loading, offline, refresh, moveSession, addActivity }}>{children}</AthleteCtx.Provider>;
}

export const useAthlete = () => useContext(AthleteCtx);
