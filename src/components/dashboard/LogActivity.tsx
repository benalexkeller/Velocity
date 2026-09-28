"use client";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { fmtPace, ymd } from "@/lib/format";

type Sport = "swim" | "bike" | "run" | "strength" | "hike" | "other";
const SPORTS: { k: Sport; label: string }[] = [{ k: "swim", label: "Swim" }, { k: "bike", label: "Bike" }, { k: "run", label: "Run" }, { k: "strength", label: "Strength" }, { k: "hike", label: "Hike" }, { k: "other", label: "Other" }];
const FEELS = ["Strong", "Normal", "Flat", "Struggled"];

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

// Expanding "bubble" for manual logging. Opens to the left over the hero; fields change with the sport.
export interface LogInitial { sport?: Sport; date?: string; time?: string; min?: number; name?: string }
export function LogActivity({ open, onClose, onSaved, initial, inline }: { open: boolean; onClose: () => void; onSaved: (a: ManualActivity) => void; initial?: LogInitial; inline?: boolean }) {
  const now = new Date();
  const [sport, setSport] = useState<Sport>(initial?.sport ?? "run");
  const [date, setDate] = useState(initial?.date ?? ymd(now));
  const [time, setTime] = useState(initial?.time ?? `${String(now.getHours()).padStart(2, "0")}:00`);
  const [name, setName] = useState(initial?.name ?? "");
  const [dist, setDist] = useState(""); // mi, or yd for swim
  const [dur, setDur] = useState(initial?.min ? `${initial.min}:00` : ""); // h:mm:ss
  const [pace, setPace] = useState(""); // m:ss per mi / per 100 yd, or mph for bike
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
  const unit = sport === "swim" ? "yd" : "mi";

  // non-locking auto-calc: whichever of distance / duration / pace was NOT edited most recently is recomputed
  useEffect(() => {
    if (!timed || last.length < 2) return;
    const D = num(dist), T = toSec(dur);
    const per = sport === "swim" ? 100 : 1; // pace is per 100 yd for swim, per mile for run
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
  const valid = toSec(dur) > 0;

  const save = () => {
    const T = toSec(dur);
    const a: ManualActivity = { id: `manual-${Date.now()}`, name: name.trim() || placeholder, sport, date, start: time, min: Math.round(T / 60), source: "manual", exertion: effort || undefined, feel: feel || undefined, note: note.trim() || undefined };
    if (sport === "swim") { if (num(dist)) a.yd = num(dist); if (toSec(pace)) a.p100_s = toSec(pace); }
    else if (sport === "bike") { if (num(dist)) a.mi = num(dist); if (num(pace)) a.mph = num(pace); }
    else if (sport === "run") { if (num(dist)) a.mi = num(dist); if (toSec(pace)) a.pace_s = toSec(pace); }
    else if (sport === "hike") { if (num(dist)) a.mi = num(dist); }
    if (num(elev)) a.elev_ft = num(elev);
    onSaved(a);
    setName(""); setDist(""); setDur(""); setPace(""); setElev(""); setEffort(0); setFeel(""); setNote(""); setLast([]);
  };

  if (phase === "closed") return null;
  return (
    <form className={`card logform${inline ? " inline" : ""}${phase === "closing" ? " closing" : ""}`} onSubmit={(e) => { e.preventDefault(); if (valid) save(); }} aria-label="Log an activity">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="lf-left">
        <div className="lf-top">
          <SportIcon sport={sport} size={28} />
          <input className="lf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} aria-label="Activity name" />
        </div>
        <div className="lf-row sports" role="radiogroup" aria-label="Sport">
          {SPORTS.map((s) => <button key={s.k} type="button" role="radio" aria-checked={sport === s.k} className={sport === s.k ? "on" : ""} onClick={() => { setSport(s.k); setDist(""); setPace(""); setLast([]); }}><SportIcon sport={s.k} size={15} />{s.label}</button>)}
        </div>
        <div className="lf-grid">
          <label>Day<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Start time<input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label>Duration<input value={dur} onChange={(e) => { setDur(e.target.value); touch("dur"); }} placeholder="h:mm:ss" inputMode="numeric" /></label>
          {(timed || sport === "hike") ? <label>Distance ({unit})<input value={dist} onChange={(e) => { setDist(e.target.value); touch("dist"); }} placeholder={sport === "swim" ? "1640" : "6.2"} inputMode="decimal" /></label> : <span />}
          {timed ? <label>{sport === "bike" ? "Avg speed (mph)" : sport === "swim" ? "Pace per 100 yd" : "Pace per mile"}<input value={pace} onChange={(e) => { setPace(e.target.value); touch("pace"); }} placeholder={sport === "bike" ? "17.5" : sport === "swim" ? "1:50" : "9:30"} inputMode="decimal" /></label> : <span />}
          {(sport === "bike" || sport === "run" || sport === "hike") ? <label>Elevation gain (ft)<input value={elev} onChange={(e) => setElev(e.target.value)} placeholder="0" inputMode="numeric" /></label> : <span />}
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
          <span className="muted">{valid ? `${SPORTS.find((s) => s.k === sport)?.label} · ${dur}${dist ? ` · ${dist} ${unit}` : ""}${pace ? ` · ${pace}${sport === "bike" ? " mph" : ""}` : ""}` : "Duration is required"}</span>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </div>
    </form>
  );
}
