"use client";
// A small calendar pop-over: click the date, pick a day. Weeks start on Monday, like the rest of the app.
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { DAYS, MONTHS, addDays, dateLabel, fromYmd, today, ymd } from "@/lib/format";

export function DatePicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const sel = fromYmd(value);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setView({ y: sel.getFullYear(), m: sel.getMonth() }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const first = new Date(view.y, view.m, 1);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const t = ymd(today());
  const shift = (n: number) => { const d = new Date(view.y, view.m + n, 1); setView({ y: d.getFullYear(), m: d.getMonth() }); };
  const pick = (d: Date) => { onChange(ymd(d)); setOpen(false); };

  return (
    <div className="nu-date" ref={box}>
      <button type="button" className={`pick${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}><Icon name="calendar" /><b>{dateLabel(value)}</b>{value === t ? <span className="tag">Today</span> : value === ymd(addDays(today(), -1)) ? <span className="tag">Yesterday</span> : null}<Icon name="chevron" /></button>
      {open && (
        <div className="nu-cal" role="dialog" aria-label="Pick a day">
          <div className="mh"><button type="button" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="back" /></button><b>{MONTHS[view.m]} {view.y}</b><button type="button" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron" /></button></div>
          <div className="grid">
            {DAYS.map((d) => <span key={d} className="wd">{d.slice(0, 2)}</span>)}
            {cells.map((d) => { const k = ymd(d); return <button type="button" key={k} className={`d${k === value ? " on" : ""}${k === t ? " today" : ""}${d.getMonth() !== view.m ? " other" : ""}`} onClick={() => pick(d)}>{d.getDate()}</button>; })}
          </div>
          <div className="mf"><button type="button" className="linkbtn" onClick={() => pick(today())}>Today</button><button type="button" className="linkbtn" onClick={() => pick(addDays(today(), -1))}>Yesterday</button></div>
        </div>
      )}
    </div>
  );
}
