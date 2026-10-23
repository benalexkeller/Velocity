// Harness: build plans with the real generator and audit each week against coaching rules.
import { generatePlan, statedLongest } from "/home/claude/velocity/src/lib/plan/generate";
import { EMPTY_INTAKE, type Intake } from "/home/claude/velocity/src/lib/plan/intake";
import { sportOf, intensityOf } from "/home/claude/velocity/src/lib/data/index";
import { workoutFor } from "/home/claude/velocity/src/lib/workout";
import { ATHLETE } from "/home/claude/velocity/src/lib/config";
import * as fs from "fs";

const TODAY = new Date(2026, 9, 7); // Wed 7 Oct 2026
const D = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hm = (h: number) => `${Math.floor(h)}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, "0")}`;

type Scenario = { id: string; label: string; intake: Partial<Intake>; imperial?: boolean };

const base = (over: Partial<Intake>): Partial<Intake> => ({ ...EMPTY_INTAKE, ...over });

const S: Scenario[] = [
  { id: "a", label: "140.6 in 30 wk, 9 h/wk now, max 14 h, 6 days, strength on", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "140.6", event: "IRONMAN Texas", date: "2027-05-01", kind: "time", target_hours: 13 }, history: { raced: true, races: [], sessions_per_week: 6, hours: { swim: 1.5, bike: 4.5, run: 3, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "1:50", swim_longest: 2000, bike_speed: 17, bike_longest: 40, run_pace: "9:30", run_longest: 8 }, time: { ...EMPTY_INTAKE.time, max_hours: 14, days: [1, 2, 3, 4, 5, 6, 0], long_weekend: true }, strength: true }) },
  { id: "b", label: "70.3 in 16 wk, 6 h/wk now, max 10 h, 6 days", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "70.3", event: "IRONMAN 70.3 Oceanside", date: "2027-01-23", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 5, hours: { swim: 1, bike: 3, run: 2, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "2:00", swim_longest: 1500, bike_speed: 16, bike_longest: 30, run_pace: "10:00", run_longest: 6 }, time: { ...EMPTY_INTAKE.time, max_hours: 10, days: [1, 2, 3, 4, 6, 0], long_weekend: true } }) },
  { id: "c", label: "Marathon in 14 wk, 2:45 target, 5 h/wk now (run only), max 8 h, 6 days", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "marathon", event: "Houston Marathon", date: "2027-01-10", kind: "time", target_hours: 2.75 }, history: { raced: true, races: [{ sport: "run", distance: "Marathon", time: "2:55" }], sessions_per_week: 6, hours: { swim: 0, bike: 0, run: 5, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, run_pace: "7:30", run_longest: 14 }, time: { ...EMPTY_INTAKE.time, max_hours: 8, days: [1, 2, 3, 4, 6, 0], long_weekend: true } }) },
  { id: "d", label: "Gran fondo in 20 wk, 5 h/wk now, max 10 h, 5 days", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "gran_fondo", event: "Mallorca 312", date: "2027-02-20", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 4, hours: { swim: 0, bike: 5, run: 0, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, bike_speed: 17, bike_longest: 50 }, time: { ...EMPTY_INTAKE.time, max_hours: 10, days: [2, 4, 6, 0, 3], long_weekend: true } }) },
  { id: "e", label: "Edge: 70.3 4 weeks away, 8 h/wk now, max 10", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "70.3", event: "IRONMAN 70.3 Arizona", date: "2026-10-31", kind: "finish", target_hours: null }, history: { raced: true, races: [], sessions_per_week: 6, hours: { swim: 1.5, bike: 4, run: 2.5, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "1:45", swim_longest: 2500, bike_speed: 18, bike_longest: 50, run_pace: "9:00", run_longest: 10 }, time: { ...EMPTY_INTAKE.time, max_hours: 10, days: [1, 2, 3, 4, 5, 6, 0], long_weekend: true } }) },
  { id: "f", label: "140.6 in 30 wk: 2 h/wk history, max 20 h, no stated longest sessions", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "140.6", event: "IRONMAN Texas", date: "2027-05-01", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 2, hours: { swim: 0, bike: 1, run: 1, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness }, time: { ...EMPTY_INTAKE.time, max_hours: 20, days: [1, 2, 3, 4, 5, 6, 0], long_weekend: true } }) },
  { id: "g", label: "140.6 30 wk as (a) with blackout Mon 16 Nov – Sun 22 Nov 2026 (whole week 7)", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "140.6", event: "IRONMAN Texas", date: "2027-05-01", kind: "time", target_hours: 13 }, history: { raced: true, races: [], sessions_per_week: 6, hours: { swim: 1.5, bike: 4.5, run: 3, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "1:50", swim_longest: 2000, bike_speed: 17, bike_longest: 40, run_pace: "9:30", run_longest: 8 }, time: { ...EMPTY_INTAKE.time, max_hours: 14, days: [1, 2, 3, 4, 5, 6, 0], long_weekend: true, blackouts: [{ from: "2026-11-16", to: "2026-11-22", note: "work trip" }] }, strength: true }) },
  { id: "h", label: "140.6 30 wk, 3 days only (Tue Thu Sat), max 14", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "140.6", event: "IRONMAN Texas", date: "2027-05-01", kind: "finish", target_hours: null }, history: { raced: true, races: [], sessions_per_week: 3, hours: { swim: 1, bike: 3, run: 2, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "1:50", swim_longest: 2000, bike_speed: 17, bike_longest: 40, run_pace: "9:30", run_longest: 8 }, time: { ...EMPTY_INTAKE.time, max_hours: 14, days: [2, 4, 6], long_weekend: true } }) },
  { id: "i", label: "Marathon 14 wk, long run on a weekday (long_weekend=false), 4 days Mon Wed Fri Sun", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "marathon", event: "Houston Marathon", date: "2027-01-10", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 4, hours: { swim: 0, bike: 0, run: 4, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, run_pace: "10:00", run_longest: 8 }, time: { ...EMPTY_INTAKE.time, max_hours: 7, days: [1, 3, 5, 0], long_weekend: false } }) },
  { id: "j", label: "Sprint tri in 12 wk, max 5 h, 4 days", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "sprint", event: "Local sprint", date: "2026-12-27", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 3, hours: { swim: 0.5, bike: 1, run: 1, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness }, time: { ...EMPTY_INTAKE.time, max_hours: 5, days: [2, 4, 6, 0], long_weekend: true } }) },
  { id: "k", label: "Race on a Monday (gran fondo), 10 wk", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "gran_fondo", event: "Monday race", date: "2026-12-14", kind: "finish", target_hours: null }, history: { raced: false, races: [], sessions_per_week: 4, hours: { swim: 0, bike: 5, run: 0, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, bike_speed: 17, bike_longest: 50 }, time: { ...EMPTY_INTAKE.time, max_hours: 8, days: [2, 4, 6, 0], long_weekend: true } }) },
  { id: "l", label: "Ultra 100 mi in 24 wk, max 12 h", intake: base({ goal: { ...EMPTY_INTAKE.goal, type: "ultra", event: "Western States 100", date: "2027-03-20", kind: "finish", target_hours: null }, history: { raced: true, races: [], sessions_per_week: 5, hours: { swim: 0, bike: 0, run: 6, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, run_pace: "10:00", run_longest: 18 }, time: { ...EMPTY_INTAKE.time, max_hours: 12, days: [1, 2, 3, 4, 6, 0], long_weekend: true } }) },
];

const sel = process.argv[2];
let out = "";
const log = (s = "") => { out += s + "\n"; };

for (const sc of S) {
  if (sel && sc.id !== sel) continue;
  const { weeks, summary } = generatePlan(sc.intake, TODAY, sc.imperial ?? true);
  log(`\n################ SCENARIO ${sc.id}: ${sc.label}`);
  log(`weeks=${summary.weeks} start=${summary.start} peakHours=${summary.peakHours.toFixed(1)} sessions=${summary.sessions} longest ride=${hm(summary.longest.ride)} run=${hm(summary.longest.run)} swim=${hm(summary.longest.swim)}`);
  log(`phases: ${summary.phases.map((p) => `${p.name} (${p.from}-${p.to})`).join(" | ")}`);
  const seed = statedLongest(sc.intake as Intake, true);
  log(`stated longest (h): run ${hm(seed.run)} ride ${hm(seed.ride)} swim ${hm(seed.swim)}`);
  log(`hours target per week: ${summary.hours.map((h) => h.toFixed(1)).join(" ")}`);

  const flags: string[] = [];
  let prevH = 0; let prevLongRide = 0; let prevLongRun = 0; let loadStreak = 0;
  const longRideHist: number[] = []; const longRunHist: number[] = [];
  log(`\nwk | start      | phase                         | rec | plan h | actual h | long ride | long run | long swim | hard | easy | hard-days | strength-days`);
  for (const w of weeks) {
    const tot = w.days.reduce((a, d) => a + d.min, 0) / 60;
    const raceMin = w.days.find((d) => /^Race day/.test(d.text))?.min ?? 0;
    const trainH = (w.days.reduce((a, d) => a + d.min, 0) - raceMin) / 60;
    const rideLong = w.days.map((d) => d.text.match(/Long ride (\d+):(\d+)/)).filter(Boolean).map((m) => +m![1] + +m![2] / 60);
    const runOff = w.days.map((d) => d.text.match(/Run (\d+):(\d+) off the bike/)).filter(Boolean).map((m) => +m![1] + +m![2] / 60);
    const runLong = w.days.map((d) => d.text.match(/Long run (\d+):(\d+)/)).filter(Boolean).map((m) => +m![1] + +m![2] / 60);
    const swimLong = w.days.map((d) => d.text.match(/Long swim (\d+):(\d+)/)).filter(Boolean).map((m) => +m![1] + +m![2] / 60);
    const longSession = w.days.map((d) => d.text.match(/Long session (\d+):(\d+)/)).filter(Boolean).map((m) => +m![1] + +m![2] / 60);
    const lr = Math.max(0, ...rideLong, ...longSession), lru = Math.max(0, ...runLong), ls = Math.max(0, ...swimLong);
    const hardDays = w.days.map((d, i) => ({ d, i })).filter(({ d }) => { const t = d.text.toLowerCase(); return /tempo|threshold|interval|race effort|race pace|race sim|\bhard\b|hill/.test(t) && !/^race day/.test(t); }).map(({ i }) => D[i]);
    const strengthDays = w.days.map((d, i) => (/Strength/.test(d.text) ? D[i] : null)).filter(Boolean);
    const sessionsN = w.days.filter((d) => d.min > 0).length;
    const easyN = w.days.filter((d) => d.min > 0 && !hardDays.includes(D[w.days.indexOf(d)])).length;
    log(`${String(w.week).padStart(2)} | ${w.start} | ${w.phase.padEnd(29)} | ${w.recovery ? " R " : "   "} | ${summary.hours[w.week - 1].toFixed(1).padStart(6)} | ${trainH.toFixed(1).padStart(8)}${raceMin ? `+race ${hm(raceMin / 60)}` : ""} | ${lr ? hm(lr) + (runOff.length ? `+${hm(runOff[0])}r` : "") : "-"} | ${lru ? hm(lru) : "-"} | ${ls ? hm(ls) : "-"} | ${hardDays.length} | ${easyN} | ${hardDays.join(",")} | ${strengthDays.join(",")}`);
    // checks
    if (prevH > 0 && !w.recovery && trainH > prevH * 1.10 + 0.01 && !weeks[w.week - 2].recovery) flags.push(`W${w.week}: weekly hours +${((trainH / prevH - 1) * 100).toFixed(0)}% (${prevH.toFixed(1)} → ${trainH.toFixed(1)})`);
    if (prevH > 0 && weeks[w.week - 2].recovery && trainH > prevH * 1.10 + 0.01) { /* after recovery, compare with the week before that */ const pp = weeks[w.week - 3]; if (pp) { const ppH = pp.days.reduce((a, d) => a + d.min, 0) / 60; if (trainH > ppH * 1.10 + 0.01) flags.push(`W${w.week}: +${((trainH / ppH - 1) * 100).toFixed(0)}% vs last loading week W${pp.week} (${ppH.toFixed(1)} → ${trainH.toFixed(1)})`); } }
    const maxRide30 = Math.max(0, ...longRideHist.slice(-4)); const maxRun30 = Math.max(0, ...longRunHist.slice(-4));
    if (lr && maxRide30 && lr > maxRide30 * 1.10 + 0.01) flags.push(`W${w.week}: long ride ${hm(lr)} is +${((lr / maxRide30 - 1) * 100).toFixed(0)}% over longest of prior 4 wk (${hm(maxRide30)})`);
    if (lru && maxRun30 && lru > maxRun30 * 1.10 + 0.01) flags.push(`W${w.week}: long run ${hm(lru)} is +${((lru / maxRun30 - 1) * 100).toFixed(0)}% over longest of prior 4 wk (${hm(maxRun30)})`);
    if (lru > 3.0) flags.push(`W${w.week}: long run ${hm(lru)} > 3 h`);
    // back-to-back hard days
    const hardIdx = w.days.map((d, i) => (hardDays.includes(D[i]) ? i : -1)).filter((i) => i >= 0);
    for (let k = 1; k < hardIdx.length; k++) if (hardIdx[k] - hardIdx[k - 1] === 1) flags.push(`W${w.week}: hard days back to back ${D[hardIdx[k - 1]]}+${D[hardIdx[k]]}`);
    if (w.recovery) loadStreak = 0; else if (!w.race && !/Taper/.test(w.phase)) loadStreak++;
    if (loadStreak >= 5 && !/Taper|Race/.test(w.phase)) flags.push(`W${w.week}: ${loadStreak} loading weeks without recovery`);
    if (lr) longRideHist.push(lr); if (lru) longRunHist.push(lru);
    prevH = trainH; prevLongRide = lr || prevLongRide; prevLongRun = lru || prevLongRun;
  }
  log(`\nsession texts per week:`);
  for (const w of weeks) {
    log(`  W${String(w.week).padStart(2)} ${w.phase}${w.recovery ? " [REC]" : ""} :: ${w.focus}`);
    w.days.forEach((d, i) => log(`      ${D[i]} ${String(d.min).padStart(3)}  ${d.text}  [${sportOf(d.text)}/${intensityOf(d.text)}]`));
  }
  log(`\nFLAGS (${flags.length}):`);
  flags.forEach((f) => log("  - " + f));
  // sanity: in-week sum vs. summary.hours
  log(`\nplan-hours vs actual-hours delta per week: ${weeks.map((w, i) => { const t = (w.days.reduce((a, d) => a + d.min, 0) - (w.days.find((d) => /^Race day/.test(d.text))?.min ?? 0)) / 60; return (t - summary.hours[i]).toFixed(1); }).join(" ")}`);
  fs.writeFileSync(`/home/claude/qa/work/C3/plan-${sc.id}.json`, JSON.stringify({ weeks, summary }, null, 1));
}
fs.writeFileSync(`/home/claude/qa/work/C3/gen-out${sel ? "-" + sel : ""}.txt`, out);
console.log(out.length, "chars written");
