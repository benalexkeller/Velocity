"use client";
// Two-date range picker, the way a flight site does it: click a start day, click an end day, the span lights up.
// Two months side by side (one on a phone), only days up to `max` can be chosen. Values are YYYY-MM-DD.
import { useEffect, useRef, useState } from "react";
import { addDays, fromYmd, shortDate, ymd } from "@/lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const monthOf = (k: number) => new Date(Math.floor(k / 12), k % 12, 1);

export default function DateRangePicker({ from, to, max, onApply, onClose }: { from: string; to: string; max: string; onApply: (from: string, to: string) => void; onClose: () => void }) {
  const [a, setA] = useState<string | null>(from);
  const [b, setB] = useState<string | null>(to);
  const [hov, setHov] = useState<string | null>(null);
  const [first, setFirst] = useState(() => monthKey(fromYmd(to)) - 1); // the right-hand month holds the end date
  const [one, setOne] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 640px)"); const f = () => setOne(m.matches); f(); m.addEventListener("change", f);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener("keydown", esc); setTimeout(() => document.addEventListener("mousedown", out), 0);
    return () => { m.removeEventListener("change", f); window.removeEventListener("keydown", esc); document.removeEventListener("mousedown", out); };
  }, [onClose]);
  const pick = (d: string) => {
    if (a && !b) { if (d < a) { setB(a); setA(d); } else setB(d); } // second click closes the span
    else { setA(d); setB(null); } // first click (or a third) starts a new span
  };
  // the span shown: the chosen one, or start → hovered day while the end is still open
  const lo = a && !b && hov ? (hov < a ? hov : a) : a, hi = a && !b && hov ? (hov < a ? a : hov) : b;
  const months = one ? [first + 1] : [first, first + 1];
  const Month = ({ k }: { k: number }) => {
    const m0 = monthOf(k); const pad = (m0.getDay() + 6) % 7; const n = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
    return (
      <div className="drp-month">
        <div className="drp-title">{MONTHS[m0.getMonth()]} {m0.getFullYear()}</div>
        <div className="drp-grid">
          {DOW.map((d) => <span key={d} className="drp-dow">{d}</span>)}
          {Array.from({ length: pad }, (_, i) => <span key={"p" + i} />)}
          {Array.from({ length: n }, (_, i) => { const d = ymd(addDays(m0, i)); const off = d > max; const inSpan = lo && hi && d >= lo && d <= hi; const edge = d === lo || d === hi;
            return <button key={d} type="button" disabled={off} className={`drp-day${inSpan ? " in" : ""}${edge ? " edge" : ""}${d === max ? " today" : ""}`} onClick={() => pick(d)} onMouseEnter={() => setHov(d)} onMouseLeave={() => setHov(null)} aria-pressed={edge || undefined}>{i + 1}</button>; })}
        </div>
      </div>
    );
  };
  return (
    <div className="drp" ref={box} role="dialog" aria-label="Choose a date range">
      <div className="drp-nav">
        <button type="button" className="btn ghost small" onClick={() => setFirst((f) => f - 1)} aria-label="Earlier">‹</button>
        <span className="muted">{a ? `${shortDate(a)}${b ? ` to ${shortDate(b)}` : ", now pick the end day"}` : "Pick the first day"}</span>
        <button type="button" className="btn ghost small" onClick={() => setFirst((f) => Math.min(f + 1, monthKey(fromYmd(max)) - 1))} aria-label="Later">›</button>
      </div>
      <div className="drp-months">{months.map((k) => <Month key={k} k={k} />)}</div>
      <div className="drp-foot">
        <button type="button" className="btn ghost small" onClick={onClose}>Cancel</button>
        <button type="button" className="btn small" disabled={!a || !b} onClick={() => a && b && onApply(a, b)}>Apply</button>
      </div>
    </div>
  );
}
