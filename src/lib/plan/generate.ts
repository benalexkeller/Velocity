// Rule-based plan generator: intake answers → week-by-week plan in the same JSON shape as the seed plan.
// Phases from the weeks left, hours from the athlete's current volume ramping to their maximum, long sessions
// on the days they said, quality sessions mid-week, recovery every fourth week, taper, race week.
import { distanceInfo } from "../athlete";
import type { PlanWeekJson } from "../data";
import { addDays, fromYmd, today, ymd } from "../format";
import { EMPTY_INTAKE, MIN_WEEKS, eventType, paceToSec, type Intake, type Kind } from "./intake";
import { RULES } from "./rules";

export interface PlanSummary { weeks: number; start: string; raceWeek: number; phases: { name: string; from: number; to: number }[]; peakHours: number; sessions: number; longest: { ride: number; run: number; swim: number }; hours: number[] }

type Phase = "base" | "build" | "peak" | "taper" | "race";
const hm = (h: number) => { const m = Math.round(h * 60 / 5) * 5; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
const mins = (h: number) => Math.round(h * 60 / 5) * 5;
const cap = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Longest session the plan will ask for, in hours, by event (rules.ts). */
function longCaps(type: Intake["goal"]["type"]) { return RULES.longCaps[type] ?? RULES.longCaps.other; }
/** Share of the weekly hours per discipline. */
function shares(type: Intake["goal"]["type"], kind: Kind) {
  if (kind === "tri") return RULES.triShares[type] ?? RULES.triShares.sprint;
  if (kind === "run") return { swim: 0, bike: 0, run: 1 };
  if (kind === "bike") return { swim: 0, bike: 1, run: 0 };
  if (kind === "swim") return { swim: 1, bike: 0, run: 0 };
  return { swim: 0, bike: 0, run: 0 };
}
/** The athlete's longest recent session per sport, in hours, from what they told us (their pace turns distance into time). */
export function statedLongest(intake: Intake, imperial: boolean) {
  const f = intake.fitness;
  const runPace = paceToSec(f.run_pace) ?? (imperial ? 600 : 372);          // s per mi | km
  const bikeSpeed = f.bike_speed && f.bike_speed > 0 ? f.bike_speed : imperial ? 16 : 26; // mph | km/h
  const swimPace = paceToSec(f.swim_pace_100) ?? 120;                       // s per 100
  return {
    run: f.run_longest ? (f.run_longest * runPace) / 3600 : 0,
    ride: f.bike_longest ? f.bike_longest / bikeSpeed : 0,
    swim: f.swim_longest ? ((f.swim_longest / 100) * swimPace) / 3600 : 0,
  };
}

interface Slot { day: number; role: "long1" | "long2" | "q1" | "q2" | "easy"; sport: "swim" | "bike" | "run" | "other" }

/** Which days carry which session, from the available days and where the long sessions go. */
function layout(kind: Kind, days: number[], longWeekend: boolean): Slot[] {
  // days: 0 = Mon … 6 = Sun, sorted; at least one rest day
  let avail = [...days].sort((a, b) => a - b);
  if (avail.length === 7) avail = avail.filter((d) => d !== 0);
  if (!avail.length) avail = [1, 3, 5];
  const weekend = avail.filter((d) => d >= 5), weekdays = avail.filter((d) => d < 5);
  const slots: Slot[] = [];
  const used = new Set<number>();
  const take = (d: number, role: Slot["role"], sport: Slot["sport"]) => { slots.push({ day: d, role, sport }); used.add(d); };
  const lastFree = () => [...avail].reverse().find((d) => !used.has(d));
  const primary: Slot["sport"] = kind === "tri" ? "bike" : kind === "run" ? "run" : kind === "bike" ? "bike" : kind === "swim" ? "swim" : "other";
  // long sessions
  if (kind === "tri") {
    if (longWeekend && weekend.length === 2) { take(5, "long1", "bike"); take(6, "long2", "run"); }
    else if (longWeekend && weekend.length === 1) { take(weekend[0], "long1", "bike"); const d = lastFree(); if (d != null) take(d, "long2", "run"); }
    else { const a = lastFree(); if (a != null) take(a, "long1", "bike"); const b = lastFree(); if (b != null) take(b, "long2", "run"); }
  } else {
    const d = longWeekend && weekend.length ? weekend[weekend.length - 1] : lastFree();
    if (d != null) take(d, "long1", primary);
  }
  // quality sessions: spaced out among what is left, never next to each other when avoidable
  const free = () => avail.filter((d) => !used.has(d));
  const pick = (pref: number[]) => { const f = free(); return pref.find((d) => f.includes(d)) ?? f[0]; };
  if (kind === "tri") {
    const q1 = pick([1, 2, 0, 3, 4]); if (q1 != null) take(q1, "q1", "bike");
    const q2 = pick([3, 2, 1, 4, 0].filter((d) => Math.abs(d - (q1 ?? -9)) > 1)); if (q2 != null) take(q2, "q2", "run");
    // swims fill the rest, then an extra easy run/bike if days remain
    const rest = free();
    rest.forEach((d, i) => take(d, "easy", i < 2 ? "swim" : i % 2 ? "bike" : "run"));
  } else {
    const q1 = pick([2, 1, 3, 0, 4]); if (q1 != null) take(q1, "q1", primary);
    if (free().length >= 3) { const q2 = pick([4, 0, 1, 3].filter((d) => Math.abs(d - (q1 ?? -9)) > 1)); if (q2 != null) take(q2, "q2", primary); }
    free().forEach((d) => take(d, "easy", primary));
  }
  void weekdays;
  return slots.sort((a, b) => a.day - b.day);
}

function phaseOf(N: number): { phases: Phase[]; names: string[]; recovery: boolean[] } {
  const taper = N >= 16 ? 2 : 1;
  const R = N - 1 - taper;
  const peak = R >= 8 ? 2 : R >= 5 ? 1 : 0;
  const build = Math.max(R - peak >= 2 ? 1 : 0, Math.round((R - peak) * 0.45));
  const base = R - peak - build;
  const phases: Phase[] = [...Array<Phase>(base).fill("base"), ...Array<Phase>(build).fill("build"), ...Array<Phase>(peak).fill("peak"), ...Array<Phase>(taper).fill("taper"), "race"];
  const names = phases.map((p, i) => {
    if (p === "base") { const k = base >= 9 ? 3 : base >= 5 ? 2 : 1; const part = Math.min(k, Math.floor((i / base) * k) + 1); return k === 1 ? "Base — Aerobic foundation" : ["Base 1 — Foundation", "Base 2 — Aerobic development", "Base 3 — Endurance"][part - 1]; }
    if (p === "build") { const j = i - base; const k = build >= 6 ? 2 : 1; const part = Math.min(k, Math.floor((j / build) * k) + 1); return k === 1 ? "Build — Race-specific" : ["Build 1 — Race-specific", "Build 2 — Intensity"][part - 1]; }
    if (p === "peak") return "Peak — Race simulation";
    if (p === "taper") return "Taper — Freshen up";
    return "Race week";
  });
  const recovery = phases.map((p, i) => (p === "base" || p === "build") && i > 0 && (i + 1) % RULES.recoveryEvery === 0 && phases[i + 1] !== "peak");
  return { phases, names, recovery };
}

export function planStart(t: Date = today()) {
  const dow = (t.getDay() + 6) % 7; // 0 = Mon
  const mon = addDays(t, -dow);
  return dow <= 3 ? mon : addDays(mon, 7);
}
export function weeksUntil(raceDate: string, t: Date = today()) {
  const start = planStart(t);
  const race = fromYmd(raceDate);
  const raceMon = addDays(race, -((race.getDay() + 6) % 7));
  return Math.round((raceMon.getTime() - start.getTime()) / (7 * 86400000)) + 1;
}

export function generatePlan(intakeIn: Partial<Intake>, t: Date = today(), imperial = true): { weeks: PlanWeekJson[]; summary: PlanSummary } {
  const intake: Intake = { ...EMPTY_INTAKE, ...intakeIn, goal: { ...EMPTY_INTAKE.goal, ...intakeIn.goal }, history: { ...EMPTY_INTAKE.history, ...intakeIn.history }, fitness: { ...EMPTY_INTAKE.fitness, ...intakeIn.fitness }, time: { ...EMPTY_INTAKE.time, ...intakeIn.time } };
  const et = eventType(intake.goal.type);
  const kind = et.kind;
  const start = planStart(t);
  const N = Math.max(MIN_WEEKS, weeksUntil(intake.goal.date, t));
  const { phases, names, recovery } = phaseOf(N);
  const caps = longCaps(intake.goal.type);
  const sh = shares(intake.goal.type, kind);
  const maxH = cap(intake.time.max_hours || 8, 2, 30);
  const hist = intake.history.hours;
  const nowH = hist.swim + hist.bike + hist.run;
  const startH = cap(nowH > 0 ? nowH : maxH * 0.5, 2, maxH);
  const days = intake.time.days.map((d) => (d + 6) % 7); // profile days (0 = Sun) → 0 = Mon
  const slots = layout(kind, days, intake.time.long_weekend);
  const B = phases.filter((p) => p === "base" || p === "build").length;
  const raceHours = intake.goal.target_hours ?? distanceInfo(intake.goal.type).hours;
  const blackout = (date: string) => intake.time.blackouts.some((b) => b.from && b.to && date >= b.from && date <= b.to);
  const todayS = ymd(t);

  // weekly hours: ramp from now to the maximum through base + build, at most +10 %/week, recovery weeks lighter
  const hours: number[] = [];
  let ref = startH;
  for (let i = 0; i < N; i++) {
    const p = phases[i];
    if (p === "base" || p === "build") {
      const lin = B <= 1 ? maxH : startH + (maxH - startH) * (i / (B - 1));
      ref = i === 0 ? startH : Math.min(lin, ref * (1 + RULES.weeklyRamp) + 0.3);
      hours.push(recovery[i] ? ref * RULES.recoveryFactor : ref);
    } else if (p === "peak") hours.push(maxH);
    else if (p === "taper") { const tapers = phases.filter((x) => x === "taper").length; const j = i - phases.indexOf("taper"); hours.push(maxH * (tapers === 2 ? RULES.taperTwoWeeks[j] : RULES.taperOneWeek)); }
    else hours.push(maxH * RULES.raceWeekFactor);
  }

  const weeks: PlanWeekJson[] = [];
  let sessions = 0;
  const longest = { ride: 0, run: 0, swim: 0 };
  // no long session more than 10 % over the longest of the previous 30 days; the athlete's stated longest sessions seed it
  const seed = statedLongest(intake, imperial);
  const history: Record<"bike" | "run" | "swim" | "other", number[]> = { bike: seed.ride ? [seed.ride] : [], run: seed.run ? [seed.run] : [], swim: seed.swim ? [seed.swim] : [], other: [] };
  const allowed = (sport: "bike" | "run" | "swim" | "other", want: number) => { const recent = history[sport].slice(-RULES.sessionWindowWeeks); const prev = recent.length ? Math.max(...recent) : 0; return prev > 0 ? Math.min(want, prev * (1 + RULES.sessionStep)) : want; };
  for (let i = 0; i < N; i++) {
    const p = phases[i];
    const H = hours[i];
    const wkStart = addDays(start, i * 7);
    const days7: { text: string; min: number }[] = Array.from({ length: 7 }, () => ({ text: "Rest", min: 0 }));
    // how far into the plan: long sessions grow from ~50 % of their cap to 100 % by the end of build
    const prog = p === "base" || p === "build" ? 0.5 + 0.5 * (B <= 1 ? 1 : i / (B - 1)) : p === "peak" ? 1 : p === "taper" ? 0.55 : 0.3;
    const isRaceWeek = p === "race";
    const raceDate = intake.goal.date;
    const disciplineH = { swim: H * sh.swim, bike: H * sh.bike, run: H * sh.run, other: kind === "other" ? H : 0 };
    const count = (s: Slot["sport"]) => slots.filter((x) => x.sport === s).length;
    const week: Record<number, { text: string; min: number }> = {};
    const strengthDays = new Set<number>();
    if (intake.strength) { const easy = slots.filter((s) => s.role === "easy" || s.role === "q1").map((s) => s.day); easy.slice(0, 2).forEach((d) => strengthDays.add(d)); }
    const isRec = recovery[i];

    for (const s of slots) {
      const date = ymd(addDays(wkStart, s.day));
      if (blackout(date)) { week[s.day] = { text: "Rest — away", min: 0 }; continue; }
      if (isRaceWeek && date >= raceDate) continue; // race day and after are set below
      const D = disciplineH[s.sport];
      const n = count(s.sport) || 1;
      let h = 0, text = "";
      const longShare = kind === "tri" ? (s.sport === "bike" ? 0.62 : s.sport === "run" ? 0.5 : 0.45) : 0.42;
      const capOf = s.sport === "bike" ? caps.ride : s.sport === "run" ? caps.run : s.sport === "swim" ? caps.swim : 2;
      const longH = (share: number) => cap(Math.min(capOf * prog, D * share), 0.5, capOf);
      const otherH = () => { const longs = slots.filter((x) => x.sport === s.sport && (x.role === "long1" || x.role === "long2")).length; const rest = Math.max(0, D - longs * Math.min(capOf * prog, D * longShare)); const k = n - longs; return cap(k > 0 ? rest / k : 0, 0.5, s.sport === "swim" ? 1.25 : 1.5); };
      const race = et.kind === "tri";
      if (s.role === "long1" || s.role === "long2") {
        h = longH(longShare);
        if (isRaceWeek) { h = 0.5; }
        else if (p === "taper") h = cap(capOf * 0.5 * (phases.indexOf("taper") === i ? 1 : 0.7), 0.5, capOf);
        else h = Math.max(0.5, allowed(s.sport, h));
        if (s.sport === "bike") {
          const brick = race && (p === "build" || p === "peak") && !isRec;
          const runOff = p === "peak" ? Math.min(0.75, 0.15 * h + 0.25) : 0.33;
          text = p === "peak" && !isRec ? `Race sim: Long ride ${hm(h)} at race effort + Run ${hm(runOff)} off the bike` : brick ? `Brick: Long ride ${hm(h)} EZ + Run ${hm(runOff)} off the bike` : `Long ride ${hm(h)} EZ`;
          if (brick || (p === "peak" && !isRec)) h += runOff;
          longest.ride = Math.max(longest.ride, h);
        } else if (s.sport === "run") {
          text = p === "build" && !isRec ? `Long run ${hm(h)} EZ with the last 20 min at race pace` : p === "peak" && !isRec ? `Long run ${hm(h)} — middle ${hm(Math.max(0.33, h * 0.4))} at race pace` : `Long run ${hm(h)} EZ`;
          longest.run = Math.max(longest.run, h);
        } else if (s.sport === "swim") { text = `Long swim ${hm(h)} steady${p === "peak" ? " — open water if possible" : ""}`; longest.swim = Math.max(longest.swim, h); }
        else text = `Long session ${hm(h)} EZ`;
      } else if (s.role === "q1" || s.role === "q2") {
        h = otherH();
        if (isRaceWeek) h = Math.min(h, 0.5);
        if (p === "taper") h = Math.min(h, 0.75);
        const sp = s.sport === "bike" ? "Bike" : s.sport === "run" ? "Run" : s.sport === "swim" ? "Swim" : "Session";
        if (p === "base" || isRec) text = s.sport === "run" ? `Run ${hm(h)} EZ + 6x20s strides` : s.sport === "bike" ? `Bike ${hm(h)} EZ + 3x1min fast cadence` : s.sport === "swim" ? `Swim ${hm(h)} — drills + 6x100 smooth` : `Session ${hm(h)} EZ`;
        else if (p === "build") text = s.role === "q1" ? `${sp} ${hm(h)} tempo — 3x${s.sport === "bike" ? "10" : "8"}min at threshold` : `${sp} ${hm(h)} intervals — 5x${s.sport === "bike" ? "4" : "3"}min hard, 3min easy`;
        else if (p === "peak") text = `${sp} ${hm(h)} — ${s.sport === "bike" ? "3x15min at race effort" : s.sport === "run" ? "4x8min at race pace" : "8x100 at race pace"}`;
        else if (p === "taper") text = `${sp} ${hm(h)} with 3x3min at race effort`;
        else text = `${sp} ${hm(h)} EZ + 3x1min at race effort`;
      } else {
        h = otherH();
        if (isRaceWeek) h = Math.min(h, 0.4);
        if (p === "taper") h = Math.min(h, 0.75);
        text = s.sport === "swim" ? (p === "base" ? `Swim ${hm(h)} — technique + 4x100 smooth` : `Swim ${hm(h)} — 10x100 at threshold pace`) : s.sport === "bike" ? `Bike ${hm(h)} EZ` : s.sport === "run" ? `Run ${hm(h)} EZ` : `Session ${hm(h)} EZ`;
      }
      let min = mins(h);
      if (strengthDays.has(s.day) && !isRaceWeek && p !== "taper") { text += " + Strength 0:20 (squats, lunges, hinges, planks)"; min += 20; }
      week[s.day] = { text, min };
    }
    // race week: race day, easy days before, rest after
    if (isRaceWeek) {
      for (let d = 0; d < 7; d++) {
        const date = ymd(addDays(wkStart, d));
        if (date === raceDate) week[d] = { text: `Race day — ${intake.goal.event || et.label}`, min: mins(raceHours) };
        else if (date > raceDate) week[d] = { text: "Rest", min: 0 };
        else if (date === ymd(addDays(fromYmd(raceDate), -1))) week[d] = { text: kind === "tri" || kind === "bike" ? "Rest — bike check, bag check, early night" : "Rest — gear check, early night", min: 0 };
      }
    }
    for (let d = 0; d < 7; d++) {
      const date = ymd(addDays(wkStart, d));
      if (date < todayS) { days7[d] = { text: "Rest", min: 0 }; continue; } // already passed
      if (week[d]) days7[d] = week[d];
    }
    // remember this week's longest session per sport for the step rule
    for (const sp of ["bike", "run", "swim", "other"] as const) {
      const m = Math.max(0, ...slots.filter((x) => x.sport === sp).map((x) => { const e = week[x.day]; if (!e || (isRaceWeek && /^Race day/.test(e.text))) return 0; const run = sp === "bike" ? (e.text.match(/Run (\d+):(\d+) off the bike/) ?? null) : null; return e.min / 60 - (run ? (+run[1] + +run[2] / 60) : 0) - (/Strength 0:20/.test(e.text) ? 20 / 60 : 0); }));
      if (m > 0) history[sp].push(m); else if (history[sp].length) history[sp].push(history[sp][history[sp].length - 1]);
    }
    sessions += days7.filter((d) => d.min > 0 && !/^Race day/.test(d.text)).length;
    const long1 = slots.find((s) => s.role === "long1"), long2 = slots.find((s) => s.role === "long2");
    const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const focus = isRaceWeek ? `Race ${raceDate} · ${hm(raceHours)} planned · short openers, then rest` : `${names[i].split(" — ")[0]}${isRec ? " · recovery week" : ""} · ${H.toFixed(1)} h${long1 ? ` · long ${long1.sport === "bike" ? "ride" : long1.sport === "run" ? "run" : long1.sport === "swim" ? "swim" : "session"} ${dayName[long1.day]}` : ""}${long2 ? ` · long run ${dayName[long2.day]}` : ""}`;
    weeks.push({ week: i + 1, start: ymd(wkStart), phase: names[i], focus, recovery: isRec, race: isRaceWeek, days: days7 });
  }

  const phaseList: PlanSummary["phases"] = [];
  names.forEach((n, i) => { const last = phaseList[phaseList.length - 1]; if (last && last.name === n) last.to = i + 1; else phaseList.push({ name: n, from: i + 1, to: i + 1 }); });
  const summary: PlanSummary = { weeks: N, start: ymd(start), raceWeek: N, phases: phaseList, peakHours: Math.max(...hours), sessions, longest, hours };
  return { weeks, summary };
}
