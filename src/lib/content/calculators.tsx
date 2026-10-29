"use client";
import { useState } from "react";
import type { Cube } from "@/components/Cubes";
import { fmtHMS, fmtPace } from "@/lib/format";
import { useAnalysis } from "@/lib/useAnalysis";
import type { RaceDistance } from "@/lib/athlete";

// ---------- helpers ----------
const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
/** "m:ss" or "h:mm:ss" or plain minutes → seconds */
const toSec = (s: string) => { const p = s.trim().split(":").map(Number); if (p.some(isNaN) || !s.trim()) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
const hms = (sec: number) => (sec > 0 && isFinite(sec) ? fmtHMS(sec / 60) : "-");
const pace = (sec: number) => (sec > 0 && isFinite(sec) ? fmtPace(sec) : "-");

const RACES = {
  "Ironman 140.6": { swimYd: 4224, bikeMi: 112, runMi: 26.2 },
  "Ironman 70.3": { swimYd: 2112, bikeMi: 56, runMi: 13.1 },
  "Olympic": { swimYd: 1640, bikeMi: 24.9, runMi: 6.2 },
  "Sprint": { swimYd: 820, bikeMi: 12.4, runMi: 3.1 },
  "Marathon": { swimYd: 0, bikeMi: 0, runMi: 26.2 },
  "Half marathon": { swimYd: 0, bikeMi: 0, runMi: 13.1 },
  "Century ride": { swimYd: 0, bikeMi: 100, runMi: 0 },
  "Gran fondo (80 mi)": { swimYd: 0, bikeMi: 80, runMi: 0 },
} as const;
type RaceKey = keyof typeof RACES;
const RACE_OF: Partial<Record<RaceDistance, RaceKey>> = { "140.6": "Ironman 140.6", "70.3": "Ironman 70.3", olympic: "Olympic", sprint: "Sprint", marathon: "Marathon", half: "Half marathon", century: "Century ride", gran_fondo: "Gran fondo (80 mi)" };

function Res({ k, v, u, hero }: { k: string; v: string; u?: string; hero?: boolean }) {
  return <div className={hero ? "hero-v" : ""}><div className="k">{k}</div><div className="v">{v}{u && <small>{u}</small>}</div></div>;
}

// ---------- 1. Race time ----------
function RaceTime() {
  const an = useAnalysis();
  const [race, setRace] = useState<RaceKey>(RACE_OF[an.athlete.race.distance] ?? "Ironman 140.6");
  const [swim, setSwim] = useState("2:05"); const [t1, setT1] = useState("8"); const [bike, setBike] = useState("17.5"); const [t2, setT2] = useState("5"); const [run, setRun] = useState("10:45");
  const d = RACES[race];
  const swimS = (d.swimYd / 100) * toSec(swim), bikeS = num(bike) ? (d.bikeMi / num(bike)) * 3600 : 0, runS = d.runMi * toSec(run);
  const tr = d.swimYd ? (num(t1) + num(t2)) * 60 : 0;
  const total = swimS + bikeS + runS + tr;
  // the athlete's own 4-week averages (sessions long enough to count), never another account's
  const avg = { swim: an.weightedAvgPace("swim"), bike: an.weightedAvgPace("bike"), run: an.weightedAvgPace("run") };
  const hasAvg = (d.swimYd > 0 && avg.swim != null) || (d.bikeMi > 0 && avg.bike != null) || (d.runMi > 0 && avg.run != null);
  const mine = () => { if (avg.swim) setSwim(fmtPace(avg.swim)); if (avg.bike) setBike(avg.bike.toFixed(1)); if (avg.run) setRun(fmtPace(avg.run)); };
  const goalH = an.athlete.hasRace && an.athlete.race.goal ? an.athlete.raceSplits.swim + an.athlete.raceSplits.bike + an.athlete.raceSplits.run + an.athlete.raceSplits.transitions : null;
  return (
    <div className="calc">
      <div className="inputs">
        <label>Race<select value={race} onChange={(e) => setRace(e.target.value as RaceKey)}>{Object.keys(RACES).map((k) => <option key={k}>{k}</option>)}</select></label>
        {d.swimYd > 0 && <label>Swim pace per 100 yd (m:ss)<input value={swim} onChange={(e) => setSwim(e.target.value)} /></label>}
        {d.swimYd > 0 && <div className="two"><label>T1 (min)<input value={t1} onChange={(e) => setT1(e.target.value)} /></label><label>T2 (min)<input value={t2} onChange={(e) => setT2(e.target.value)} /></label></div>}
        {d.bikeMi > 0 && <label>Bike speed (mph)<input value={bike} onChange={(e) => setBike(e.target.value)} /></label>}
        {d.runMi > 0 && <label>Run pace per mile (m:ss)<input value={run} onChange={(e) => setRun(e.target.value)} /></label>}
        <button type="button" className="btn ghost" onClick={mine} disabled={!hasAvg}>{hasAvg ? "Use my 4-week average paces" : "No activities in the last 4 weeks"}</button>
      </div>
      <div className="out">
        <div className="res">
          <Res k="Finish time" v={hms(total)} hero />
          {d.swimYd > 0 && <Res k={`Swim ${(d.swimYd / 1760).toFixed(1)} mi`} v={hms(swimS)} />}
          {d.bikeMi > 0 && <Res k={`Bike ${d.bikeMi} mi`} v={hms(bikeS)} />}
          {d.runMi > 0 && <Res k={`Run ${d.runMi} mi`} v={hms(runS)} />}
          {d.swimYd > 0 && <Res k="Transitions" v={hms(tr)} />}
        </div>
        <div className="note">{goalH && RACE_OF[an.athlete.race.distance] === race ? `Your goal for ${an.athlete.race.name}: ${hms(goalH * 3600)}.` : "Average paces from training are a starting point; race-day pace over the full distance is usually slower."}</div>
      </div>
    </div>
  );
}

// ---------- 2. Pace, distance, time ----------
function Zones() {
  const [lthr, setLthr] = useState("168"); const [tp, setTp] = useState("8:45"); const [ftp, setFtp] = useState("230");
  const H = num(lthr), P = toSec(tp), F = num(ftp);
  const hr: [string, number, number, string][] = [["Z1 Recovery", 0, 0.81, "Easy, conversational"], ["Z2 Aerobic", 0.81, 0.89, "All-day pace; most of the plan"], ["Z3 Tempo", 0.90, 0.93, "Comfortably hard"], ["Z4 Threshold", 0.94, 0.99, "1-hour race effort"], ["Z5 VO2max", 1.0, 1.06, "3-8 min intervals"]];
  const rp: [string, number, number][] = [["Z1", 1.29, 1.5], ["Z2", 1.14, 1.29], ["Z3", 1.06, 1.13], ["Z4", 0.97, 1.05], ["Z5", 0.90, 0.97]];
  const pw: [string, number, number][] = [["Z1", 0, 0.55], ["Z2", 0.56, 0.75], ["Z3", 0.76, 0.90], ["Z4", 0.91, 1.05], ["Z5", 1.06, 1.20]];
  return (
    <div className="calc">
      <div className="inputs">
        <label>Lactate threshold heart rate (bpm)<input value={lthr} onChange={(e) => setLthr(e.target.value)} /></label>
        <label>Run threshold pace per mile (m:ss)<input value={tp} onChange={(e) => setTp(e.target.value)} /></label>
        <label>Bike FTP (watts)<input value={ftp} onChange={(e) => setFtp(e.target.value)} /></label>
        <div className="note">Threshold = the pace or heart rate you can hold for about 60 minutes. The plan's week-4 tests (30-min run, 20-min bike) set these.</div>
      </div>
      <div className="out">
        <div className="cols">
          <div>
            <h3>Heart rate (% of LTHR)</h3>
            <table><tbody>{hr.map(([z, a, b, d]) => <tr key={z}><td>{z}</td><td>{Math.round(H * a)}-{Math.round(H * b)}</td><td>{d}</td></tr>)}</tbody></table>
          </div>
          <div>
            <h3>Run pace (per mile)</h3>
            <table><tbody>{rp.map(([z, a, b]) => <tr key={z}><td>{z}</td><td>{pace(P * b)}-{pace(P * a)}</td></tr>)}</tbody></table>
          </div>
          <div>
            <h3>Bike power (% of FTP)</h3>
            <table><tbody>{pw.map(([z, a, b]) => <tr key={z}><td>{z}</td><td>{Math.round(F * a)}-{Math.round(F * b)} W</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 5. Sweat rate ----------
function Sweat() {
  const [before, setBefore] = useState("165"); const [after, setAfter] = useState("162.5"); const [drank, setDrank] = useState("24"); const [dur, setDur] = useState("90");
  const lossLb = num(before) - num(after) + num(drank) / 33.814 * 2.2046; // fluid drunk counts as loss (it left as sweat)
  const lossL = lossLb / 2.2046;
  const h = num(dur) / 60;
  const rate = h ? lossL / h : 0;
  const pct = num(before) ? ((num(before) - num(after)) / num(before)) * 100 : 0;
  return (
    <div className="calc">
      <div className="inputs">
        <div className="two"><label>Weight before (lb)<input value={before} onChange={(e) => setBefore(e.target.value)} /></label><label>Weight after (lb)<input value={after} onChange={(e) => setAfter(e.target.value)} /></label></div>
        <div className="two"><label>Fluid drunk (fl oz)<input value={drank} onChange={(e) => setDrank(e.target.value)} /></label><label>Duration (min)<input value={dur} onChange={(e) => setDur(e.target.value)} /></label></div>
        <div className="note">Weigh nude or in dry kit, after toweling off, before and after. Note the temperature: rates differ by 2× between cool and hot days.</div>
      </div>
      <div className="out">
        <div className="res">
          <Res k="Sweat rate" v={rate ? rate.toFixed(2) : "-"} u="L/h" hero />
          <Res k="Total loss" v={lossL ? lossL.toFixed(2) : "-"} u="L" />
          <Res k="Body weight change" v={pct ? `${(-pct).toFixed(1)}%` : "-"} />
          <Res k="Drink to replace 70%" v={rate ? Math.round(rate * 0.7 * 1000).toString() : "-"} u="ml/h" />
          <Res k="Sodium at 900 mg/L" v={rate ? Math.round(rate * 0.7 * 900).toString() : "-"} u="mg/h" />
        </div>
        <div className="note">{pct > 2 ? "Loss above 2%: increase fluid on similar sessions." : "Loss within 2%: fluid plan is adequate for these conditions."}</div>
      </div>
    </div>
  );
}

// ---------- 6. Carbs per hour ----------
function Carbs() {
  const [dur, setDur] = useState("180"); const [inten, setInten] = useState<"easy" | "moderate" | "race">("moderate"); const [gel, setGel] = useState("25"); const [drink, setDrink] = useState("6");
  const D = num(dur);
  const target = D < 60 ? 0 : D < 150 ? (inten === "easy" ? 30 : 45) : inten === "race" ? 90 : inten === "moderate" ? 70 : 60;
  const total = (target * D) / 60;
  const gels = num(gel) ? Math.ceil(total / num(gel)) : 0;
  const drinkMl = num(drink) ? Math.round(total / (num(drink) / 100)) : 0;
  return (
    <div className="calc">
      <div className="inputs">
        <label>Session length (min)<input value={dur} onChange={(e) => setDur(e.target.value)} /></label>
        <label>Intensity<select value={inten} onChange={(e) => setInten(e.target.value as typeof inten)}><option value="easy">Easy / Zone 2</option><option value="moderate">Moderate / long ride</option><option value="race">Race pace (trained gut)</option></select></label>
        <div className="two"><label>Gel size (g carbs)<input value={gel} onChange={(e) => setGel(e.target.value)} /></label><label>Drink strength (% carbs)<input value={drink} onChange={(e) => setDrink(e.target.value)} /></label></div>
      </div>
      <div className="out">
        <div className="res">
          <Res k="Target" v={target.toString()} u="g/h" hero />
          <Res k="Total carbs" v={Math.round(total).toString()} u="g" />
          <Res k="As gels only" v={gels.toString()} u="gels" />
          <Res k="As drink only" v={drinkMl ? (drinkMl / 1000).toFixed(1) : "-"} u="L" />
        </div>
        <div className="note">Above 60 g/h use glucose + fructose products. Sessions under 60 minutes need no carbohydrate.</div>
      </div>
    </div>
  );
}

// ---------- 7. Race cost ----------
function Cost() {
  const [reg, setReg] = useState("875"); const [flights, setFlights] = useState("900"); const [nights, setNights] = useState("5"); const [rate, setRate] = useState("190"); const [bike, setBike] = useState("350"); const [car, setCar] = useState("300"); const [food, setFood] = useState("60"); const [gear, setGear] = useState("400");
  const hotel = num(nights) * num(rate), meals = num(nights) * num(food);
  const total = num(reg) + num(flights) + hotel + num(bike) + num(car) + meals + num(gear);
  const rows: [string, number][] = [["Registration", num(reg)], ["Flights", num(flights)], [`Hotel, ${nights} nights`, hotel], ["Bike transport / rental", num(bike)], ["Car and transfers", num(car)], [`Food, ${nights} days`, meals], ["Race gear and nutrition", num(gear)]];
  return (
    <div className="calc">
      <div className="inputs">
        <div className="two"><label>Registration ($)<input value={reg} onChange={(e) => setReg(e.target.value)} /></label><label>Flights ($)<input value={flights} onChange={(e) => setFlights(e.target.value)} /></label></div>
        <div className="two"><label>Hotel nights<input value={nights} onChange={(e) => setNights(e.target.value)} /></label><label>Rate per night ($)<input value={rate} onChange={(e) => setRate(e.target.value)} /></label></div>
        <div className="two"><label>Bike transport ($)<input value={bike} onChange={(e) => setBike(e.target.value)} /></label><label>Car / transfers ($)<input value={car} onChange={(e) => setCar(e.target.value)} /></label></div>
        <div className="two"><label>Food per day ($)<input value={food} onChange={(e) => setFood(e.target.value)} /></label><label>Gear + nutrition ($)<input value={gear} onChange={(e) => setGear(e.target.value)} /></label></div>
      </div>
      <div className="out">
        <div className="res"><Res k="Total race cost" v={`$${total.toLocaleString()}`} hero /></div>
        <table><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>${v.toLocaleString()}</td><td className="muted">{total ? Math.round((v / total) * 100) : 0}%</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

// ---------- 8. Units ----------
export const CALCULATORS: Cube[] = [
  { id: "race-time", tag: "Race", title: "Race time", summary: "Paces and transitions in, finish time and splits out. Ironman, 70.3, Olympic, Sprint, Marathon.", render: () => <RaceTime /> },
  { id: "zones", tag: "Training", title: "Training zones", summary: "Threshold heart rate, run pace and FTP in. Five zones out for each.", render: () => <Zones /> },
  { id: "sweat", tag: "Nutrition", title: "Sweat rate", summary: "Weight before and after a session. Litres per hour and what to drink.", render: () => <Sweat /> },
  { id: "carbs", tag: "Nutrition", title: "Carbs per hour", summary: "Session length and intensity. Grams per hour, gels and drink volume.", render: () => <Carbs /> },
  { id: "cost", tag: "Money", title: "Race cost", summary: "Registration, travel, hotel, bike transport, food, gear. Total and breakdown.", render: () => <Cost /> },
];
