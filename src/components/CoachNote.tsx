// Renders a coach note with the facts emphasised: quantities (times, distances, heart rate, paces, %)
// and outcome phrases ("no run recorded", "missed", "instead") come out bold; everything else stays regular.
import { plain } from "@/lib/data";

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

/** Inline markdown-lite: **bold** and [L1] citations; numbers are bolded only when the text has no bold of its own. */
function inline(text: string, keyBase: string) {
  if (!text.includes("**")) return text.split(RE).map((p, i) => (i % 2 === 1 ? <b key={`${keyBase}-${i}`}>{withCites(p, `${keyBase}b${i}`)}</b> : <span key={`${keyBase}-${i}`}>{withCites(p, `${keyBase}s${i}`)}</span>));
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <b key={`${keyBase}-${i}`}>{withCites(p, `${keyBase}b${i}`)}</b> : <span key={`${keyBase}-${i}`}>{withCites(p, `${keyBase}s${i}`)}</span>));
}

/** A coach answer as blocks: short paragraphs and bullet lists ("- " lines), the way the coach is told to write. */
export function CoachText({ text, className }: { text: string; className?: string }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  // the model sometimes writes long dashes; the app never shows them
  for (const raw of plain(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) { if (last?.kind === "ul") last.lines.push(bullet[1]); else blocks.push({ kind: "ul", lines: [bullet[1]] }); }
    else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className={`coach-text${className ? ` ${className}` : ""}`}>
      {blocks.map((b, i) => (b.kind === "ul" ? <ul key={i}>{b.lines.map((l, j) => <li key={j}>{inline(l, `${i}-${j}`)}</li>)}</ul> : <p key={i}>{inline(b.lines[0], `${i}`)}</p>))}
    </div>
  );
}
