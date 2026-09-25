// Placeholder brand — rename here and it changes everywhere.
export const BRAND = { name: "Velocity" };

// The signed-in athlete (will come from Supabase auth + profile).
export const ATHLETE = {
  firstName: "PR",
  units: "imperial" as "imperial" | "metric",
  weather: "22°C",
  city: "Munich",
  race: { name: "IRONMAN Texas", date: "2027-04-24", goal: "Sub-13", distanceLabel: "140.6" },
  // Sub-13 race targets used for the race bar (hours)
  raceSplits: { swim: 1.5, bike: 6.4, run: 4.75, transitions: 0.35 },
  planStart: "2026-09-07",
  // Provisional zones (recalibrated at the week-4 and week-18 tests)
  zones: {
    run: { "Zone 2": "10:15 – 11:15", Aerobic: "10:15 – 11:15", Endurance: "10:30 – 11:15", Tempo: "9:15 – 9:40", Intervals: "8:45 – 9:15", Race: "10:30 – 11:00" },
    bike: { "Zone 2": "15 – 17 mph", Aerobic: "15 – 17 mph", Endurance: "16 – 17.5 mph", Tempo: "18 – 19 mph", Intervals: "19 – 21 mph", Race: "17 – 18 mph" },
    swim: { Technique: "2:10 – 2:20", Aerobic: "2:00 – 2:10", "Zone 2": "2:00 – 2:10", Endurance: "1:55 – 2:05", Tempo: "1:45 – 1:55", Intervals: "1:40 – 1:50", Race: "2:05 – 2:15" },
  } as Record<string, Record<string, string>>,
};
