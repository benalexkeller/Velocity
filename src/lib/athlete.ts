// The signed-in athlete, built from the profile + race rows. In local mode (no accounts) the
// values in config.ts (PR's) are used, so the app looks the same as before.
import { ATHLETE } from "./config";
import { DEFAULT_AVAILABILITY, type Availability } from "./data";
import { addDays, fromYmd, ymd } from "./format";

export type RaceDistance = "140.6" | "70.3" | "marathon" | "half" | "olympic" | "sprint" | "other";
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
  isAdmin: true,
  setupDone: true,
};

/** Athlete record for a signed-in user. planStart = first plan week, else the sign-up date. */
export function athleteOf(profile: Profile | null, race: Race | null, planStart: string | null): Athlete {
  if (!profile) return DEFAULT_ATHLETE;
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
    isAdmin: profile.is_admin,
    setupDone: profile.setup_done,
  };
}
