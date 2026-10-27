// The reference library the coach reads before answering: search over short sourced passages. Works without a
// database (the bundled passages) and merges rows the admin adds in Supabase (table `library`).
export interface Passage {
  id: string;
  title: string;
  topic: "training" | "metrics" | "nutrition" | "recovery" | "injury" | "race" | "environment" | "equipment";
  grade: "A" | "B" | "C";
  tags: string[];
  body: string;
  source: string;
  url: string | null;
}
import type { Citation } from "./types";
export type { Citation };

// Plain words athletes use → the words the passages use.
const SYNONYMS: Record<string, string[]> = {
  cooked: ["fatigue", "tired"], wrecked: ["fatigue", "tired"], smashed: ["fatigue", "tired"], dead: ["fatigue", "tired"], knackered: ["fatigue", "tired"], exhausted: ["fatigue", "overtraining"],
  bonk: ["carbs", "glycogen", "fuel"], bonked: ["carbs", "glycogen", "fuel"], wall: ["carbs", "glycogen", "fuel"], empty: ["carbs", "fuel"], hungry: ["carbs", "fuel", "calories"],
  ticker: ["heart rate"], hr: ["heart rate"], bpm: ["heart rate"], pulse: ["heart rate"],
  cramp: ["cramp"], cramps: ["cramp"], cramped: ["cramp"], seized: ["cramp"],
  sick: ["ill", "cold", "fever"], ill: ["sick", "cold", "fever"], flu: ["sick", "fever"], cold: ["sick", "fever", "winter"], covid: ["sick", "fever"], cough: ["sick"],
  hot: ["heat"], humid: ["heat"], heatwave: ["heat"], sweaty: ["heat", "sweat"],
  rain: ["indoor", "treadmill", "trainer"], raining: ["indoor", "treadmill", "trainer"], zwift: ["trainer", "indoor"], turbo: ["trainer", "indoor"],
  ride: ["bike"], rides: ["bike"], cycling: ["bike"], cycle: ["bike"], spin: ["bike"],
  jog: ["run"], jogging: ["run"], running: ["run"], runs: ["run"],
  swimming: ["swim"], swims: ["swim"], pool: ["swim"],
  gym: ["strength"], weights: ["strength"], lifting: ["strength"], squats: ["strength"],
  gels: ["carbs", "gel"], gel: ["carbs"], fuel: ["carbs"], fueling: ["carbs"], fuelling: ["carbs"], eat: ["carbs", "before", "after"], food: ["carbs", "calories"],
  water: ["hydration", "fluid"], drink: ["hydration", "fluid"], drinking: ["hydration", "fluid", "alcohol"], thirsty: ["hydration"], salt: ["sodium"], electrolytes: ["sodium"],
  beer: ["alcohol"], wine: ["alcohol"], drinks: ["alcohol"],
  sleep: ["sleep"], slept: ["sleep"], insomnia: ["sleep"], nap: ["sleep"],
  knee: ["knee", "injury"], knees: ["knee", "injury"], shin: ["shin", "injury"], shins: ["shin", "injury"], achilles: ["achilles", "injury"], calf: ["calf", "cramp"], hamstring: ["hamstring", "cramp"], shoulder: ["shoulder"],
  hurts: ["pain", "injury"], hurt: ["pain", "injury"], sore: ["sore", "doms"], ache: ["pain", "sore"], niggle: ["pain", "injury"],
  missed: ["missed"], skipped: ["missed"], skip: ["missed"], holiday: ["missed", "travel"], vacation: ["missed", "travel"], travelling: ["travel", "jet lag"], flight: ["jet lag", "travel"],
  taper: ["taper"], tapering: ["taper"], peaking: ["taper"],
  tt: ["test", "time trial"], test: ["test"], zones: ["zones"], zone: ["zones"], threshold: ["threshold", "lthr", "ftp"],
  watts: ["power", "ftp"], power: ["power", "ftp"], ftp: ["ftp"], vo2: ["vo2max"], vo2max: ["vo2max"],
  fitness: ["fitness", "load"], form: ["form", "load"], load: ["load"], tss: ["load"], ctl: ["load"],
  stress: ["stress"], stressed: ["stress"], busy: ["stress", "work"], deadline: ["stress", "work"], exams: ["stress"],
  realistic: ["goal time", "prediction"], prediction: ["goal time", "prediction"], predict: ["goal time", "prediction"],
  ironman: ["140.6", "long ride", "race"], "140.6": ["long ride", "ironman"], "70.3": ["half", "tune up"], half: ["70.3"], marathon: ["marathon", "long run"],
  drafting: ["drafting", "draft zone"], draft: ["drafting"], wetsuit: ["wetsuit", "open water"], lake: ["open water"], ocean: ["open water"], sea: ["open water"],
  shoes: ["shoes"], shoe: ["shoes"], trainers: ["shoes"], saddle: ["saddle", "bike fit"], numb: ["numb hands", "bike fit"], aero: ["aero"], wheels: ["aero", "wheels"],
  supplement: ["supplements"], supplements: ["supplements"], vitamins: ["supplements"], caffeine: ["caffeine"], coffee: ["caffeine"], creatine: ["creatine", "supplements"], beetroot: ["nitrate", "supplements"], iron: ["iron", "supplements"],
  weight: ["weight loss", "race weight"], fat: ["weight loss", "body fat"], diet: ["daily carbs", "diet"], calories: ["calories", "daily carbs"], keto: ["low carb"], carbs: ["carbs"], protein: ["protein"],
  foam: ["foam roll"], roller: ["foam roll"], massage: ["massage"], sauna: ["sauna", "heat"], ice: ["ice bath", "cold plunge"], compression: ["compression"], stretching: ["stretching"],
  recovery: ["recovery", "recovery week"], rest: ["recovery", "rest"], easy: ["easy", "zone 2", "intensity"],
  brick: ["brick"], double: ["double", "two sessions"], twice: ["double", "two sessions"],
  cadence: ["cadence"], stride: ["cadence"], drift: ["drift", "decoupling"], decoupling: ["drift", "decoupling"], hrv: ["hrv"], rhr: ["resting heart rate"], readiness: ["readiness", "hrv"],
  pace: ["pace", "pacing"], pacing: ["pacing"], split: ["negative split", "pacing"], strategy: ["pacing", "strategy"],
  jet: ["jet lag"], lag: ["jet lag"], altitude: ["altitude"],
  treadmill: ["treadmill", "indoor"], indoor: ["indoor"], indoors: ["indoor"],
  tune: ["tune up"], "tune-up": ["tune up"], practice: ["tune up", "practice race"],
  overtrained: ["overtraining"], overtraining: ["overtraining"], burnout: ["overtraining"], plateau: ["plateau", "overtraining"], slower: ["getting slower", "overtraining"],
  high: ["high", "elevated"], racing: ["racing heart", "race"],
};

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "it", "my", "me", "i", "am", "are", "was", "be", "do", "does", "did", "how", "what", "why", "when", "can", "should", "with", "this", "that", "today", "tomorrow", "week", "session", "sessions", "workout", "training", "train", "plan", "coach", "about", "have", "has", "had", "at", "so", "too", "very", "really", "just", "much", "more", "less", "than", "if", "get", "got", "feel", "feeling", "felt", "after", "before", "during"]);

/** Words of a question, with the athlete's phrasing mapped to the library's. */
export function queryTerms(q: string): string[] {
  const raw = q.toLowerCase().replace(/[^a-z0-9.' ]+/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (const w0 of raw) {
    const w = w0.replace(/^'|'$/g, "");
    if (!w || STOP.has(w)) continue;
    out.add(w);
    for (const s of SYNONYMS[w] ?? []) out.add(s);
    if (w.length > 4 && w.endsWith("s")) out.add(w.slice(0, -1));
    if (w.length > 5 && w.endsWith("ing")) out.add(w.slice(0, -3));
  }
  return [...out];
}

/** The n passages most relevant to the question; empty when nothing scores. */
export function searchLibrary(question: string, passages: Passage[], n = 4, opts: { sport?: string | null } = {}): Passage[] {
  const terms = queryTerms(question);
  if (!terms.length) return [];
  const scored = passages.map((p) => {
    const title = p.title.toLowerCase(), tags = p.tags.map((t) => t.toLowerCase()), body = p.body.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (t.length < 3) continue;
      if (tags.some((g) => g === t)) score += 4;
      else if (tags.some((g) => g.includes(t))) score += 2.5;
      if (title.includes(t)) score += 3;
      const hits = body.split(t).length - 1;
      if (hits) score += Math.min(3, hits) * 0.8;
    }
    if (opts.sport && (p.tags.includes(opts.sport) || title.includes(opts.sport))) score += 1;
    return { p, score };
  }).filter((x) => x.score >= 5).sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.p);
}

/** The text block the model reads, with [L1]… labels, and the citation list to show under the answer. */
export function referenceBlock(found: Passage[]): { text: string; citations: Citation[] } {
  const citations = found.map((p, i) => ({ n: i + 1, id: p.id, title: p.title, source: p.source, url: p.url }));
  const text = found.map((p, i) => `[L${i + 1}] ${p.title} (evidence ${p.grade}; ${p.source})\n${p.body}`).join("\n\n");
  return { text, citations };
}

/** Which citations an answer actually used ([L2] markers), in order of first use. */
export function usedCitations(text: string, citations: Citation[]): Citation[] {
  const seen: number[] = [];
  for (const m of text.matchAll(/\[L(\d)\]/g)) { const n = Number(m[1]); if (!seen.includes(n)) seen.push(n); }
  return seen.map((n) => citations.find((c) => c.n === n)).filter((c): c is Citation => !!c);
}
