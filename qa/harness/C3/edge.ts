import { generatePlan, planStart, weeksUntil } from "/home/claude/velocity/src/lib/plan/generate";
import { EMPTY_INTAKE, type Intake } from "/home/claude/velocity/src/lib/plan/intake";
import { ymd } from "/home/claude/velocity/src/lib/format";

const D = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const show = (label: string, weeks: ReturnType<typeof generatePlan>["weeks"], which: number[]) => {
  console.log(`\n=== ${label}`);
  for (const w of weeks) if (which.includes(w.week)) { console.log(` W${w.week} ${w.start} ${w.phase}${w.recovery ? " [REC]" : ""} :: ${w.focus}`); w.days.forEach((d, i) => console.log(`   ${D[i]} ${String(d.min).padStart(3)} ${d.text}`)); }
};
const im: Partial<Intake> = { ...EMPTY_INTAKE, goal: { ...EMPTY_INTAKE.goal, type: "140.6", event: "IRONMAN Texas", date: "2027-05-01", kind: "finish", target_hours: null }, history: { raced: true, races: [], sessions_per_week: 6, hours: { swim: 1.5, bike: 4.5, run: 3, strength: 0 } }, fitness: { ...EMPTY_INTAKE.fitness, swim_pace_100: "1:50", swim_longest: 2000, bike_speed: 17, bike_longest: 40, run_pace: "9:30", run_longest: 8 }, time: { ...EMPTY_INTAKE.time, max_hours: 14, days: [1, 2, 3, 4, 5, 6, 0], long_weekend: true } };

// 1. rebuild on Friday 9 Oct: where does the plan start?
const fri = new Date(2026, 9, 9);
console.log("Rebuild on Fri 9 Oct → planStart =", ymd(planStart(fri)), "weeks =", weeksUntil("2027-05-01", fri));
const r1 = generatePlan(im, fri, true);
show("Rebuild on Friday (week 1 = ?)", r1.weeks, [1]);
// Sunday rebuild
const sun = new Date(2026, 9, 11);
console.log("Rebuild on Sun 11 Oct → planStart =", ymd(planStart(sun)));

// 2. blackout Saturday 14 Nov only (long ride day)
const r2 = generatePlan({ ...im, time: { ...im.time!, blackouts: [{ from: "2026-11-14", to: "2026-11-14", note: "wedding" }] } }, new Date(2026, 9, 7), true);
show("Blackout Sat 14 Nov only — is the long ride moved?", r2.weeks, [6]);

// 3. weekday-only triathlete Mon–Fri
const r3 = generatePlan({ ...im, time: { ...im.time!, days: [1, 2, 3, 4, 5], long_weekend: true } }, new Date(2026, 9, 7), true);
show("Tri, Mon–Fri only", r3.weeks, [2, 16]);

// 4. 5-day triathlete Tue Thu Fri Sat Sun
const r4 = generatePlan({ ...im, time: { ...im.time!, days: [2, 4, 5, 6, 0], long_weekend: true } }, new Date(2026, 9, 7), true);
show("Tri, Tue Thu Fri Sat Sun", r4.weeks, [2, 16]);

// 5. 140.6 Sunday race, all 7 days
const r5 = generatePlan({ ...im, goal: { ...im.goal!, date: "2027-05-02" } }, new Date(2026, 9, 7), true);
show("140.6 Sunday race — race week", r5.weeks, [r5.weeks.length - 1, r5.weeks.length]);

// 6. podium vs finish — identical?
const a = generatePlan({ ...im, goal: { ...im.goal!, kind: "finish" } }, new Date(2026, 9, 7), true);
const b = generatePlan({ ...im, goal: { ...im.goal!, kind: "podium", target_hours: 10 } }, new Date(2026, 9, 7), true);
const c = generatePlan({ ...im, history: { ...im.history!, raced: false, sessions_per_week: 2 }, fitness: { ...im.fitness!, bike_ftp: 320, lthr: 170, vo2max: 60 } }, new Date(2026, 9, 7), true);
const strip = (w: typeof a.weeks) => JSON.stringify(w.map((x) => x.days.map((d) => d.text + d.min)));
console.log("\nfinish vs podium(10h) identical sessions:", strip(a.weeks) === strip(b.weeks), "| race-day min:", a.weeks.at(-1)!.days[5].min, b.weeks.at(-1)!.days[5].min);
console.log("raced/sessions_per_week/FTP/LTHR/VO2max change anything:", strip(a.weeks) !== strip(c.weeks));

// 7. metric athlete with the same numbers typed as km — does stated longest change?
const m = generatePlan({ ...im, fitness: { ...im.fitness!, run_pace: "5:55", run_longest: 13, bike_speed: 28, bike_longest: 60 } }, new Date(2026, 9, 7), false);
show("Metric athlete W1", m.weeks, [1]);

// 8. 140.6 with max 6 h — accepted?
const low = generatePlan({ ...im, time: { ...im.time!, max_hours: 6 }, history: { ...im.history!, hours: { swim: 1, bike: 2, run: 1, strength: 0 } } }, new Date(2026, 9, 7), true);
console.log("\n140.6 on 6 h max: peakHours", low.summary.peakHours, "longest ride", low.summary.longest.ride.toFixed(2), "longest run", low.summary.longest.run.toFixed(2));
show("140.6 on 6 h — peak week", low.weeks, [26]);

// 9. 'other' event
const o = generatePlan({ ...im, goal: { ...im.goal!, type: "other", custom_label: "Swimrun", date: "2027-02-06" } }, new Date(2026, 9, 7), true);
show("Other event (Swimrun)", o.weeks, [2, 10]);
