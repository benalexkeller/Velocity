"use client";
// Phases of the plan: one row of phase buttons, then the selected phase week by week. Each week is one row
// (hours, long ride / run / swim with the change from the last loading week, the quality sessions, done count) and
// opens into its seven days. Everything comes from the plan's own sessions, so it works for any plan.
import { useState } from "react";
import { addDays, DAYS, fmtDur, fromYmd, ymd } from "@/lib/format";
import { usePlan } from "@/lib/store";
import { isRaceDay, type Phase, type Session, type Week } from "@/lib/data";
import { SportIcon } from "../SportIcon";
import { Icon } from "../icons";

// quality = anything above easy: tempo, threshold, intervals, race or IM effort (by intensity label or the session text)
const QUALITY = /tempo|interval|threshold|race pace|race effort|race sim|@ ?im\b|im (run )?effort|70\.3 effort|vo2|sweet ?spot|hill reps|pickups/i;
const isQuality = (s: Session) => s.sport !== "rest" && (["Tempo", "Threshold", "Intervals", "Race"].includes(s.intensity) || QUALITY.test(s.text));
// minutes on the bike: rides, and the ride part of a brick ("Long ride 5:15 + BRICK 0:15")
function bikeMin(s: Session) {
  if (s.sport === "bike") return s.min;
  if (s.sport !== "brick") return 0;
  const m = s.text.match(/(?:ride|bike)\s+(\d+):(\d{2})/i);
  return m ? +m[1] * 60 + +m[2] : Math.round(s.min * 0.8);
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (d: string) => { const x = fromYmd(d); return `${x.getDate()} ${MON[x.getMonth()]}`; };
const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const real = (s: Session) => s.sport !== "rest" && !isRaceDay(s.text); // race day itself is not training
const longest = (w: Week, sport: "bike" | "run" | "swim") => Math.max(0, ...w.sessions.filter(real).map((s) => (sport === "bike" ? bikeMin(s) : s.sport === sport ? s.min : 0)));
const range = (a: string, b: string) => { const x = fromYmd(a), y = fromYmd(b); return x.getMonth() === y.getMonth() ? `${x.getDate()}–${y.getDate()} ${MON[y.getMonth()]}` : `${short(a)} – ${short(b)}`; };

const words = (x: string) => x.toLowerCase().replace(/^@\s*/, "").replace(/^at /, "").replace(/\bim\b/g, "IM").trim();
/** The set of a quality session in a few words: "4×1 min tempo pickups", "15 min tempo", "race sim". */
function setOf(s: Session) {
  const t = s.text.replace(/^(AM|PM):\s*/i, "");
  if (isRaceDay(t)) return "race";
  if (/race sim/i.test(t)) return "race sim";
  const iv = t.match(/(\d+)\s*x\s*(\d+)\s*(s|sec|min|m|yd)?\b\s*([@A-Za-z][@A-Za-z0-9 -]*?)?\s*(?=[.,;—(+]|PM:|$)/i);
  if (iv) return `${iv[1]}×${iv[2]}${iv[3] ? ` ${iv[3].replace(/^sec$/, "s")}` : ""} ${words(iv[4] ?? "")}`.trim();
  const part = t.match(/(last|first|middle) (hour|\d+ ?min) @ ?(im|race|70\.3)( run)? effort/i); if (part) return `${part[1].toLowerCase()} ${part[2].replace(/(\d)min/, "$1 min")} ${words(part[3] + (part[4] ?? "") + " effort")}`;
  const last = t.match(/last (\d+) min at race (pace|effort)/i); if (last) return `last ${last[1]} min race ${last[2]}`;
  const mid = t.match(/middle (\d+:\d+) at race (pace|effort)/i); if (mid) return `${mid[1]} race ${mid[2]}`;
  const incl = t.match(/(\d+)\s*min\s*(tempo|threshold|continuous @ ?[a-z0-9. ]+?effort)/i); if (incl) return `${incl[1]} min ${words(incl[2].replace(/continuous @ ?/i, "continuous "))}`;
  if (/at race (effort|pace)/i.test(t)) return "race effort";
  return s.intensity.toLowerCase();
}
const sportWord = (s: Session) => (s.sport === "brick" ? (/run off|brick/i.test(s.text) ? "brick" : "bike") : s.sport);

/** The athlete's own note for the week (seed plans carry one); generated plans' automatic focus lines are left out. */
const ACRONYMS = new Set(["LTHR", "FTP", "IM", "HR", "EZ", "PM", "AM", "OWS"]);
function noteOf(w: Week) {
  const f = (w.focus || "").trim();
  if (!f || /\d+(\.\d)? h(\b|$)/.test(f) || /^recovery$/i.test(f)) return null;
  const t = f.replace(/^goal:\s*/i, "").replace(/\b[A-Z]{3,}(?:-[A-Z]+)*\b/g, (x) => (ACRONYMS.has(x) ? x : x[0] + x.slice(1).toLowerCase()));
  return t[0].toUpperCase() + t.slice(1);
}

function Delta({ v, unit = "time" }: { v: number; unit?: "time" | "h" }) {
  if (!v || Math.abs(v) < (unit === "h" ? 0.05 : 1)) return null;
  const txt = unit === "h" ? `${Math.abs(v).toFixed(1)} h` : hm(Math.abs(v));
  return <small className={`phw-d ${v > 0 ? "up" : "down"}`}>{v > 0 ? "+" : "−"}{txt}</small>;
}

function WeekRow({ w, prev, cur, open, onToggle, onOpenWeek }: { w: Week; prev: Week | null; cur: number; open: boolean; onToggle: () => void; onOpenWeek: (n: number) => void }) {
  const plan = usePlan();
  const end = ymd(addDays(fromYmd(w.start), 6));
  const h = w.plannedMin / 60, ph = prev ? prev.plannedMin / 60 : h;
  const L = { ride: longest(w, "bike"), run: longest(w, "run"), swim: longest(w, "swim") };
  const P = prev ? { ride: longest(prev, "bike"), run: longest(prev, "run"), swim: longest(prev, "swim") } : L;
  const q = w.sessions.filter(isQuality);
  const st = w.week < cur ? plan.weekStatus(w) : null;
  const note = noteOf(w);
  return (
    <li className={`phw${open ? " open" : ""}${w.week === cur ? " now" : ""}`}>
      <button type="button" className="phw-row" aria-expanded={open} onClick={onToggle}>
        <span className="c-wk"><b>Week {w.week}</b><small>{range(w.start, end)}</small></span>
        <span className="c-h"><b>{h.toFixed(1)} h</b><Delta v={h - ph} unit="h" /></span>
        <span className="c-l">{L.ride ? <><b>{hm(L.ride)}</b><Delta v={L.ride - P.ride} /></> : <i>—</i>}</span>
        <span className="c-l">{L.run ? <><b>{hm(L.run)}</b><Delta v={L.run - P.run} /></> : <i>—</i>}</span>
        <span className="c-l">{L.swim ? <><b>{hm(L.swim)}</b><Delta v={L.swim - P.swim} /></> : <i>—</i>}</span>
        <span className="c-q">{w.recovery && <em className="phw-tag">Recovery</em>}{q.length ? q.map((s) => <span key={s.id}>{DAYS[s.dayIndex]} {sportWord(s)} {setOf(s)}</span>) : !w.recovery && <i>all easy</i>}</span>
        <span className="c-st">{w.week === cur ? <em className="phw-tag now">This week</em> : st ? `${st.done} of ${st.total} done` : ""}<Icon name="chevron" /></span>
        {note && <span className="c-note">{note}</span>}
      </button>
      {open && (
        <div className="phw-days">
          <ol>
            {w.sessions.map((s) => (
              <li key={s.id} className={s.sport === "rest" ? "rest" : ""}>
                <span className="d">{DAYS[s.dayIndex]} {fromYmd(s.date).getDate()}</span>
                {s.sport === "rest" ? <span className="t">Rest</span> : <><SportIcon sport={s.sport} size={18} /><span className="t">{s.text}</span><span className="m">{fmtDur(s.min)}</span></>}
              </li>
            ))}
          </ol>
          <button type="button" className="linkbtn" onClick={() => onOpenWeek(w.week)}>Open week {w.week} in the calendar →</button>
        </div>
      )}
    </li>
  );
}

export function PhaseDetail({ selected, onSelect, onOpenWeek }: { selected: string | null; onSelect: (short: string) => void; onOpenWeek: (week: number) => void }) {
  const plan = usePlan();
  const phases = plan.phases;
  const cur = plan.currentWeek().week;
  const [openWk, setOpenWk] = useState<number | null>(cur);
  if (!phases.length) return null;
  const nowPhase = phases.find((p) => cur >= p.from && cur <= p.to) ?? phases[0];
  const p: Phase = phases.find((x) => x.short === selected) ?? nowPhase;
  const isNow = p === nowPhase && cur >= p.from && cur <= p.to;
  const first = p.weeks[0], last = p.weeks[p.weeks.length - 1];
  // changes are shown against the last loading week (a recovery week is compared with the week before it)
  const prevOf = (w: Week) => { for (let n = w.week - 1; n >= 1; n--) { const x = plan.weeks[n - 1]; if (x && (w.recovery || !x.recovery)) return x; } return null; };
  return (
    <div className="card phd">
      <div className="pill-group phd-tabs" role="tablist" aria-label="Phases">
        {phases.map((x) => (
          <button key={x.short} type="button" role="tab" aria-selected={x === p} className={x === p ? "on" : ""} onClick={() => onSelect(x.short)}>
            {x.short}{x === nowPhase && cur >= x.from && <i className="now" aria-label="current phase" />}
          </button>
        ))}
      </div>
      <div className="phd-head">
        <b>{p.short}</b>
        <span className="muted">Weeks {p.from}{p.to !== p.from ? `–${p.to}` : ""} · {short(first.start)} – {short(ymd(addDays(fromYmd(last.start), 6)))}{isNow ? ` · week ${cur - p.from + 1} of ${p.to - p.from + 1}` : ""}</span>
        <button type="button" className="linkbtn" onClick={() => onOpenWeek(isNow ? cur : p.from)}>Open week {isNow ? cur : p.from} →</button>
      </div>
      {p.purpose && <p className="phd-purpose">{p.purpose}</p>}
      <div className="phw-head" aria-hidden><span>Week</span><span>Hours</span><span>Long ride</span><span>Long run</span><span>Long swim</span><span>Quality sessions</span><span /></div>
      <ol className="phw-list">
        {p.weeks.map((w) => <WeekRow key={w.week} w={w} prev={prevOf(w)} cur={cur} open={openWk === w.week} onToggle={() => setOpenWk(openWk === w.week ? null : w.week)} onOpenWeek={onOpenWeek} />)}
      </ol>
    </div>
  );
}
