"use client";
// A time or pace field that needs no colon key: tapping it opens scroll wheels (hours, minutes, seconds), like a
// phone's clock picker, and the chosen value shows in the field. Phone keyboards have no ":" on the number pad,
// so h:mm and m:ss can't be typed there; here they are scrolled. On a computer the wheels take the mouse wheel and
// the arrow keys, and the "or type" box takes 4:30 typed straight in.
//   parts "hm"  → hours and minutes (a race time)        value in seconds
//   parts "ms"  → minutes and seconds (a pace)            value in seconds
//   parts "hms" → hours, minutes, seconds (a duration)    value in seconds
// `inline` shows the wheels in place instead of behind a field.
import { useEffect, useRef, useState } from "react";

export type Parts = "hm" | "ms" | "hms";

/** 4:30 (hm) / 9:30 (ms) / 1:02:30 (hms) → seconds; null when it is not a time. */
export function parseClock(text: string, parts: Parts): number | null {
  const t = text.trim();
  if (!t) return null;
  const p = t.split(":").map((x) => (x === "" ? NaN : Number(x)));
  if (p.some((x) => !Number.isFinite(x) || x < 0)) return null;
  if (parts === "hm") return p.length === 2 ? p[0] * 3600 + p[1] * 60 : p.length === 1 ? p[0] * 3600 : p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : null;
  if (parts === "ms") return p.length === 2 ? p[0] * 60 + p[1] : p.length === 1 ? p[0] * 60 : null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p.length === 1 ? p[0] * 60 : null;
}
const two = (n: number) => String(n).padStart(2, "0");
/** seconds → "4:30" / "9:30" / "1:02:30" ("" for null). */
export function formatClock(seconds: number | null | undefined, parts: Parts): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (parts === "hm") { const mins = Math.round(s / 60); return `${Math.floor(mins / 60)}:${two(mins % 60)}`; }
  if (parts === "ms") return `${Math.floor(s / 60)}:${two(sec)}`;
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

const ITEM = 32; // px per row in a wheel
const POP_H = 196, POP_W = 252; // the popup's size, for placing it (matches .tp-pop in globals.css)

/** One wheel: a scroll-snap list of numbers; the row in the middle is the value. */
function Column({ values, value, label, onChange }: { values: number[]; value: number; label: string; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  // scroll to the value when it is set from outside (typing, a cleared field)
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const idx = Math.max(0, values.indexOf(value));
    if (Math.round(el.scrollTop / ITEM) !== idx) el.scrollTo({ top: idx * ITEM });
  }, [value, values]);
  const settle = () => {
    const el = ref.current; if (!el) return;
    const idx = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (values[idx] !== value) onChange(values[idx]);
  };
  const onScroll = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(settle, 90); };
  const step = (d: number) => { const idx = Math.min(values.length - 1, Math.max(0, values.indexOf(value) + d)); onChange(values[idx]); };
  return (
    <div className="tp-col">
      <div className="tp-list" ref={ref} onScroll={onScroll} tabIndex={0} role="listbox" aria-label={label} aria-activedescendant={`${label}-${value}`}
        onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); step(-1); } if (e.key === "ArrowDown") { e.preventDefault(); step(1); } }}>
        <div className="tp-pad" />
        {values.map((v) => <div key={v} id={`${label}-${v}`} role="option" aria-selected={v === value} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{label === "h" ? v : two(v)}</div>)}
        <div className="tp-pad" />
      </div>
      <small>{label}</small>
    </div>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function TimeWheels({ seconds, parts, onChange, maxHours = 23, maxMinutes = 59 }: { seconds: number | null; parts: Parts; onChange: (s: number) => void; maxHours?: number; maxMinutes?: number }) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(s / 3600), m = parts === "ms" ? Math.floor(s / 60) : Math.floor((s % 3600) / 60), sec = parts === "hm" ? 0 : s % 60;
  const set = (hh: number, mm: number, ss: number) => onChange(parts === "ms" ? mm * 60 + ss : hh * 3600 + mm * 60 + ss);
  return (
    <div className="tp-wheels">
      {parts !== "ms" && <Column values={range(maxHours + 1)} value={Math.min(h, maxHours)} label="h" onChange={(v) => set(v, m, sec)} />}
      <Column values={range((parts === "ms" ? maxMinutes : 59) + 1)} value={Math.min(m, parts === "ms" ? maxMinutes : 59)} label="min" onChange={(v) => set(h, v, sec)} />
      {parts !== "hm" && <Column values={range(60)} value={sec} label="s" onChange={(v) => set(h, m, v)} />}
    </div>
  );
}

export function TimePicker({ seconds, parts, onChange, placeholder, maxHours, maxMinutes, inline, id, invalid }: {
  seconds: number | null; parts: Parts; onChange: (s: number | null) => void; placeholder?: string; maxHours?: number; maxMinutes?: number; inline?: boolean; id?: string; invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ up: false, right: false });
  const [typed, setTyped] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("touchstart", away); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("touchstart", away); document.removeEventListener("keydown", key); };
  }, [open]);
  // Where the popup goes, decided as it opens: above the field when there is no room below it (a field low on a
  // phone screen, above the tab bar), hugging the right edge when the field sits in a right-hand column; otherwise
  // the page scrolls just enough to show the whole popup.
  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = wrap.current?.getBoundingClientRect();
    if (r) {
      const h = POP_H + 6, room = window.innerHeight - 72;
      const up = r.bottom + h > room && r.top - h > 0;
      setPlace({ up, right: r.left + POP_W > window.innerWidth - 8 && r.right - POP_W >= 0 });
      if (!up && r.bottom + h > room) window.scrollBy({ top: r.bottom + h - room, behavior: "smooth" });
    }
    setOpen(true);
  };
  const text = formatClock(seconds, parts);
  const commitTyped = () => { if (typed == null) return; const v = parseClock(typed, parts); if (typed.trim() === "") onChange(null); else if (v != null) onChange(v); setTyped(null); };
  const wheels = <TimeWheels seconds={seconds} parts={parts} maxHours={maxHours} maxMinutes={maxMinutes} onChange={(s) => onChange(s)} />;
  if (inline) return <div className="tp tp-inline">{wheels}</div>;
  return (
    <div className={`tp${open ? " open" : ""}`} ref={wrap}>
      <button type="button" id={id} className={`tp-field${text ? "" : " empty"}`} aria-haspopup="dialog" aria-expanded={open} data-invalid={invalid || undefined} onClick={toggle}>
        {text || placeholder || (parts === "ms" ? "m:ss" : parts === "hm" ? "h:mm" : "h:mm:ss")}
      </button>
      {open && (
        <div className={`tp-pop${place.up ? " up" : ""}${place.right ? " right" : ""}`} role="dialog" aria-label="Pick a time">
          {wheels}
          <div className="tp-row">
            <input className="tp-type" value={typed ?? ""} placeholder={`or type ${parts === "ms" ? "9:30" : parts === "hm" ? "4:30" : "1:02:30"}`} inputMode="numeric" aria-label="Type the time"
              onChange={(e) => setTyped(e.target.value)} onBlur={commitTyped} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitTyped(); setOpen(false); } }} />
            <button type="button" className="btn ghost small" onClick={() => { onChange(null); setTyped(null); }}>Clear</button>
            <button type="button" className="btn small" onClick={() => { commitTyped(); setOpen(false); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
