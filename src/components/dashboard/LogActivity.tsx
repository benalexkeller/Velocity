"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { usePlan } from "@/lib/store";
import { fmtPace, ymd } from "@/lib/format";

type Sport = "swim" | "bike" | "run" | "strength" | "hike" | "other";
const SPORTS: { k: Sport; label: string }[] = [{ k: "swim", label: "Swim" }, { k: "bike", label: "Bike" }, { k: "run", label: "Run" }, { k: "strength", label: "Strength" }, { k: "hike", label: "Hike" }, { k: "other", label: "Other" }];
const FEELS = ["Strong", "Normal", "Flat", "Struggled"];
const KM = 1.609344, YD = 0.9144, FT = 0.3048; // one mile in km, one yard in metres, one foot in metres

const toSec = (s: string) => { const p = s.trim().split(":").map(Number); if (!s.trim() || p.some(isNaN)) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
const hms = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; };
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
function defaultName(sport: Sport, time: string) {
  const h = Number(time.split(":")[0]);
  const part = h < 11 ? "Morning" : h < 14 ? "Midday" : h < 18 ? "Afternoon" : "Evening";
  return `${part} ${SPORTS.find((x) => x.k === sport)?.label.toLowerCase() ?? "session"}`;
}

import type { ManualActivity } from "@/lib/store";
export type { ManualActivity };

/** One column of the duration picker: scroll, arrow keys or the buttons change it; the number can also be typed. */
function Wheel({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [txt, setTxt] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(0, v));
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); onChange(clamp(value + (e.deltaY > 0 ? 1 : -1))); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  });
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    <div className="wh" ref={ref}>
      <button type="button" tabIndex={-1} onClick={() => onChange(clamp(value - 1))} aria-label={`${label} down`}><Icon name="chevron" /></button>
      <span className="ghost">{value > 0 ? pad(value - 1) : ""}</span>
      <input value={txt ?? pad(value)} onFocus={(e) => { setTxt(String(value)); e.target.select(); }} onChange={(e) => { const t = e.target.value.replace(/\D/g, "").slice(0, 2); setTxt(t); if (t !== "") onChange(clamp(parseInt(t))); }} onBlur={() => setTxt(null)} onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); onChange(clamp(value + 1)); setTxt(null); } if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - 1)); setTxt(null); } }} inputMode="numeric" aria-label={label} />
      <span className="ghost">{value < max ? pad(value + 1) : ""}</span>
      <button type="button" tabIndex={-1} onClick={() => onChange(clamp(value + 1))} aria-label={`${label} up`}><Icon name="chevron" /></button>
      <small>{label}</small>
    </div>
  );
}

// Expanding "bubble" for manual logging. Opens to the left over the hero; fields change with the sport.
export interface LogInitial { sport?: Sport; date?: string; time?: string; min?: number; name?: string }
export function LogActivity({ open, onClose, onSaved, initial, inline }: { open: boolean; onClose: () => void; onSaved: (a: ManualActivity) => void; initial?: LogInitial; inline?: boolean }) {
  const plan = usePlan();
  const now = new Date();
  const [sport, setSport] = useState<Sport>(initial?.sport ?? "run");
  const [date, setDate] = useState(initial?.date ?? ymd(now));
  const [time, setTime] = useState(initial?.time ?? `${String(now.getHours()).padStart(2, "0")}:00`);
  const [name, setName] = useState(initial?.name ?? "");
  const [metric, setMetric] = useState(plan.athlete.units === "metric"); // km · m · km/h · /km · m — or mi · yd · mph · /mi · ft
  const [dist, setDist] = useState(""); // in the unit shown
  const [dur, setDur] = useState(initial?.min ? `${initial.min}:00` : ""); // h:mm:ss
  const [pace, setPace] = useState(""); // m:ss per mi|km / per 100 yd|m, or mph|km/h for bike
  const [hr, setHr] = useState("");
  const [elev, setElev] = useState("");
  const [effort, setEffort] = useState(0);
  const [feel, setFeel] = useState("");
  const [note, setNote] = useState("");
  const [last, setLast] = useState<("dist" | "dur" | "pace")[]>([]); // the two most recently edited fields drive the third
  // open → slide in; close → slide back, then unmount
  const [phase, setPhase] = useState<"closed" | "open" | "closing">(open ? "open" : "closed");
  useEffect(() => {
    if (open) { setPhase("open"); return; }
    setPhase((p) => (p === "open" ? "closing" : p));
    const t = setTimeout(() => setPhase("closed"), 300);
    return () => clearTimeout(t);
  }, [open]);

  const touch = (k: "dist" | "dur" | "pace") => setLast((l) => [k, ...l.filter((x) => x !== k)].slice(0, 2));
  const timed = sport === "swim" || sport === "bike" || sport === "run";
  const unit = sport === "swim" ? (metric ? "m" : "yd") : metric ? "km" : "mi";
  const paceLabel = sport === "bike" ? `Avg speed (${metric ? "km/h" : "mph"})` : sport === "swim" ? `Pace per 100 ${metric ? "m" : "yd"}` : `Pace per ${metric ? "km" : "mile"}`;
  const elevUnit = metric ? "m" : "ft";

  // switching units converts what is already typed, so nothing has to be re-entered
  const switchUnits = (toMetric: boolean) => {
    if (toMetric === metric) return;
    const f = sport === "swim" ? (toMetric ? YD : 1 / YD) : toMetric ? KM : 1 / KM;
    if (num(dist)) setDist(sport === "swim" ? String(Math.round(num(dist) * f)) : (num(dist) * f).toFixed(2));
    if (sport === "bike" && num(pace)) setPace((num(pace) * f).toFixed(1));
    else if ((sport === "run" || sport === "swim") && toSec(pace)) setPace(fmtPace(toSec(pace) / f));
    if (num(elev)) setElev(String(Math.round(num(elev) * (toMetric ? FT : 1 / FT))));
    setMetric(toMetric);
  };

  // non-locking auto-calc: whichever of distance / duration / pace was NOT edited most recently is recomputed
  useEffect(() => {
    if (!timed || last.length < 2) return;
    const D = num(dist), T = toSec(dur);
    const per = sport === "swim" ? 100 : 1; // pace is per 100 (yd|m) for swim, per (mile|km) otherwise
    const target = (["dist", "dur", "pace"] as const).find((k) => !last.includes(k));
    if (target === "pace") {
      if (sport === "bike") { if (D && T) setPace((D / (T / 3600)).toFixed(1)); }
      else if (D && T) setPace(fmtPace(T / (D / per)));
    } else if (target === "dur") {
      if (sport === "bike") { const v = num(pace); if (D && v) setDur(hms((D / v) * 3600)); }
      else { const p = toSec(pace); if (D && p) setDur(hms((D / per) * p)); }
    } else if (target === "dist") {
      if (sport === "bike") { const v = num(pace); if (T && v) setDist((v * (T / 3600)).toFixed(1)); }
      else { const p = toSec(pace); if (T && p) setDist(sport === "swim" ? String(Math.round((T / p) * per)) : ((T / p) * per).toFixed(2)); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dist, dur, pace, sport]);

  const placeholder = useMemo(() => defaultName(sport, time), [sport, time]);
  const sec = toSec(dur);
  const valid = sec > 0;
  const setDurPart = (h: number, m: number, s: number) => { setDur(hms(h * 3600 + m * 60 + s)); touch("dur"); };
  const dh = Math.floor(sec / 3600), dm = Math.floor((sec % 3600) / 60), ds = Math.round(sec % 60);

  const save = () => {
    const T = toSec(dur);
    const a: ManualActivity = { id: `manual-${Date.now()}`, name: name.trim() || placeholder, sport, date, start: time, min: Math.round(T / 60), source: "manual", exertion: effort || undefined, feel: feel || undefined, note: note.trim() || undefined };
    // stored in miles / yards / mph / seconds per mile / feet, like the Garmin records
    const D = num(dist);
    if (sport === "swim") { if (D) a.yd = Math.round(metric ? D / YD : D); if (toSec(pace)) a.p100_s = Math.round(metric ? toSec(pace) * YD : toSec(pace)); }
    else if (sport === "bike") { if (D) a.mi = +(metric ? D / KM : D).toFixed(2); if (num(pace)) a.mph = +(metric ? num(pace) / KM : num(pace)).toFixed(1); }
    else if (sport === "run") { if (D) a.mi = +(metric ? D / KM : D).toFixed(2); if (toSec(pace)) a.pace_s = Math.round(metric ? toSec(pace) * KM : toSec(pace)); }
    else if (sport === "hike") { if (D) a.mi = +(metric ? D / KM : D).toFixed(2); }
    if (num(elev)) a.elev_ft = Math.round(metric ? num(elev) / FT : num(elev));
    if (num(hr) >= 30 && num(hr) <= 240) a.hr = Math.round(num(hr));
    onSaved(a);
    setName(""); setDist(""); setDur(""); setPace(""); setHr(""); setElev(""); setEffort(0); setFeel(""); setNote(""); setLast([]);
  };

  if (phase === "closed") return null;
  const units = <span className="lf-units" role="radiogroup" aria-label="Units">{([[false, sport === "swim" ? "yd" : "mi"], [true, sport === "swim" ? "m" : "km"]] as [boolean, string][]).map(([m, l]) => <button key={l} type="button" role="radio" aria-checked={metric === m} className={metric === m ? "on" : ""} onClick={() => switchUnits(m)}>{l}</button>)}</span>;
  return (
    <form className={`card logform${inline ? " inline" : ""}${phase === "closing" ? " closing" : ""}`} onSubmit={(e) => { e.preventDefault(); if (valid) save(); }} aria-label="Log an activity">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="lf-left">
        <div className="lf-top">
          <SportIcon sport={sport} size={28} />
          <input className="lf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} aria-label="Activity name" />
        </div>
        <div className="lf-row sports" role="radiogroup" aria-label="Sport">
          {SPORTS.map((s) => <button key={s.k} type="button" role="radio" aria-checked={sport === s.k} className={sport === s.k ? "on" : ""} onClick={() => { setSport(s.k); setDist(""); setPace(""); setLast(toSec(dur) ? ["dur"] : []); }}><SportIcon sport={s.k} size={15} />{s.label}</button>)}
        </div>
        <div className="lf-grid">
          <label>Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Start time<input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label>Avg heart rate (bpm)<input value={hr} onChange={(e) => setHr(e.target.value)} placeholder="145" inputMode="numeric" /></label>
          <div className="lf-dur" aria-label="Duration">
            <span className="k">Duration</span>
            <div className="wheels">
              <Wheel value={dh} max={23} label="h" onChange={(v) => setDurPart(v, dm, ds)} />
              <Wheel value={dm} max={59} label="min" onChange={(v) => setDurPart(dh, v, ds)} />
              <Wheel value={ds} max={59} label="s" onChange={(v) => setDurPart(dh, dm, v)} />
            </div>
          </div>
          {(timed || sport === "hike") ? <label>Distance<span className="lf-unit-in"><input value={dist} onChange={(e) => { setDist(e.target.value); touch("dist"); }} placeholder={sport === "swim" ? (metric ? "1500" : "1640") : metric ? "10" : "6.2"} inputMode="decimal" />{units}</span></label> : <span />}
          {timed ? <label>{paceLabel}<input value={pace} onChange={(e) => { setPace(e.target.value); touch("pace"); }} placeholder={sport === "bike" ? (metric ? "28" : "17.5") : sport === "swim" ? (metric ? "2:00" : "1:50") : metric ? "5:55" : "9:30"} inputMode="decimal" /></label> : <span />}
          {(sport === "bike" || sport === "run" || sport === "hike") ? <label>Elevation gain ({elevUnit})<input value={elev} onChange={(e) => setElev(e.target.value)} placeholder="0" inputMode="numeric" /></label> : <span />}
        </div>
      </div>
      <div className="lf-right">
        <div>
          <div className="k">How hard · 1–10</div>
          <div className="lf-row effort">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} type="button" className={n <= effort ? "on" : ""} onClick={() => setEffort(n === effort ? 0 : n)} aria-label={`Effort ${n}`}>{n}</button>)}</div>
        </div>
        <div>
          <div className="k">How it felt</div>
          <div className="lf-row feels">{FEELS.map((f) => <button key={f} type="button" className={feel === f ? "on" : ""} onClick={() => setFeel(feel === f ? "" : f)}>{f}</button>)}</div>
        </div>
        <textarea className="lf-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes — what happened, pain, conditions" rows={2} />
        <div className="lf-actions">
          <span className="muted">{valid ? `${SPORTS.find((s) => s.k === sport)?.label} · ${hms(sec)}${dist ? ` · ${dist} ${unit}` : ""}${pace ? ` · ${pace}${sport === "bike" ? (metric ? " km/h" : " mph") : sport === "swim" ? (metric ? "/100 m" : "/100 yd") : metric ? "/km" : "/mi"}` : ""}${num(hr) ? ` · ${hr} bpm` : ""}` : "Duration is required"}</span>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </div>
    </form>
  );
}
