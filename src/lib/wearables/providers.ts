// Every wearable Velocity can connect, and the words for each. Safe in the browser (no secrets). Server-side
// details live in the files next to this one.

/** Every maker Velocity can connect. Each has its own connection once its keys are in Vercel; COROS, Polar, Suunto and
 *  Wahoo can also come through Junction until then. Fitbit data comes through Google (the Google Health API). */
export type WearableKey = "garmin" | "whoop" | "apple" | "fitbit" | "coros" | "polar" | "suunto" | "wahoo";
/** Makers whose connection runs through the shared OAuth routes (/api/connect/<maker>, src/lib/wearables/direct.ts). */
export const DIRECT_KEYS = ["fitbit", "polar", "wahoo", "coros", "suunto"] as const;
export type DirectKey = (typeof DIRECT_KEYS)[number];
/** Where an activity or body value came from. */
export type Source = WearableKey | "manual";

export const SOURCE_NAME: Record<Source, string> = {
  garmin: "Garmin", whoop: "WHOOP", apple: "Apple Watch", fitbit: "Fitbit", coros: "COROS", polar: "Polar", suunto: "Suunto", wahoo: "Wahoo", manual: "Manual",
};
export const sourceName = (s: string | undefined) => SOURCE_NAME[(s ?? "manual") as Source] ?? "Manual";

/** When two makers recorded the same workout, the one earlier in this list counts; the other is kept but excluded. */
export const ACTIVITY_PRIORITY: Source[] = ["garmin", "coros", "polar", "suunto", "wahoo", "apple", "fitbit", "whoop", "manual"];

/** Per body value, the makers that measure it best first. A maker not listed never writes that value. */
export const BODY_PRIORITY: Record<"rhr" | "hrv" | "sleep_h" | "sleep_score" | "stress" | "vo2" | "recovery" | "strain" | "weight_kg", Source[]> = {
  rhr: ["whoop", "garmin", "apple", "fitbit", "polar", "coros", "suunto"],
  hrv: ["whoop", "garmin", "apple", "fitbit", "polar", "coros", "suunto"],
  sleep_h: ["whoop", "garmin", "apple", "fitbit", "polar", "coros", "suunto"],
  sleep_score: ["whoop", "garmin", "fitbit", "polar", "coros", "suunto"],
  stress: ["garmin"],
  vo2: ["garmin", "apple", "fitbit", "coros", "polar", "suunto"],
  recovery: ["whoop", "garmin", "polar"],
  strain: ["whoop"],
  weight_kg: ["garmin", "apple", "fitbit", "polar", "manual"],
};

export interface WearableInfo { k: WearableKey; name: string; brings: string }
export const WEARABLES: WearableInfo[] = [
  { k: "garmin", name: "Garmin", brings: "Activities with routes, heart rate, power, VO2max, resting HR, HRV, sleep" },
  { k: "whoop", name: "WHOOP", brings: "Recovery, HRV, resting HR, sleep, strain and workouts" },
  { k: "apple", name: "Apple Watch", brings: "Workouts, heart rate, VO2max and sleep through Apple Health" },
  { k: "fitbit", name: "Fitbit", brings: "Workouts, resting HR, HRV, VO2max, sleep and weight through Google Health" },
  { k: "coros", name: "COROS", brings: "Activities, heart rate, training load" },
  { k: "polar", name: "Polar", brings: "Activities, heart rate, recovery data" },
  { k: "suunto", name: "Suunto", brings: "Activities, routes, heart rate" },
  { k: "wahoo", name: "Wahoo", brings: "Rides with power and heart rate" },
];
export const WEARABLE_NAME = (k: string) => WEARABLES.find((w) => w.k === k)?.name ?? k;

/** GET /api/connect/status */
export interface ConnectionRow { provider: string; via: string; status: string; connected_at: string | null; last_event_at: string | null; synced_at: string | null; error: string | null; device: string | null }
export interface ConnectStatus {
  /** which makers this site can connect right now, and through what */
  live: Partial<Record<WearableKey, "direct" | "junction" | "app">>;
  /** Garmin: "junction" or "direct" (empty when Garmin is off) */
  via: string;
  connections: ConnectionRow[];
  /** kept for older code: true when Garmin can connect */
  garmin: boolean;
}
