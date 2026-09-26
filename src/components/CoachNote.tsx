// Renders a coach note with the facts emphasised: quantities (times, distances, heart rate, paces, %)
// and outcome phrases ("no run recorded", "missed", "instead") come out bold; everything else stays regular.
const QTY = String.raw`\d+(?:[.:]\d+)*\s?(?:-?\s?minutes?|-?\s?min\b|-?\s?hours?|\bh\b|mi\b|km\b|yd\b|m\b|bpm|mph|%|/mi|/100 ?yd|/km|/100 ?m|s/mi|ft|kg|lb|g/h|ml)`;
const PHRASES = ["no (?:run|ride|bike|swim|session|strength) recorded", "not recorded", "instead", "missed", "skipped", "on target", "faster than (?:target|planned)", "slower than (?:target|planned)", "too fast", "too slow", "cramp", "pain"];
const RE = new RegExp(`(${QTY}|${PHRASES.join("|")})`, "gi");

export function CoachNote({ text, className }: { text: string; className?: string }) {
  const parts = text.split(RE);
  return (
    <span className={className}>
      {parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))}
    </span>
  );
}
