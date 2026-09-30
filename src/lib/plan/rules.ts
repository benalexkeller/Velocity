// The coaching rules the generator follows, each with where it comes from. Numbers here are the ones
// generate.ts reads; the list is also shown to the athlete under "How this plan is built".

export const RULES = {
  /** Share of sessions kept at low intensity (Seiler: elite endurance athletes ~80 % low, ~20 % moderate/high). */
  lowIntensityShare: 0.8,
  /** Recovery week: every 4th week in base and build (3:1 loading, Friel), at 60–70 % of the volume. */
  recoveryEvery: 4,
  recoveryFactor: 0.7,
  /** Weekly volume: at most +10 % week to week (classic guard; the evidence for it is weak, so the session rule below matters more). */
  weeklyRamp: 0.10,
  /** Single-session spikes: no long session more than 10 % longer than the longest of the previous 30 days (Frandsen/Nielsen 2025, BJSM, 5,205 runners). */
  sessionStep: 0.10,
  sessionWindowWeeks: 4,
  /** Taper: cut volume 41–60 % over 8–14 days (≤21), keep intensity and frequency (Wang 2023 meta-analysis; Bosquet 2007). */
  taperTwoWeeks: [0.65, 0.5] as const,
  taperOneWeek: 0.55,
  raceWeekFactor: 0.3,
  /** Longest sessions by event (hours): IM long ride builds to ~5 h (Mosley/MyProCoach), IM long run 2–2.5 h (Strauss/Endurance Nation), marathon long run 20–22 mi (Pfitzinger). */
  longCaps: {
    "140.6": { ride: 5.25, run: 2.5, swim: 1.25 }, "70.3": { ride: 3.5, run: 1.75, swim: 1 }, olympic: { ride: 2.5, run: 1.25, swim: 0.85 }, sprint: { ride: 1.75, run: 1, swim: 0.7 },
    marathon: { ride: 0, run: 3, swim: 0 }, half: { ride: 0, run: 1.9, swim: 0 }, "10k": { ride: 0, run: 1.4, swim: 0 }, "5k": { ride: 0, run: 1.1, swim: 0 }, ultra: { ride: 0, run: 4, swim: 0 },
    century: { ride: 5, run: 0, swim: 0 }, gran_fondo: { ride: 4.5, run: 0, swim: 0 }, swim_ow: { ride: 0, run: 0, swim: 1.5 }, other: { ride: 2, run: 1.5, swim: 0.75 },
  } as Record<string, { ride: number; run: number; swim: number }>,
  /** Discipline split of the hours for a full-distance finisher (Couzens: swim 2 h · bike 6 h · run 3.5 h of ~12 h). */
  triShares: { "140.6": { swim: 0.17, bike: 0.52, run: 0.31 }, "70.3": { swim: 0.2, bike: 0.5, run: 0.3 }, olympic: { swim: 0.22, bike: 0.46, run: 0.32 }, sprint: { swim: 0.25, bike: 0.42, run: 0.33 } } as Record<string, { swim: number; bike: number; run: number }>,
};

export interface MethodRule { rule: string; source: string; url: string }
export const METHOD: MethodRule[] = [
  { rule: "Base → Build → Peak → Taper → Race week. Three loading weeks, then one lighter week at about 70 %.", source: "Friel, The Triathlete's Training Bible; Pfitzinger & Douglas, Advanced Marathoning (endurance → threshold → race prep → taper)", url: "https://runningwithrock.com/pfitz-marathon-training-explained/" },
  { rule: "About 80 % of sessions easy, 20 % hard. One quality session a week in base, two in build and peak.", source: "Seiler (2009/2010) on intensity distribution in elite endurance athletes", url: "https://www.trainingpeaks.com/blog/does-polarized-training-really-work/" },
  { rule: "No long session more than 10 % longer than the longest of the previous 30 days. Week-to-week totals matter less than single jumps.", source: "Frandsen, Nielsen et al. 2025, British Journal of Sports Medicine, 5,205 runners: +64 % injury risk for 10–30 % jumps, +128 % over 100 %", url: "https://www.eurekalert.org/news-releases/1090184" },
  { rule: "Taper: volume down 41–60 % over 8–14 days, intensity and number of sessions kept.", source: "Wang et al. 2023 meta-analysis, PLOS ONE; Bosquet et al. 2007", url: "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0282838" },
  { rule: "Full distance: long ride builds to about 5 h with race-pace efforts and a short run off the bike; long run capped at 2.5 h.", source: "Mosley, MyProCoach; Strauss, Endurance Nation", url: "https://support.myprocoach.net/hc/en-us/articles/360000754251-Why-Aren-t-IRONMAN-Full-Distance-Triathlon-Training-Rides-Longer" },
  { rule: "Full-distance hours split roughly swim 17 % · bike 52 % · run 31 %; a mid-pack finisher trains 12–13 h a week at the peak.", source: "Couzens, Triathlete magazine", url: "https://www.triathlete.com/training/how-many-hours-does-it-really-take-to-conquer-ironman/" },
  { rule: "Marathon: long run up to 20–22 miles (about 3 h), 10–20 % slower than race pace; three-week taper.", source: "Pfitzinger & Douglas, Advanced Marathoning", url: "https://runningwithrock.com/pfitz-marathon-training-explained/" },
];
