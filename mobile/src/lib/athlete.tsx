// The signed-in athlete's data: profile, race, plan and activities from Supabase, turned into weeks and sessions
// by the website's own plan maths (@shared/data). The last copy is kept on the phone, so the app opens with today's
// session even with no signal (pool, locker room) and refreshes when the network is back.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildWeeks, type Activity, type Availability, type PlanWeekJson, type Week } from "@shared/data";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

type Row = Record<string, unknown>;
interface Raw {
  profile: { name?: string; units?: "imperial" | "metric"; timezone?: string; availability?: Availability } | null;
  race: { name: string; date: string; distance?: string; goal?: string } | null;
  plan: PlanWeekJson[];
  activities: Row[];
  fetchedAt: string;
}
export interface AthleteData { raw: Raw; weeks: Week[]; activities: Activity[] }

const KEY = (uid: string) => `velocity.cache.v1.${uid}`;

const toActivity = (r: Row): Activity => ({
  id: String(r.id), date: String(r.date), start: (r.start as string) ?? undefined, sport: r.sport as Activity["sport"], name: String(r.name),
  min: Number(r.min), mi: r.mi != null ? Number(r.mi) : undefined, yd: (r.yd as number) ?? undefined, pace_s: (r.pace_s as number) ?? undefined,
  mph: r.mph != null ? Number(r.mph) : undefined, p100_s: (r.p100_s as number) ?? undefined, hr: (r.hr as number) ?? undefined,
  elev_ft: (r.elev_ft as number) ?? undefined, route: (r.route as [number, number][]) ?? undefined, source: (r.source as Activity["source"]) ?? "manual",
  note: (r.note as string) ?? undefined, exertion: (r.exertion as number) ?? undefined, excluded: Boolean(r.excluded),
});

function shape(raw: Raw): AthleteData {
  const activities = raw.activities.map(toActivity).filter((a) => !a.excluded);
  return { raw, activities, weeks: buildWeeks(raw.plan, activities, raw.profile?.availability ?? undefined) };
}

async function fetchRaw(uid: string): Promise<Raw> {
  if (!supabase) throw new Error("Supabase is not set up");
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const [p, r, pl, a] = await Promise.all([
    supabase.from("profiles").select("name, units, timezone, availability").eq("id", uid).maybeSingle(),
    supabase.from("races").select("name, date, distance, goal").eq("user_id", uid).maybeSingle(),
    supabase.from("plans").select("weeks").eq("user_id", uid).maybeSingle(),
    supabase.from("activities").select("*").eq("user_id", uid).gte("date", since).order("date"),
  ]);
  const err = p.error ?? r.error ?? pl.error ?? a.error;
  if (err) throw err;
  return { profile: p.data, race: r.data, plan: (pl.data?.weeks as PlanWeekJson[]) ?? [], activities: a.data ?? [], fetchedAt: new Date().toISOString() };
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
