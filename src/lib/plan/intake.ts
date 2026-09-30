// The plan builder's questionnaire: what the athlete answers before a plan is generated.
// Stored next to the plan (plans.intake) so it can be edited and the plan rebuilt.
import type { RaceDistance } from "../athlete";

export type Kind = "tri" | "run" | "bike" | "swim" | "other";
export type GoalKind = "finish" | "time" | "podium";
export type TimeOfDay = "morning" | "midday" | "evening";

export interface EventType { k: RaceDistance; kind: Kind; label: string; group: string; hint: string }
/** Event types the builder knows, grouped for the picker. */
export const EVENT_TYPES: EventType[] = [
  { k: "sprint", kind: "tri", group: "Triathlon", label: "Sprint", hint: "750 m · 20 km · 5 km" },
  { k: "olympic", kind: "tri", group: "Triathlon", label: "Olympic", hint: "1.5 km · 40 km · 10 km" },
  { k: "70.3", kind: "tri", group: "Triathlon", label: "Half (70.3)", hint: "1.9 km · 90 km · 21.1 km" },
  { k: "140.6", kind: "tri", group: "Triathlon", label: "Full (140.6)", hint: "3.8 km · 180 km · 42.2 km" },
  { k: "5k", kind: "run", group: "Running", label: "5 km", hint: "" },
  { k: "10k", kind: "run", group: "Running", label: "10 km", hint: "" },
  { k: "half", kind: "run", group: "Running", label: "Half marathon", hint: "21.1 km" },
  { k: "marathon", kind: "run", group: "Running", label: "Marathon", hint: "42.2 km" },
  { k: "ultra", kind: "run", group: "Running", label: "Ultra", hint: "50 km and up" },
  { k: "century", kind: "bike", group: "Cycling", label: "Century", hint: "100 mi / 160 km" },
  { k: "gran_fondo", kind: "bike", group: "Cycling", label: "Gran fondo / race", hint: "any distance" },
  { k: "swim_ow", kind: "swim", group: "Swimming", label: "Open-water swim", hint: "any distance" },
  { k: "other", kind: "other", group: "Other", label: "Other event", hint: "you name it" },
];
export const eventType = (k: RaceDistance) => EVENT_TYPES.find((e) => e.k === k) ?? EVENT_TYPES[EVENT_TYPES.length - 1];

export interface PastRace { sport: Kind; distance: string; time: string }
export interface Blackout { from: string; to: string; note?: string }

export interface Intake {
  goal: {
    type: RaceDistance;          // event type (drives the branch: tri / run / bike / swim)
    event: string;               // race name
    location: string;
    date: string;                // YYYY-MM-DD
    custom_label?: string;       // for "other": what it is, e.g. "24 h relay"
    kind: GoalKind;              // finish | time | podium
    target_hours: number | null; // for time (and optionally podium)
    splits: { swim: number; bike: number; run: number; transitions: number } | null; // hours, tri only
  };
  history: {
    raced: boolean;
    races: PastRace[];
    sessions_per_week: number;   // last 6–8 weeks
    hours: { swim: number; bike: number; run: number; strength: number }; // per week, last 6–8 weeks
  };
  fitness: {
    swim_pace_100: string;       // m:ss per 100 (unit follows the profile)
    swim_longest: number | null; // m or yd
    bike_speed: number | null;   // km/h or mph, steady solo
    bike_ftp: number | null;     // W, optional
    bike_longest: number | null; // km or mi
    run_pace: string;            // m:ss per km or mile, easy
    run_longest: number | null;  // km or mi
    vo2max: number | null;
    rhr: number | null;
    lthr: number | null;
    garmin_later: boolean;       // fill vo2max / rhr / lthr from Garmin once connected
  };
  time: {
    max_hours: number;           // per week, at the biggest week
    days: number[];              // 0 = Sun … 6 = Sat, like the profile
    time_of_day: TimeOfDay;      // weekdays
    weekend_start: string;       // "08:00"
    long_weekend: boolean;       // long sessions on the weekend
    blackouts: Blackout[];
    calendar_sync: boolean;
  };
  devices: string[];             // garmin | whoop | apple | coros | polar | strava | none
  strength: boolean;
  created_at: string;
}

export const DEVICES: { k: string; label: string }[] = [{ k: "garmin", label: "Garmin" }, { k: "whoop", label: "Whoop" }, { k: "apple", label: "Apple Watch" }, { k: "coros", label: "Coros" }, { k: "polar", label: "Polar" }, { k: "strava", label: "Strava" }, { k: "none", label: "None" }];

export const EMPTY_INTAKE: Intake = {
  goal: { type: "70.3", event: "", location: "", date: "", kind: "finish", target_hours: null, splits: null },
  history: { raced: false, races: [], sessions_per_week: 3, hours: { swim: 0, bike: 0, run: 0, strength: 0 } },
  fitness: { swim_pace_100: "", swim_longest: null, bike_speed: null, bike_ftp: null, bike_longest: null, run_pace: "", run_longest: null, vo2max: null, rhr: null, lthr: null, garmin_later: false },
  time: { max_hours: 8, days: [1, 2, 3, 4, 5, 6, 0], time_of_day: "morning", weekend_start: "08:00", long_weekend: true, blackouts: [], calendar_sync: false },
  devices: [],
  strength: false,
  created_at: "",
};

export const MIN_WEEKS = 4;
export const hoursToText = (h: number | null | undefined) => { if (!h) return ""; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${H}:${String(M).padStart(2, "0")}`; };
export const textToHours = (t: string) => { const m = t.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/); return m ? +m[1] + (+(m[2] ?? 0)) / 60 : null; };
export const paceToSec = (t: string) => { const m = t.trim().match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
