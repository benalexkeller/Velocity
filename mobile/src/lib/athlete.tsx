// The signed-in athlete's data: profile, race, plan and activities from Supabase, turned into weeks and sessions
// by the website's own plan maths (@shared/data). The last copy is kept on the phone, so the app opens with today's
// session even with no signal (pool, locker room) and refreshes when the network is back.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildWeeks, fitsSession, isTraining, phasesOf, type Activity, type Availability, type Phase, type PlanWeekJson, type Week } from "@shared/data";
import { setUnits } from "@shared/units";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

type Row = Record<string, unknown>;
interface Raw {
  profile: { name?: string; units?: "imperial" | "metric"; timezone?: string; availability?: Availability; zones?: Record<string, Record<string, string>> | null } | null;
  race: { name: string; date: string; distance?: string; goal?: string } | null;
  plan: PlanWeekJson[];
  activities: Row[];
  body: BodyRow[];
  devices: { provider: string; status: string }[];
  weightKg: number | null;
  fetchedAt: string;
}
export interface BodyRow { date: string; rhr: number | null; hrv: number | null; sleep_h: number | null; sleep_score: number | null }
export interface AthleteData { raw: Raw; weeks: Week[]; phases: Phase[]; activities: Activity[] }

const KEY = (uid: string) => `velocity.cache.v1.${uid}`;

const toActivity = (r: Row): Activity => ({
  id: String(r.id), date: String(r.date), start: (r.start as string) ?? undefined, sport: r.sport as Activity["sport"], name: String(r.name),
  min: Number(r.min), mi: r.mi != null ? Number(r.mi) : undefined, yd: (r.yd as number) ?? undefined, pace_s: (r.pace_s as number) ?? undefined,
  mph: r.mph != null ? Number(r.mph) : undefined, p100_s: (r.p100_s as number) ?? undefined, hr: (r.hr as number) ?? undefined,
  elev_ft: (r.elev_ft as number) ?? undefined, route: (r.route as [number, number][]) ?? undefined, source: (r.source as Activity["source"]) ?? "manual",
  note: (r.note as string) ?? undefined, exertion: (r.exertion as number) ?? undefined, excluded: Boolean(r.excluded),
});

function shape(raw: Raw): AthleteData {
  setUnits(raw.profile?.units ?? "imperial");
  const activities = raw.activities.map(toActivity).filter((a) => !a.excluded);
  const weeks = buildWeeks(raw.plan, activities, raw.profile?.availability ?? undefined);
  // pair each session with what was done that day, as the website does: the same sport first,
  // else another training activity of 30 min or more (a swapped session)
  const used = new Set<string>();
  for (const w of weeks) for (const x of w.sessions) {
    if (x.sport === "rest") continue;
    const day = activities.filter((a) => a.date === x.date && !used.has(a.id));
    const a = day.find((a) => fitsSession(x.sport, a)) ?? (x.status === "done" || x.status === "substituted" ? day.find((a) => isTraining(a) && a.min >= 30) : undefined);
    if (a) { x.actual = a; used.add(a.id); }
  }
  return { raw, activities, weeks, phases: phasesOf(weeks) };
}

async function fetchRaw(uid: string): Promise<Raw> {
  if (!supabase) throw new Error("Supabase is not set up");
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const since35 = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
  const [p, r, pl, a, b, i, n] = await Promise.all([
    supabase.from("profiles").select("name, units, timezone, availability, zones").eq("id", uid).maybeSingle(),
    supabase.from("races").select("name, date, distance, goal").eq("user_id", uid).maybeSingle(),
    supabase.from("plans").select("weeks").eq("user_id", uid).maybeSingle(),
    supabase.from("activities").select("*").eq("user_id", uid).gte("date", since).order("date"),
    supabase.from("body_metrics").select("date, rhr, hrv, sleep_h, sleep_score").eq("user_id", uid).gte("date", since35).order("date"),
    supabase.from("integrations").select("provider, status").eq("user_id", uid),
    supabase.from("nutrition_profile").select("weight_kg").eq("user_id", uid).maybeSingle(),
  ]);
  const err = p.error ?? r.error ?? pl.error ?? a.error;
  if (err) throw err;
  return {
    profile: p.data, race: r.data, plan: (pl.data?.weeks as PlanWeekJson[]) ?? [], activities: a.data ?? [],
    body: (b.data as BodyRow[]) ?? [], devices: i.data ?? [], weightKg: n.data?.weight_kg != null ? Number(n.data.weight_kg) : null,
    fetchedAt: new Date().toISOString(),
  };
}

type Ctx = { data: AthleteData | null; loading: boolean; offline: boolean; refresh: () => Promise<void> };
const AthleteCtx = createContext<Ctx>({ data: null, loading: true, offline: false, refresh: async () => {} });

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

  const data = useMemo(() => (raw ? shape(raw) : null), [raw]);
  return <AthleteCtx.Provider value={{ data, loading, offline, refresh }}>{children}</AthleteCtx.Provider>;
}

export const useAthlete = () => useContext(AthleteCtx);
