// Turns a plan session's text into a structured workout: warm-up, main set / intervals, cool-down,
// each with a duration, a zone and a target pace. Drives the session panel on the Plan page.
import type { Session, Sport } from "./data";
import { ATHLETE } from "./config";
export type Zones = Record<string, Record<string, string>>;

export type Zone = 1 | 2 | 3 | 4 | 5;
export interface Segment { label: string; min: number; zone: Zone; target: string; kind: "warmup" | "main" | "interval" | "recovery" | "cooldown" | "drill" | "test" | "strength"; part?: "AM" | "PM" }
export interface Workout { segments: Segment[]; steps: string[]; sport: Sport; note?: string }

const ZONE_LABEL: Record<Zone, string> = { 1: "Z1 · very easy", 2: "Z2 · easy", 3: "Z3 · tempo", 4: "Z4 · threshold", 5: "Z5 · max" };
export const zoneName = (z: Zone) => ZONE_LABEL[z];

/** Target pace / speed text for a zone in a sport, from the athlete's provisional zones. */
export function targetFor(sport: Sport, z: Zone, zonesAll: Zones = ATHLETE.zones): string {
  const sp = sport === "brick" ? "bike" : sport;
  const zones = zonesAll[sp];
  if (!zones) return z <= 2 ? "easy" : z === 3 ? "moderately hard" : "hard";
  const unit = sp === "bike" ? "" : sp === "swim" ? " /100 yd" : " /mi";
  const slow = (range: string) => { // Z1: 8% slower than Z2 for pace sports, 10% lower for bike
    const m = range.match(/(\d+):(\d+)\s*[–-]\s*(\d+):(\d+)/);
    if (m) { const lo = (+m[1] * 60 + +m[2]) * 1.08, hi = (+m[3] * 60 + +m[4]) * 1.08; const f = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`; return `${f(lo)} – ${f(hi)}`; }
    const b = range.match(/([\d.]+)\s*[–-]\s*([\d.]+)\s*mph/);
    if (b) return `${(+b[1] * 0.9).toFixed(0)} – ${(+b[2] * 0.9).toFixed(0)} mph`;
    return range;
  };
  if (z === 1) return slow(zones["Zone 2"]) + unit;
  if (z === 2) return (zones["Zone 2"] ?? zones["Aerobic"]) + unit;
  if (z === 3) return zones["Tempo"] + unit;
  if (z === 4) return zones["Intervals"] + unit;
  return sp === "bike" ? "max effort" : "max effort";
}

const swimSecPer100 = (zones: Zones = ATHLETE.zones) => { const m = (zones.swim?.["Aerobic"] ?? "2:00 – 2:10").match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 125; };

function parsePart(text: string, sport: Sport, totalMin: number, part?: "AM" | "PM", zones: Zones = ATHLETE.zones): Segment[] {
  const t = text.toLowerCase();
  const seg = (label: string, min: number, zone: Zone, kind: Segment["kind"]): Segment => ({ label, min: Math.max(1, Math.round(min)), zone, target: kind === "strength" ? "bodyweight / light load" : kind === "drill" ? "technique focus" : targetFor(sport, zone, zones), kind, part });
  const out: Segment[] = [];
  if (sport === "rest") return out;
  if (sport === "strength" || /^strength|^bodyweight/.test(t)) return [seg("Strength & core", totalMin, 2, "strength")];

  // intervals: "6x20s strides", "3x3min Tempo", "8x50 drill/swim", "4x100 smooth", "5x200 steady"
  const iv = t.match(/(\d+)\s*x\s*(\d+)\s*(s\b|sec|min|m\b|yd)?\s*([a-z\/ ]*)/);
  const incl = t.match(/(?:incl\.?|including)?\s*(\d+)\s*min\s*(tempo|threshold)/);
  const test = /field test|time trial|all-out/.test(t);
  const tempoSteady = /steady|continuous/.test(t);
  const wu = Math.min(15, Math.max(5, Math.round(totalMin * 0.15)));
  const cd = Math.min(10, Math.max(3, Math.round(totalMin * 0.1)));

  if (test) {
    const testMin = (() => { const m = t.match(/(\d+)\s*min/); return m ? +m[1] : Math.round(totalMin * 0.5); })();
    out.push(seg("Warm-up", Math.max(5, totalMin - testMin - cd), 2, "warmup"));
    out.push(seg(/swim/.test(t) ? "400 yd all-out" : `${testMin}-min threshold test`, testMin, 4, "test"));
    out.push(seg("Cool-down", cd, 1, "cooldown"));
    return out;
  }
  if (iv) {
    const reps = +iv[1], n = +iv[2], unit = iv[3] ?? (sport === "swim" ? "yd" : "min"), desc = (iv[4] ?? "").trim();
    const isTime = /^s|sec|min/.test(unit);
    const repMin = isTime ? (unit.startsWith("s") ? n / 60 : n) : sport === "swim" ? (n / 100) * (swimSecPer100(zones) / 60) : n;
    const hard = /stride|pickup|tempo|fast|hard/.test(desc);
    const zone: Zone = /stride/.test(desc) ? 4 : /tempo|pickup|hard/.test(desc) ? 3 : /fast cadence/.test(desc) ? 2 : /drill/.test(desc) ? 2 : 2;
    const recMin = hard ? (unit.startsWith("s") ? 1 : Math.max(1, Math.round(repMin / 2))) : sport === "swim" ? 0.33 : 1;
    const setMin = reps * (repMin + recMin);
    const label = isTime ? `${reps} × ${n}${unit.startsWith("s") ? " s" : " min"} ${desc || (zone >= 3 ? "tempo" : "steady")}` : `${reps} × ${n} ${sport === "swim" ? "yd" : unit} ${desc || "steady"}`;
    const mainMin = Math.max(0, totalMin - wu - cd - setMin);
    out.push(seg("Warm-up", wu, sport === "swim" ? 2 : 1, "warmup"));
    if (mainMin > 3 && /ez|easy|steady/.test(t) && !/drill/.test(desc)) out.push(seg(sport === "run" ? "Easy run" : sport === "bike" ? "Easy ride" : "Easy swim", mainMin, 2, "main"));
    for (let i = 0; i < reps; i++) {
      out.push(seg(i === 0 ? label : `Rep ${i + 1}`, repMin, /drill/.test(desc) ? 2 : zone, /drill/.test(desc) ? "drill" : "interval"));
      if (i < reps - 1 && recMin >= 0.3) out.push(seg("Recover", recMin, 1, "recovery"));
    }
    if (mainMin > 3 && !(/ez|easy|steady/.test(t) && !/drill/.test(desc))) out.push(/drill/.test(t) ? seg("Drills + steady", mainMin, 2, "drill") : seg("Steady", mainMin, 2, "main"));
    out.push(seg("Cool-down", cd, 1, "cooldown"));
    return out;
  }
  if (incl) {
    const tm = +incl[1];
    const rest = Math.max(0, totalMin - wu - tm - cd);
    out.push(seg("Warm-up", wu, 1, "warmup"));
    out.push(seg("Easy", Math.round(rest * 0.6), 2, "main"));
    out.push(seg(`${tm} min tempo`, tm, 3, "interval"));
    out.push(seg("Easy", Math.max(0, rest - Math.round(rest * 0.6)), 2, "main"));
    out.push(seg("Cool-down", cd, 1, "cooldown"));
    return out.filter((s) => s.min > 0);
  }
  if (/technique|drill/.test(t) && sport === "swim") {
    out.push(seg("Warm-up", wu, 2, "warmup"));
    out.push(seg("Drills", Math.round((totalMin - wu - cd) * 0.6), 2, "drill"));
    out.push(seg("Smooth swim", totalMin - wu - cd - Math.round((totalMin - wu - cd) * 0.6), 2, "main"));
    out.push(seg("Cool-down", cd, 1, "cooldown"));
    return out;
  }
  // default: easy / long / steady
  out.push(seg("Warm-up", wu, 1, "warmup"));
  out.push(seg(tempoSteady ? "Steady" : sport === "run" ? "Easy run" : sport === "bike" ? "Easy ride" : sport === "swim" ? "Easy swim" : "Easy", totalMin - wu - cd, 2, "main"));
  out.push(seg("Cool-down", cd, 1, "cooldown"));
  return out;
}

export function workoutFor(s: Session, zones: Zones = ATHLETE.zones): Workout {
  const text = s.text.replace(/^(AM|PM):\s*/i, "");
  const parts = text.split(/\bPM:\s*/i);
  const segments: Segment[] = [];
  const steps: string[] = [];
  if (s.sport === "rest") return { segments, steps: ["No session. Optional 10 min mobility."], sport: s.sport };
  if (parts.length === 2) {
    const [am, pm] = parts;
    const amMin = (() => { const m = am.match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : Math.round(s.min * 0.7); })();
    const pmMin = Math.max(5, s.min - amMin);
    const amSport = guessSport(am), pmSport = guessSport(pm);
    segments.push(...parsePart(am, amSport, amMin, "AM", zones), ...parsePart(pm, pmSport, pmMin, "PM", zones));
  } else if (/\+\s*strength/i.test(text)) {
    const m = text.match(/strength\s*(\d+):(\d+)/i); const stMin = m ? +m[1] * 60 + +m[2] : 15;
    segments.push(...parsePart(text.split(/\+/)[0], s.sport === "brick" ? "swim" : s.sport, s.min - stMin, undefined, zones), ...parsePart("Strength", "strength", stMin, undefined, zones));
  } else {
    segments.push(...parsePart(text, s.sport, s.min, undefined, zones));
  }
  // human-readable steps (merge interval reps into one line)
  let i = 0;
  while (i < segments.length) {
    const g = segments[i];
    if (g.kind === "interval" || g.kind === "drill") {
      let reps = 1, j = i + 1;
      while (j < segments.length && (segments[j].kind === "recovery" || segments[j].kind === g.kind)) { if (segments[j].kind === g.kind) reps++; j++; }
      const rec = segments[i + 1]?.kind === "recovery" ? ` · ${fmtMin(segments[i + 1].min)} easy between` : "";
      steps.push(`${g.part ? g.part + " · " : ""}${g.label}${reps > 1 && !/×/.test(g.label) ? ` × ${reps}` : ""} — ${fmtMin(g.min)} each at ${g.target}${rec}`);
      i = j;
    } else {
      steps.push(`${g.part ? g.part + " · " : ""}${g.label} — ${fmtMin(g.min)} at ${g.target}`);
      i++;
    }
  }
  return { segments, steps, sport: s.sport, note: /fuel|eat|drink/i.test(text) ? text.match(/[—-]\s*([^—]*(?:fuel|eat|drink)[^—]*)$/i)?.[1]?.trim() : undefined };
}

function guessSport(t: string): Sport {
  const x = t.toLowerCase();
  if (/swim/.test(x)) return "swim";
  if (/bike|ride|spin/.test(x)) return "bike";
  if (/run/.test(x)) return "run";
  if (/strength|core/.test(x)) return "strength";
  return "other";
}
const fmtMin = (m: number) => (m < 1 ? `${Math.round(m * 60)} s` : m >= 60 ? `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")} h` : `${Math.round(m)} min`);
