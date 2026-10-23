// The signed-in athlete, built from the profile + race rows. In local mode (no accounts) the
// values in config.ts (PR's) are used, so the app looks the same as before.
import { ATHLETE } from "./config";
import { DEFAULT_AVAILABILITY, type Availability } from "./data";
import { addDays, fromYmd, ymd } from "./format";

export type RaceDistance = "140.6" | "70.3" | "olympic" | "sprint" | "marathon" | "half" | "10k" | "5k" | "ultra" | "century" | "gran_fondo" | "swim_ow" | "other";
export interface Profile {
  id: string; email: string | null; username: string | null; name: string | null; avatar_url: string | null;
  units: "imperial" | "metric"; timezone: string; city: string | null; availability: Availability | null;
  zones: Record<string, Record<string, string>> | null; is_admin: boolean; setup_done: boolean; created_at: string; last_seen?: string | null;
}
export interface Race {
  name: string; date: string; distance: RaceDistance; distance_label?: string | null; goal?: string | null; goal_hours?: number | null;
  splits?: { swim: number; bike: number; run: number; transitions: number } | null; location?: string | null;
}
export interface Athlete {
  firstName: string; name: string; username: string | null; email: string | null; avatarUrl: string | null;
  units: "imperial" | "metric"; timezone: string; city: string; weather: string;
  availability: Required<Availability>;
  hasRace: boolean;
  race: { name: string; date: string; goal: string; distanceLabel: string; distance: RaceDistance; location: string };
  raceDist: { swimYd: number; bikeMi: number; runMi: number };
  raceSplits: { swim: number; bike: number; run: number; transitions: number };
  planStart: string;
  zones: Record<string, Record<string, string>>;
  /** Lactate-threshold heart rate (run) and FTP from the intake; null when never given. Load and HR zones are built on these. */
  lthr: number | null;
  ftp: number | null;
  /** Where the zone table came from: the coach (seed), the plan builder's answers, or the app's defaults. */
  zonesSource: "coach" | "intake" | "default";
  isAdmin: boolean;
  setupDone: boolean;
}

export const DISTANCES: { k: RaceDistance; label: string; short: string; hours: number; dist: Athlete["raceDist"]; frac: Athlete["raceSplits"] }[] = [
  { k: "140.6", label: "Full distance triathlon (140.6)", short: "140.6", hours: 13, dist: { swimYd: 4224, bikeMi: 112, runMi: 26.2 }, frac: { swim: 0.115, bike: 0.492, run: 0.366, transitions: 0.027 } },
  { k: "70.3", label: "Half distance triathlon (70.3)", short: "70.3", hours: 6, dist: { swimYd: 2112, bikeMi: 56, runMi: 13.1 }, frac: { swim: 0.12, bike: 0.5, run: 0.35, transitions: 0.03 } },
  { k: "olympic", label: "Olympic triathlon", short: "Olympic", hours: 2.75, dist: { swimYd: 1640, bikeMi: 24.8, runMi: 6.2 }, frac: { swim: 0.18, bike: 0.5, run: 0.29, transitions: 0.03 } },
  { k: "sprint", label: "Sprint triathlon", short: "Sprint", hours: 1.4, dist: { swimYd: 820, bikeMi: 12.4, runMi: 3.1 }, frac: { swim: 0.15, bike: 0.5, run: 0.3, transitions: 0.05 } },
  { k: "marathon", label: "Marathon", short: "26.2", hours: 4, dist: { swimYd: 0, bikeMi: 0, runMi: 26.2 }, frac: { swim: 0, bike: 0, run: 1, transitions: 0 } },
  { k: "half", label: "Half marathon", short: "13.1", hours: 2, dist: { swimYd: 0, bikeMi: 0, runMi: 13.1 }, frac: { swim: 0, bike: 0, run: 1, transitions: 0 } },
  { k: "10k", label: "10 km run", short: "10K", hours: 0.9, dist: { swimYd: 0, bikeMi: 0, runMi: 6.2 }, frac: { swim: 0, bike: 0, run: 1, transitions: 0 } },
  { k: "5k", label: "5 km run", short: "5K", hours: 0.45, dist: { swimYd: 0, bikeMi: 0, runMi: 3.1 }, frac: { swim: 0, bike: 0, run: 1, transitions: 0 } },
  { k: "ultra", label: "Ultra run (50 km – 100 mi)", short: "Ultra", hours: 8, dist: { swimYd: 0, bikeMi: 0, runMi: 31 }, frac: { swim: 0, bike: 0, run: 1, transitions: 0 } },
  { k: "century", label: "Century ride (100 mi)", short: "Century", hours: 6, dist: { swimYd: 0, bikeMi: 100, runMi: 0 }, frac: { swim: 0, bike: 1, run: 0, transitions: 0 } },
  { k: "gran_fondo", label: "Gran fondo / cycling race", short: "Gran fondo", hours: 5, dist: { swimYd: 0, bikeMi: 80, runMi: 0 }, frac: { swim: 0, bike: 1, run: 0, transitions: 0 } },
  { k: "swim_ow", label: "Open-water swim event", short: "Open water", hours: 1.5, dist: { swimYd: 3800, bikeMi: 0, runMi: 0 }, frac: { swim: 1, bike: 0, run: 0, transitions: 0 } },
  { k: "other", label: "Other event", short: "", hours: 3, dist: { swimYd: 0, bikeMi: 0, runMi: 0 }, frac: { swim: 0, bike: 0.5, run: 0.5, transitions: 0 } },
];
export const distanceInfo = (k: RaceDistance) => DISTANCES.find((d) => d.k === k) ?? DISTANCES[0];

export function goalLabel(hours: number | null | undefined) {
  if (!hours) return "";
  const h = Math.floor(hours), m = Math.round((hours - h) * 60);
  return m ? `Sub-${h}:${String(m).padStart(2, "0")}` : `Sub-${h}`;
}

/** PR's own athlete record (seed / local mode). */
export const DEFAULT_ATHLETE: Athlete = {
  firstName: ATHLETE.firstName, name: ATHLETE.firstName, username: null, email: null, avatarUrl: null,
  units: ATHLETE.units, timezone: "America/Los_Angeles", city: ATHLETE.city, weather: ATHLETE.weather,
  availability: DEFAULT_AVAILABILITY,
  hasRace: true,
  race: { ...ATHLETE.race, distance: "140.6", location: "The Woodlands, TX" },
  raceDist: distanceInfo("140.6").dist,
  raceSplits: ATHLETE.raceSplits,
  planStart: ATHLETE.planStart,
  zones: ATHLETE.zones,
  lthr: ATHLETE.lthr,
  ftp: null,
  zonesSource: "coach",
  isAdmin: true,
  setupDone: true,
};

/** Athlete record for a signed-in user. planStart = first plan week, else the sign-up date.
 *  Local mode (no profile): PR's record, with a race or availability saved in this browser laid over it. */
export function athleteOf(profile: Profile | null, race: Race | null, planStart: string | null, localAvailability?: Availability | null): Athlete {
  if (!profile) {
    if (!race && !localAvailability && !planStart) return DEFAULT_ATHLETE;
    const info = distanceInfo(race?.distance ?? "140.6");
    const hours = race?.goal_hours ?? info.hours;
    return {
      ...DEFAULT_ATHLETE,
      availability: { ...DEFAULT_AVAILABILITY, ...(localAvailability ?? {}) },
      ...(race ? { hasRace: true, race: { name: race.name, date: race.date, goal: race.goal || goalLabel(race.goal_hours), distanceLabel: race.distance_label || info.short, distance: race.distance, location: race.location ?? "" }, raceDist: info.dist, raceSplits: race.splits ?? { swim: +(hours * info.frac.swim).toFixed(2), bike: +(hours * info.frac.bike).toFixed(2), run: +(hours * info.frac.run).toFixed(2), transitions: +(hours * info.frac.transitions).toFixed(2) } } : {}),
      planStart: planStart ?? DEFAULT_ATHLETE.planStart,
    };
  }
  const name = profile.name?.trim() || profile.username || profile.email?.split("@")[0] || "Athlete";
  const info = distanceInfo(race?.distance ?? "140.6");
  const hours = race?.goal_hours ?? info.hours;
  const splits = race?.splits ?? { swim: +(hours * info.frac.swim).toFixed(2), bike: +(hours * info.frac.bike).toFixed(2), run: +(hours * info.frac.run).toFixed(2), transitions: +(hours * info.frac.transitions).toFixed(2) };
  const start = planStart ?? ymd(fromYmd(profile.created_at.slice(0, 10)));
  return {
    firstName: name.split(/\s+/)[0], name, username: profile.username, email: profile.email, avatarUrl: profile.avatar_url,
    units: profile.units, timezone: profile.timezone, city: profile.city ?? "", weather: "",
    availability: { ...DEFAULT_AVAILABILITY, ...(profile.availability ?? {}) },
    hasRace: !!race,
    race: race
      ? { name: race.name, date: race.date, goal: race.goal || goalLabel(race.goal_hours), distanceLabel: race.distance_label || info.short, distance: race.distance, location: race.location ?? "" }
      : { name: "No race set", date: ymd(addDays(fromYmd(start), 365)), goal: "", distanceLabel: "", distance: "140.6", location: "" },
    raceDist: info.dist,
    raceSplits: splits,
    planStart: start,
    zones: profile.zones ?? ATHLETE.zones,
    lthr: profile.zones?.meta?.lthr ? Number(profile.zones.meta.lthr) || null : null,
    ftp: profile.zones?.meta?.ftp ? Number(profile.zones.meta.ftp) || null : null,
    zonesSource: profile.zones ? "intake" : "default",
    isAdmin: profile.is_admin,
    setupDone: profile.setup_done,
  };
}

/** Fallback threshold when the athlete never gave one; every page that uses it says so. */
export const DEFAULT_LTHR = 155;

/** Heart-rate zone from an average HR and the athlete's threshold (Friel's run/bike percentages). */
export function hrZone(sport: string, hr: number, lthr: number | null): 1 | 2 | 3 | 4 | 5 {
  const r = hr / (lthr ?? DEFAULT_LTHR);
  const cut = sport === "bike" || sport === "brick" ? [0.81, 0.9, 0.94, 1.0] : [0.85, 0.9, 0.95, 1.0];
  return r < cut[0] ? 1 : r < cut[1] ? 2 : r < cut[2] ? 3 : r < cut[3] ? 4 : 5;
}
/** Zone cut-offs in bpm for display ("Z2 · 132 – 138"). */
export function hrZoneRanges(sport: string, lthr: number): Record<1 | 2 | 3 | 4 | 5, [number, number]> {
  const c = sport === "bike" ? [0.81, 0.9, 0.94, 1.0] : [0.85, 0.9, 0.95, 1.0];
  const b = (x: number) => Math.round(lthr * x);
  return { 1: [Math.round(lthr * 0.6), b(c[0]) - 1], 2: [b(c[0]), b(c[1]) - 1], 3: [b(c[1]), b(c[2]) - 1], 4: [b(c[2]), b(c[3]) - 1], 5: [b(c[3]), Math.round(lthr * 1.1)] };
}
