// Renders a coach note with the facts emphasised: quantities (times, distances, heart rate, paces, %)
// and outcome phrases ("no run recorded", "missed", "instead") come out bold; everything else stays regular.
const QTY = String.raw`\d+(?:[.:]\d+)*\s?(?:-?\s?minutes?|-?\s?min\b|-?\s?hours?|\bh\b|mi\b|km\b|yd\b|m\b|bpm|mph|%|/mi|/100 ?yd|/km|/100 ?m|s/mi|ft|kg|lb|g/h|ml)`;
const PHRASES = ["no (?:run|ride|bike|swim|session|strength) recorded", "not recorded", "instead", "missed", "skipped", "on target", "faster than (?:target|planned)", "slower than (?:target|planned)", "too fast", "too slow", "cramp", "pain"];
const RE = new RegExp(`(${QTY}|${PHRASES.join("|")})`, "gi");

// Library citations ([L2]) become small superscript numbers that match the Sources list under the answer.
const CITE = /\[L(\d)\]/g;
function withCites(text: string, keyBase: string) {
  const out: React.ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(CITE)) {
    if (m.index! > last) out.push(<span key={`${keyBase}-t${k++}`}>{text.slice(last, m.index)}</span>);
    out.push(<sup key={`${keyBase}-c${k++}`} className="cite">{m[1]}</sup>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(<span key={`${keyBase}-e`}>{text.slice(last)}</span>);
  return out;
}

export function CoachNote({ text, className }: { text: string; className?: string }) {
  const parts = text.split(RE);
  return (
    <span className={className}>
      {parts.map((p, i) => (i % 2 === 1 ? <b key={i}>{withCites(p, `b${i}`)}</b> : <span key={i}>{withCites(p, `s${i}`)}</span>))}
    </span>
  );
}
