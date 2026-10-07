import { workoutFor } from "/home/claude/velocity/src/lib/workout";
import { sportOf, intensityOf } from "/home/claude/velocity/src/lib/data/index";
import type { Session } from "/home/claude/velocity/src/lib/data/index";

const texts: [string, number][] = [
  ["Run 1:30 EZ + 6x20s strides", 90],
  ["Bike 1:30 EZ + 3x1min fast cadence + Strength 0:20 (squats, lunges, hinges, planks)", 110],
  ["Swim 0:50 — technique + 4x100 smooth", 50],
  ["Swim 1:10 — 10x100 at threshold pace", 70],
  ["Swim 0:25 — 10x100 at threshold pace", 25],
  ["Bike 1:30 tempo — 3x10min at threshold", 90],
  ["Run 1:30 intervals — 5x3min hard, 3min easy", 90],
  ["Run 0:50 tempo — 3x8min at threshold", 50],
  ["Brick: Long ride 4:15 EZ + Run 0:20 off the bike", 275],
  ["Long run 2:05 EZ with the last 20 min at race pace", 125],
  ["Race sim: Long ride 4:30 at race effort + Run 0:45 off the bike", 315],
  ["Long run 2:10 — middle 0:50 at race pace", 130],
  ["Bike 1:30 — 3x15min at race effort", 90],
  ["Run 1:30 — 4x8min at race pace", 90],
  ["Bike 0:45 with 3x3min at race effort", 45],
  ["Bike 0:30 EZ + 3x1min at race effort", 30],
  ["Long run 0:35 EZ with the last 20 min at race pace", 35],
  ["Race day — IRONMAN Texas", 780],
  ["Long swim 1:00 steady — open water if possible", 60],
  ["Long session 2:00 EZ", 120],
];
for (const [text, min] of texts) {
  const sport = sportOf(text);
  const s = { id: "x", date: "2027-01-01", dayIndex: 0, min, sport, title: "", detail: "", text, intensity: intensityOf(text), why: "", status: "planned" } as unknown as Session;
  const w = workoutFor(s);
  console.log(`\n### "${text}" (${min} min)  sport=${sport} intensity=${intensityOf(text)}`);
  console.log("   segments sum =", w.segments.reduce((a, g) => a + g.min, 0), "min");
  w.steps.forEach((st) => console.log("   - " + st));
}
