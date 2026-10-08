"use client";
// The plan builder: five screens of questions (branching by event type), then the build screen, or a spreadsheet import.
import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../icons";
import { ConnectWearable } from "../ConnectWearable";
import { usePlan } from "@/lib/store";
import { DISTANCES, distanceInfo, type Race, type RaceDistance } from "@/lib/athlete";
import type { Availability } from "@/lib/data";
import { dateLabel, ymd, addDays, today } from "@/lib/format";
import { DEVICES, EMPTY_INTAKE, EVENT_TYPES, MIN_WEEKS, eventType, hoursToText, textToHours, type Intake, type Kind, type PastRace } from "@/lib/plan/intake";
import { searchEvents, usualMonth, type CatalogEvent } from "@/lib/plan/events";
import { generatePlan, weeksUntil, planStart } from "@/lib/plan/generate";
import { Building } from "./Building";
import { ImportPlan } from "./ImportPlan";

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], DAY_NUM = [1, 2, 3, 4, 5, 6, 0];
const TOD: { k: Intake["time"]["time_of_day"]; label: string; time: string }[] = [{ k: "morning", label: "Morning", time: "06:30" }, { k: "midday", label: "Midday", time: "12:00" }, { k: "evening", label: "Evening", time: "18:00" }];
const STEPS = ["Goal", "History", "Fitness", "Time", "Devices"];

/** Decimal field that keeps what is typed ("2." stays "2.") and hands the parsed number up as it goes; clamps on blur. */
function NumInput({ value, onChange, min, max, ...rest }: { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt ?? (value == null ? "" : String(value));
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  return <input {...rest} value={shown} inputMode={rest.inputMode ?? "decimal"} onChange={(e) => { const t = e.target.value.replace(",", "."); setTxt(t); const v = parseFloat(t); onChange(t.trim() === "" ? null : isNaN(v) ? value : v); }} onBlur={() => { const v = parseFloat(shown); onChange(shown.trim() === "" || isNaN(v) ? null : clamp(v)); setTxt(null); }} />;
}
/** h:mm field that lets the colon and partial minutes be typed; converts when the text is a full time. */
function TimeInput({ hours, onChange, ...rest }: { hours: number | null; onChange: (h: number | null) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt ?? hoursToText(hours);
  return <input {...rest} value={shown} inputMode="numeric" placeholder={rest.placeholder ?? "h:mm"} onChange={(e) => { const t = e.target.value; setTxt(t); if (/^\d{1,2}:\d{2}$/.test(t) || t.trim() === "") onChange(textToHours(t)); }} onBlur={() => { onChange(textToHours(shown)); setTxt(null); }} />;
}

type Patch<T> = Partial<T> | ((cur: T) => Partial<T>);

export function Builder({ edit, importFirst = false }: { edit: boolean; importFirst?: boolean }) {
  const plan = usePlan();
  const router = useRouter();
  const imperial = plan.athlete.units === "imperial";
  const [intake, setIntake] = useState<Intake>(() => (edit && plan.intake ? plan.intake : { ...EMPTY_INTAKE, time: { ...EMPTY_INTAKE.time, days: plan.athlete.availability.days, weekend_start: plan.athlete.availability.weekend } }));
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"ask" | "building" | "import">(importFirst ? "import" : "ask");
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Intake>(k: K, patch: Patch<Intake[K]>) => { setErr(null); setIntake((cur) => ({ ...cur, [k]: { ...(cur[k] as object), ...(typeof patch === "function" ? patch(cur[k]) : patch) } as Intake[K] })); };
  // local mode loads after the first render: take the saved answers (or the profile's days) when they arrive
  const seeded = useRef(false);
  useEffect(() => { if (seeded.current || !plan.ready) return; seeded.current = true; if (edit && plan.intake) setIntake(plan.intake); else if (!edit) setIntake((cur) => ({ ...cur, time: { ...cur.time, days: plan.athlete.availability.days, weekend_start: plan.athlete.availability.weekend } })); }, [plan.ready, plan.intake, plan.athlete.availability, edit]);
  const et = eventType(intake.goal.type);
  const kind = et.kind;
  const weeks = intake.goal.date ? weeksUntil(intake.goal.date) : null;

  function validate(s: number): string | null {
    if (s === 0) {
      if (!intake.goal.date) return "Pick the race date.";
      if (weeks != null && weeks < MIN_WEEKS) return `That is ${weeks < 1 ? "less than a week" : `${weeks} week${weeks === 1 ? "" : "s"}`} away. The shortest plan is ${MIN_WEEKS} weeks — pick a later race or start with a later date.`;
      if (intake.goal.kind === "time" && !intake.goal.target_hours) return "Enter the target time (h:mm).";
      if (intake.goal.type === "other" && !intake.goal.custom_label?.trim()) return "Say what the event is.";
    }
    if (s === 3) {
      if (!intake.time.days.length) return "Pick at least one training day.";
      if (!intake.time.max_hours || intake.time.max_hours < 2) return "Hours per week: at least 2.";
    }
    return null;
  }
  const next = () => { const e = validate(step); setErr(e); if (e) return; setStep((s) => Math.min(STEPS.length - 1, s + 1)); window.scrollTo({ top: 0 }); };
  const back = () => { setErr(null); setStep((s) => Math.max(0, s - 1)); };
  const start = () => { const e = validate(0) ?? validate(3); setErr(e); if (e) { setStep(e === validate(0) ? 0 : 3); return; } setMode("building"); };

  if (mode === "import") return <ImportPlan onBack={() => setMode("ask")} onDone={() => { router.push("/plan"); }} />;
  if (mode === "building") return <Building intake={{ ...intake, created_at: intake.created_at || new Date().toISOString() }} edit={edit} onOpen={() => router.push("/plan")} />;

  return (
    <div className="pb">
      <div className="pb-head">
        <div>
          <h1>{edit ? "Change the answers, rebuild the plan" : "Build your plan"}</h1>
        </div>
        <ol className="pb-steps" aria-label="Steps">{STEPS.map((s, i) => <li key={s} className={i === step ? "on" : i < step ? "done" : ""}><button type="button" onClick={() => { if (i < step) { setErr(null); setStep(i); } }}><span className="n">{i < step ? "✓" : i + 1}</span>{s}</button></li>)}</ol>
      </div>

      <section className="card pb-card form">
        {step === 0 && <GoalStep intake={intake} set={set} imperial={imperial} weeks={weeks} />}
        {step === 1 && <HistoryStep intake={intake} set={set} kind={kind} />}
        {step === 2 && <FitnessStep intake={intake} set={set} kind={kind} imperial={imperial} />}
        {step === 3 && <TimeStep intake={intake} set={set} kind={kind} plan={plan} />}
        {step === 4 && <DevicesStep intake={intake} set={set} setIntake={setIntake} edit={edit} hasPlan={plan.hasPlan} />}
        {err && <div className="err">{err}</div>}
        <div className="row pb-nav">
          {step > 0 ? <button type="button" className="btn ghost" onClick={back}><Icon name="back" />Back</button> : <button type="button" className="btn ghost" onClick={() => router.push(plan.hasPlan ? "/plan" : "/dashboard")}>Cancel</button>}
          <span className="grow" />
          {step === 0 && !edit && <button type="button" className="linkbtn" onClick={() => setMode("import")}>Upload your own plan instead</button>}
          {step < STEPS.length - 1 ? <button type="button" className="btn" onClick={next}>Next<Icon name="chevron" /></button> : <button type="button" className="btn" onClick={start}>{edit ? "Rebuild my plan" : "Build my plan"}<Icon name="arrow" /></button>}
        </div>
      </section>
    </div>
  );
}

// ---------- 1 · goal ----------
function GoalStep({ intake, set, imperial, weeks }: { intake: Intake; set: <K extends keyof Intake>(k: K, p: Patch<Intake[K]>) => void; imperial: boolean; weeks: number | null }) {
  const g = intake.goal;
  const et = eventType(g.type);
  const info = distanceInfo(g.type);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => searchEvents(q), [q]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const pickEvent = (ev: CatalogEvent) => { set("goal", { event: ev.name, location: ev.location, type: ev.type }); setQ(""); setOpen(false); };
  const [target, setTarget] = useState(hoursToText(g.target_hours));
  const [splitOn, setSplitOn] = useState(!!g.splits);
  const groups = [...new Set(EVENT_TYPES.map((e) => e.group))];
  const setTargetText = (t: string) => { setTarget(t); const h = textToHours(t); set("goal", { target_hours: h, splits: splitOn && h ? autoSplits(h, g.type) : null }); };
  const autoSplits = (h: number, type: RaceDistance) => { const f = distanceInfo(type).frac; return { swim: +(h * f.swim).toFixed(2), bike: +(h * f.bike).toFixed(2), run: +(h * f.run).toFixed(2), transitions: +(h * f.transitions).toFixed(2) }; };
  const splitSum = g.splits ? g.splits.swim + g.splits.bike + g.splits.run + g.splits.transitions : 0;
  const startD = planStart();
  return (
    <>
      <div className="pb-q"><h2>What are you training for?</h2></div>
      <div className="pb-types">
        {groups.map((grp) => (
          <div key={grp} className="grp"><span className="k">{grp}</span><div className="days">{EVENT_TYPES.filter((e) => e.group === grp).map((e) => <button key={e.k} type="button" className={g.type === e.k ? "on" : ""} onClick={() => set("goal", { type: e.k, splits: null })} title={e.hint}>{e.label}</button>)}</div></div>
        ))}
      </div>
      {g.type === "other" && <label><b>What is it?</b><input value={g.custom_label ?? ""} onChange={(e) => set("goal", { custom_label: e.target.value })} placeholder="e.g. 24-hour relay, swimrun, multi-day hike" /></label>}

      <div className="pb-q"><h2>Which race?</h2></div>
      <div className="pb-search" ref={box}>
        <label><b>Find an event</b><span className="pb-searchin"><Icon name="search" /><input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="IRONMAN, Berlin, 70.3, marathon…" /></span></label>
        {open && hits.length > 0 && <ul className="pb-hits" role="listbox">{hits.map((ev) => <li key={ev.name}><button type="button" onClick={() => pickEvent(ev)}><b>{ev.name}</b><span>{ev.location} · {eventType(ev.type).label} · usually {usualMonth(ev.month)}</span></button></li>)}</ul>}
        {open && q.trim().length > 1 && !hits.length && <div className="hint">Not in the list — type the name below.</div>}
      </div>
      <div className="three">
        <label><b>Race name</b><input value={g.event} onChange={(e) => set("goal", { event: e.target.value })} placeholder={`e.g. ${et.kind === "tri" ? "IRONMAN Texas" : et.kind === "run" ? "Berlin Marathon" : "Mallorca 312"}`} /></label>
        <label><b>Location</b><input value={g.location} onChange={(e) => set("goal", { location: e.target.value })} placeholder="City, country" /></label>
        <label><b>Race date</b><input type="date" value={g.date} min={ymd(addDays(today(), 1))} onChange={(e) => set("goal", { date: e.target.value })} required /></label>
      </div>
      {g.date && weeks != null && <div className={`pb-weeks${weeks < MIN_WEEKS ? " bad" : ""}`}>{weeks < 1 ? "That date has passed or is this week." : `${weeks} weeks from ${dateLabel(ymd(startD))} to race week${weeks < MIN_WEEKS ? ` — under the ${MIN_WEEKS}-week minimum` : weeks < 8 ? " — short: mostly sharpening and taper, no base building" : weeks < 16 ? " — one base block, one build block, taper" : " — full base, build, peak and taper"}`}</div>}

      <div className="pb-q"><h2>What is the goal?</h2></div>
      <div className="days">
        {([["finish", "Finish"], ["time", "Target time"], ["podium", "Podium / qualify"]] as [Intake["goal"]["kind"], string][]).map(([k, l]) => <button key={k} type="button" className={g.kind === k ? "on" : ""} onClick={() => set("goal", { kind: k })}>{l}</button>)}
      </div>
      {g.kind !== "finish" && (
        <div className="two">
          <label><b>{g.kind === "time" ? "Target time (h:mm)" : "Time it will take (h:mm, optional)"}</b><TimeInput hours={g.target_hours} onChange={(h) => setTargetText(hoursToText(h))} placeholder={hoursToText(info.hours)} /></label>
          {et.kind === "tri" && <label className="pb-chk" style={{ alignSelf: "end" }}><input type="checkbox" checked={splitOn} onChange={(e) => { setSplitOn(e.target.checked); const h = textToHours(target); set("goal", { splits: e.target.checked && h ? autoSplits(h, g.type) : null }); }} /><b>Split it into swim / bike / run</b></label>}
        </div>
      )}
      {g.kind !== "finish" && splitOn && g.splits && et.kind === "tri" && (
        <div className="pb-splits">
          {(["swim", "bike", "run", "transitions"] as const).map((k) => <label key={k}><b>{k === "transitions" ? "T1 + T2" : k[0].toUpperCase() + k.slice(1)}</b><TimeInput hours={g.splits![k]} onChange={(h) => { if (h != null) set("goal", (cur) => ({ splits: { ...cur.splits!, [k]: h } })); }} /></label>)}
          <div className="sum"><span className="k">Adds up to</span><b>{hoursToText(splitSum)}</b>{g.target_hours && Math.abs(splitSum - g.target_hours) > 0.02 ? <span className="hint bad">target is {hoursToText(g.target_hours)}</span> : <span className="hint ok">matches the target</span>}</div>
          <span className="hint">{imperial ? `${info.dist.swimYd.toLocaleString()} yd · ${info.dist.bikeMi} mi · ${info.dist.runMi} mi` : `${Math.round(info.dist.swimYd * 0.9144).toLocaleString()} m · ${(info.dist.bikeMi * 1.609).toFixed(0)} km · ${(info.dist.runMi * 1.609).toFixed(1)} km`}</span>
        </div>
      )}
    </>
  );
}

// ---------- 2 · history ----------
function HistoryStep({ intake, set, kind }: { intake: Intake; set: <K extends keyof Intake>(k: K, p: Patch<Intake[K]>) => void; kind: Kind }) {
  const h = intake.history;
  const sports: { k: Kind; label: string }[] = kind === "tri" ? [{ k: "tri", label: "Triathlon" }, { k: "run", label: "Run" }, { k: "bike", label: "Bike" }, { k: "swim", label: "Swim" }] : kind === "run" ? [{ k: "run", label: "Run" }, { k: "tri", label: "Triathlon" }, { k: "other", label: "Other" }] : kind === "bike" ? [{ k: "bike", label: "Bike" }, { k: "tri", label: "Triathlon" }, { k: "other", label: "Other" }] : kind === "swim" ? [{ k: "swim", label: "Swim" }, { k: "tri", label: "Triathlon" }, { k: "other", label: "Other" }] : [{ k: "other", label: "Other" }, { k: "run", label: "Run" }, { k: "bike", label: "Bike" }, { k: "swim", label: "Swim" }];
  const hourFields: { k: keyof Intake["history"]["hours"]; label: string }[] = kind === "tri" ? [{ k: "swim", label: "Swim" }, { k: "bike", label: "Bike" }, { k: "run", label: "Run" }, { k: "strength", label: "Strength" }] : kind === "run" ? [{ k: "run", label: "Run" }, { k: "bike", label: "Bike (cross-training)" }, { k: "strength", label: "Strength" }] : kind === "bike" ? [{ k: "bike", label: "Bike" }, { k: "run", label: "Run (cross-training)" }, { k: "strength", label: "Strength" }] : kind === "swim" ? [{ k: "swim", label: "Swim" }, { k: "strength", label: "Strength" }] : [{ k: "run", label: "Run" }, { k: "bike", label: "Bike" }, { k: "swim", label: "Swim" }, { k: "strength", label: "Strength" }];
  const setRace = (i: number, patch: Partial<PastRace>) => set("history", (cur) => ({ races: cur.races.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const total = hourFields.reduce((a, f) => a + (h.hours[f.k] || 0), 0);
  return (
    <>
      <div className="pb-q"><h2>Have you raced before?</h2></div>
      <div className="days">{[[true, "Yes"], [false, "No"]].map(([v, l]) => <button key={String(v)} type="button" className={h.raced === v ? "on" : ""} onClick={() => set("history", { raced: v as boolean, races: v ? (h.races.length ? h.races : [{ sport: kind === "other" ? "run" : kind, distance: "", time: "" }]) : [] })}>{l as string}</button>)}</div>
      {h.raced && (
        <div className="pb-races">
          {h.races.map((r, i) => (
            <div key={i} className="pb-race">
              <label><b>Sport</b><select value={r.sport} onChange={(e) => setRace(i, { sport: e.target.value as Kind })}>{sports.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}</select></label>
              <label><b>Distance</b><input value={r.distance} onChange={(e) => setRace(i, { distance: e.target.value })} placeholder={r.sport === "tri" ? "70.3" : r.sport === "run" ? "Half marathon" : r.sport === "bike" ? "100 km" : "3.8 km"} /></label>
              <label><b>Time</b><input value={r.time} onChange={(e) => setRace(i, { time: e.target.value })} placeholder="h:mm" inputMode="numeric" /></label>
              <button type="button" className="x" aria-label="Remove" onClick={() => set("history", (cur) => ({ races: cur.races.filter((_, j) => j !== i) }))}>×</button>
            </div>
          ))}
          {h.races.length < 5 && <button type="button" className="linkbtn" onClick={() => set("history", (cur) => ({ races: [...cur.races, { sport: kind === "other" ? "run" : kind, distance: "", time: "" }] }))}>+ Another race</button>}
        </div>
      )}

      <div className="pb-q"><h2>The last 6–8 weeks</h2></div>
      <label><b>Sessions per week</b><Stepper value={h.sessions_per_week} min={0} max={14} onChange={(v) => set("history", { sessions_per_week: v })} unit={h.sessions_per_week === 1 ? "session" : "sessions"} /></label>
      <div className="pb-hours">
        <span className="k">Hours per week</span>
        <div className="grid">{hourFields.map((f) => <label key={f.k}><b>{f.label}</b><span className="unit-in"><NumInput value={h.hours[f.k] || null} min={0} max={40} onChange={(v) => set("history", (cur) => ({ hours: { ...cur.hours, [f.k]: v ?? 0 } }))} placeholder="0" /><span className="units"><span>h</span></span></span></label>)}</div>
        <span className="hint">{total ? `${total.toFixed(1)} h per week now.` : "0 h: the plan starts at half of your maximum and ramps up."}</span>
      </div>
    </>
  );
}

// ---------- 3 · fitness ----------
function FitnessStep({ intake, set, kind, imperial }: { intake: Intake; set: <K extends keyof Intake>(k: K, p: Patch<Intake[K]>) => void; kind: Kind; imperial: boolean }) {
  const f = intake.fitness;
  const swim = kind === "tri" || kind === "swim", bike = kind === "tri" || kind === "bike", run = kind === "tri" || kind === "run";
  return (
    <>
      <div className="pb-q"><h2>Where you are now</h2><span className="hint">Leave blank what you don't know.</span></div>
      {swim && <div className="pb-sport"><span className="k">Swim</span><div className="two">
        <label><b>Pace per 100 {imperial ? "yd" : "m"} (m:ss)</b><input value={f.swim_pace_100} onChange={(e) => set("fitness", { swim_pace_100: e.target.value })} placeholder="1:50" inputMode="numeric" /></label>
        <label><b>Longest swim, last 8 weeks ({imperial ? "yd" : "m"})</b><NumInput value={f.swim_longest} onChange={(v) => set("fitness", { swim_longest: v })} placeholder={imperial ? "2000" : "1500"} inputMode="numeric" /></label>
      </div></div>}
      {bike && <div className="pb-sport"><span className="k">Bike</span><div className="three">
        <label><b>Steady solo speed ({imperial ? "mph" : "km/h"})</b><NumInput value={f.bike_speed} onChange={(v) => set("fitness", { bike_speed: v })} placeholder={imperial ? "17" : "28"} inputMode="decimal" /></label>
        <label><b>FTP (W, if you know it)</b><NumInput value={f.bike_ftp} onChange={(v) => set("fitness", { bike_ftp: v })} placeholder="220" inputMode="numeric" /></label>
        <label><b>Longest ride, last 8 weeks ({imperial ? "mi" : "km"})</b><NumInput value={f.bike_longest} onChange={(v) => set("fitness", { bike_longest: v })} placeholder={imperial ? "40" : "60"} inputMode="decimal" /></label>
      </div></div>}
      {run && <div className="pb-sport"><span className="k">Run</span><div className="two">
        <label><b>Easy pace per {imperial ? "mile" : "km"} (m:ss)</b><input value={f.run_pace} onChange={(e) => set("fitness", { run_pace: e.target.value })} placeholder={imperial ? "9:30" : "5:55"} inputMode="numeric" /></label>
        <label><b>Longest run, last 8 weeks ({imperial ? "mi" : "km"})</b><NumInput value={f.run_longest} onChange={(v) => set("fitness", { run_longest: v })} placeholder={imperial ? "8" : "13"} inputMode="decimal" /></label>
      </div></div>}
      <div className="pb-sport"><span className="k">Physiology · optional</span>
        <div className="three">
          <label><b>VO2max</b><NumInput value={f.vo2max} onChange={(v) => set("fitness", { vo2max: v })} placeholder="48" inputMode="decimal" disabled={f.garmin_later} /></label>
          <label><b>Resting heart rate</b><NumInput value={f.rhr} onChange={(v) => set("fitness", { rhr: v })} placeholder="52" inputMode="numeric" disabled={f.garmin_later} /></label>
          <label><b>Lactate threshold HR</b><NumInput value={f.lthr} onChange={(v) => set("fitness", { lthr: v })} placeholder="165" inputMode="numeric" disabled={f.garmin_later} /></label>
        </div>
        <label className="pb-chk"><input type="checkbox" checked={f.garmin_later} onChange={(e) => set("fitness", { garmin_later: e.target.checked })} /><b>Import these from my watch later</b></label>
      </div>
    </>
  );
}

// ---------- 4 · time ----------
function TimeStep({ intake, set, kind, plan }: { intake: Intake; set: <K extends keyof Intake>(k: K, p: Patch<Intake[K]>) => void; kind: Kind; plan: ReturnType<typeof usePlan> }) {
  const t = intake.time;
  const toggleDay = (n: number) => set("time", (cur) => ({ days: cur.days.includes(n) ? cur.days.filter((x) => x !== n) : [...cur.days, n] }));
  const weekendOn = t.days.includes(6) || t.days.includes(0);
  return (
    <>
      <div className="pb-q"><h2>How much time can you give?</h2><span className="hint">Used for the peak week.</span></div>
      <label><b>Maximum hours per week</b><Stepper value={t.max_hours} min={2} max={30} step={0.5} onChange={(v) => set("time", { max_hours: v })} unit="h / week" /></label>
      <div className="pb-q small"><h2>Which days?</h2></div>
      <div className="days">{DAY_LABEL.map((d, i) => { const n = DAY_NUM[i]; const on = t.days.includes(n); return <button key={d} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => toggleDay(n)}>{d}</button>; })}</div>
      <span className="hint">{t.days.length === 7 ? "All seven: the plan still keeps one rest day (Monday)." : `${t.days.length} training day${t.days.length === 1 ? "" : "s"}, ${7 - t.days.length} rest.`}</span>
      <div className="two">
        <label><b>Best time on weekdays</b><div className="days">{TOD.map((o) => <button key={o.k} type="button" className={t.time_of_day === o.k ? "on" : ""} onClick={() => set("time", { time_of_day: o.k })}>{o.label}<small> {o.time}</small></button>)}</div></label>
        <label><b>Weekend start time</b><input type="time" step={900} value={t.weekend_start} onChange={(e) => set("time", { weekend_start: e.target.value })} /></label>
      </div>
      <div className="pb-q small"><h2>Long sessions on the weekend?</h2>{kind === "tri" && <span className="hint">Long ride Saturday, long run Sunday.</span>}</div>
      <div className="days">{[[true, "Yes"], [false, "No, on a weekday"]].map(([v, l]) => <button key={String(v)} type="button" className={t.long_weekend === v ? "on" : ""} disabled={v === true && !weekendOn} onClick={() => set("time", { long_weekend: v as boolean })}>{l as string}</button>)}</div>
      <div className="pb-q small"><h2>Dates you cannot train</h2><span className="hint">They become rest days.</span></div>
      <div className="pb-blackouts">
        {t.blackouts.map((b, i) => (
          <div key={i} className="pb-bo">
            <label><b>From</b><input type="date" value={b.from} onChange={(e) => set("time", (cur) => ({ blackouts: cur.blackouts.map((x, j) => (j === i ? { ...x, from: e.target.value, to: x.to && x.to < e.target.value ? e.target.value : x.to } : x)) }))} /></label>
            <label><b>To</b><input type="date" value={b.to} min={b.from} onChange={(e) => set("time", (cur) => ({ blackouts: cur.blackouts.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) }))} /></label>
            <label><b>Note</b><input value={b.note ?? ""} onChange={(e) => set("time", (cur) => ({ blackouts: cur.blackouts.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) }))} placeholder="optional" /></label>
            <button type="button" className="x" aria-label="Remove" onClick={() => set("time", (cur) => ({ blackouts: cur.blackouts.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <button type="button" className="linkbtn" onClick={() => set("time", (cur) => ({ blackouts: [...cur.blackouts, { from: "", to: "", note: "" }] }))}>+ Add dates</button>
      </div>
      <div className="pb-cal">
        <button type="button" className={`btn ghost${t.calendar_sync ? " on" : ""}`} onClick={() => { set("time", { calendar_sync: !t.calendar_sync }); if (plan.calendar !== !t.calendar_sync) plan.toggleCalendar(); }}><Icon name="calendar" />{t.calendar_sync ? "✓ Workouts will sync to Google Calendar" : "Sync workouts to Google Calendar"}</button>
        <span className="hint">Not connected yet.</span>
      </div>
    </>
  );
}

// ---------- 5 · devices + strength ----------
function DevicesStep({ intake, set, setIntake, edit, hasPlan }: { intake: Intake; set: <K extends keyof Intake>(k: K, p: Patch<Intake[K]>) => void; setIntake: React.Dispatch<React.SetStateAction<Intake>>; edit: boolean; hasPlan: boolean }) {
  const toggle = (k: string) => setIntake((cur) => ({ ...cur, devices: k === "none" ? ["none"] : cur.devices.includes(k) ? cur.devices.filter((x) => x !== k) : [...cur.devices.filter((x) => x !== "none"), k] }));
  const et = eventType(intake.goal.type);
  const weeks = intake.goal.date ? weeksUntil(intake.goal.date) : 0;
  void set;
  return (
    <>
      <div className="pb-q"><h2>Which devices do you have?</h2><span className="hint">Not connected yet.</span></div>
      <div className="days">{DEVICES.map((d) => <button key={d.k} type="button" className={intake.devices.includes(d.k) ? "on" : ""} onClick={() => toggle(d.k)}>{d.label}</button>)}</div>
      <div style={{ marginTop: 10 }}><ConnectWearable variant="ghost" onPick={(k, on) => setIntake((cur) => ({ ...cur, devices: on ? [...cur.devices.filter((x) => x !== "none" && x !== k), k] : cur.devices.filter((x) => x !== k) }))} /></div>
      <div className="pb-q small"><h2>Strength training?</h2><span className="hint">2 × 20 min a week on easy days. Off in taper and race week.</span></div>
      <div className="days">{[[true, "Yes"], [false, "No"]].map(([v, l]) => <button key={String(v)} type="button" className={intake.strength === v ? "on" : ""} onClick={() => setIntake((cur) => ({ ...cur, strength: v as boolean }))}>{l as string}</button>)}</div>
      <div className="pb-recap">
        <span className="k">Summary</span>
        <ul>
          <li><b>{intake.goal.event || intake.goal.custom_label || et.label}</b> · {et.label} · {intake.goal.date ? dateLabel(intake.goal.date) + " " + intake.goal.date.slice(0, 4) : "no date"} · {weeks} weeks</li>
          <li>Goal: {intake.goal.kind === "finish" ? "finish" : intake.goal.kind === "time" ? `${hoursToText(intake.goal.target_hours)}` : "podium / qualify"}{intake.goal.splits ? ` (swim ${hoursToText(intake.goal.splits.swim)} · bike ${hoursToText(intake.goal.splits.bike)} · run ${hoursToText(intake.goal.splits.run)})` : ""}</li>
          <li>Now: {intake.history.sessions_per_week} sessions · {(intake.history.hours.swim + intake.history.hours.bike + intake.history.hours.run + intake.history.hours.strength).toFixed(1)} h per week · up to {intake.time.max_hours} h at the peak</li>
          <li>{intake.time.days.length} days · {TOD.find((o) => o.k === intake.time.time_of_day)?.label} on weekdays · long sessions {intake.time.long_weekend ? "on the weekend" : "on a weekday"} · {intake.time.blackouts.filter((b) => b.from && b.to).length} blackout period{intake.time.blackouts.filter((b) => b.from && b.to).length === 1 ? "" : "s"}</li>
          <li>Strength {intake.strength ? "on" : "off"} · {intake.devices.length && !intake.devices.includes("none") ? intake.devices.map((d) => DEVICES.find((x) => x.k === d)?.label).join(", ") : "no devices"}</li>
        </ul>
        {(edit || hasPlan) && <span className="hint bad">{edit ? "Rebuilding replaces the plan from this week on. Moves, edits and locks are reset." : "This replaces your current plan. Moves, edits and locks are reset."}</span>}
      </div>
    </>
  );
}

function Stepper({ value, min, max, step = 1, unit, onChange }: { value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  return (
    <span className="pb-stepper">
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label="Less">−</button>
      <NumInput value={value} min={min} max={max} onChange={(v) => { if (v != null) onChange(clamp(v)); }} />
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label="More">+</button>
      {unit && <span className="u">{unit}</span>}
    </span>
  );
}

/** Race row + availability derived from the answers (what the rest of the app reads). */
export function raceFromIntake(intake: Intake): Race {
  const et = eventType(intake.goal.type);
  const info = DISTANCES.find((d) => d.k === intake.goal.type);
  return {
    name: intake.goal.event.trim() || intake.goal.custom_label?.trim() || et.label,
    date: intake.goal.date,
    distance: intake.goal.type,
    distance_label: intake.goal.type === "other" ? (intake.goal.custom_label?.trim() || null) : info?.short ?? null,
    goal: intake.goal.kind === "finish" ? "Finish" : intake.goal.kind === "podium" ? "Podium / qualify" : null,
    goal_hours: intake.goal.target_hours,
    splits: intake.goal.splits,
    location: intake.goal.location.trim() || null,
  };
}
export function availabilityFromIntake(intake: Intake): Required<Availability> {
  const tod = TOD.find((o) => o.k === intake.time.time_of_day) ?? TOD[0];
  return { days: intake.time.days, weekday_am: tod.time, weekday_pm: intake.time.time_of_day === "evening" ? "19:30" : "18:00", weekend: intake.time.weekend_start || "08:00" };
}
export { generatePlan };
