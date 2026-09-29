"use client";
import { useEffect, useMemo, useState } from "react";
import { usePlan } from "@/lib/store";
import { supabase } from "@/lib/supabase/client";
import { DISTANCES, type Race, type RaceDistance } from "@/lib/athlete";
import { DEFAULT_AVAILABILITY } from "@/lib/data";

const DAY_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], DAY_NUM = [1, 2, 3, 4, 5, 6, 0];
const USERNAME = /^[a-z0-9_]{3,20}$/;
const hoursToText = (h: number | null | undefined) => { if (!h) return ""; const H = Math.floor(h), M = Math.round((h - H) * 60); return `${H}:${String(M).padStart(2, "0")}`; };
const textToHours = (t: string) => { const m = t.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/); return m ? +m[1] + (+(m[2] ?? 0)) / 60 : null; };

/** Basics + race. Used on first sign-in (/setup) and on the Profile page. */
export function ProfileForm({ mode, onSaved }: { mode: "setup" | "edit"; onSaved?: () => void }) {
  const plan = usePlan();
  const p = plan.profile, r = plan.race;
  const [name, setName] = useState(p?.name ?? "");
  const [username, setUsername] = useState(p?.username ?? "");
  const [uState, setUState] = useState<"idle" | "checking" | "ok" | "taken" | "bad">("idle");
  const [units, setUnits] = useState<"imperial" | "metric">(p?.units ?? "imperial");
  const [timezone, setTimezone] = useState(p?.timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Los_Angeles"));
  const [city, setCity] = useState(p?.city ?? "");
  const av = { ...DEFAULT_AVAILABILITY, ...(p?.availability ?? {}) };
  const [days, setDays] = useState<number[]>(av.days);
  const [am, setAm] = useState(av.weekday_am), [pm, setPm] = useState(av.weekday_pm), [we, setWe] = useState(av.weekend);
  const [hasRace, setHasRace] = useState(!!r || mode === "setup");
  const [raceName, setRaceName] = useState(r?.name ?? "");
  const [raceDate, setRaceDate] = useState(r?.date ?? "");
  const [distance, setDistance] = useState<RaceDistance>(r?.distance ?? "140.6");
  const [goal, setGoal] = useState(hoursToText(r?.goal_hours));
  const [location, setLocation] = useState(r?.location ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const zones = useMemo(() => { let z: string[] = []; try { z = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? []; } catch { z = []; } return z.length && !z.includes(timezone) ? [timezone, ...z] : z; }, [timezone]);

  // username: format check, then ask the database whether it is free
  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (!u) { setUState("idle"); return; }
    if (!USERNAME.test(u)) { setUState("bad"); return; }
    if (u === p?.username) { setUState("ok"); return; }
    const sb = supabase();
    if (!sb) { setUState("ok"); return; }
    setUState("checking");
    const t = setTimeout(async () => { const { data } = await sb.rpc("username_taken", { u }); setUState(data ? "taken" : "ok"); }, 350);
    return () => clearTimeout(t);
  }, [username, p?.username]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSaved(false);
    const u = username.trim().toLowerCase();
    if (!name.trim()) return setErr("Name is required.");
    if (!USERNAME.test(u)) return setErr("Username: 3–20 characters, lowercase letters, numbers or _.");
    if (uState === "taken") return setErr("That username is taken.");
    if (hasRace && (!raceName.trim() || !raceDate)) return setErr("Race name and date are required (or untick the race).");
    setBusy(true);
    try {
      await plan.saveProfile({ name: name.trim(), username: u, units, timezone, city: city.trim() || null, availability: { days, weekday_am: am, weekday_pm: pm, weekend: we }, setup_done: true });
      const race: Race | null = hasRace ? { name: raceName.trim(), date: raceDate, distance, distance_label: DISTANCES.find((d) => d.k === distance)?.short ?? null, goal_hours: textToHours(goal), goal: null, splits: null, location: location.trim() || null } : null;
      await plan.saveRace(race);
      setSaved(true);
      onSaved?.();
    } catch (x) { setErr(x instanceof Error ? x.message : "Could not save."); }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="two">
        <label><b>Name</b><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
        <label><b>Username</b><input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="e.g. pr_tri" aria-invalid={uState === "taken" || uState === "bad"} autoComplete="username" required />
          <span className={`hint ${uState === "ok" ? "ok" : uState === "taken" || uState === "bad" ? "bad" : ""}`}>{uState === "checking" ? "Checking…" : uState === "ok" ? "Available" : uState === "taken" ? "Taken" : uState === "bad" ? "3–20 characters: a–z, 0–9, _" : "Shown instead of your name where you choose"}</span></label>
      </div>
      <div className="three">
        <label><b>Units</b><select value={units} onChange={(e) => setUnits(e.target.value as "imperial" | "metric")}><option value="imperial">Miles, yards, feet</option><option value="metric">Kilometres, metres</option></select></label>
        <label><b>Time zone</b>{zones.length ? <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{zones.map((z) => <option key={z}>{z}</option>)}</select> : <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />}</label>
        <label><b>City</b><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Where you train" /></label>
      </div>
      <label><b>Training days</b><div className="days">{DAY_LABEL.map((d, i) => { const n = DAY_NUM[i]; const on = days.includes(n); return <button key={d} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== n) : [...days, n])}>{d}</button>; })}</div></label>
      <div className="three">
        <label><b>Weekday morning</b><input type="time" step={900} value={am} onChange={(e) => setAm(e.target.value)} /></label>
        <label><b>Weekday evening</b><input type="time" step={900} value={pm} onChange={(e) => setPm(e.target.value)} /></label>
        <label><b>Weekend start</b><input type="time" step={900} value={we} onChange={(e) => setWe(e.target.value)} /></label>
      </div>
      <span className="hint">Session times in the plan calendar come from these.</span>

      <label className="row" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--ink)" }}><input type="checkbox" style={{ width: "auto" }} checked={hasRace} onChange={(e) => setHasRace(e.target.checked)} /> I have a race</label>
      {hasRace && (
        <>
          <div className="two">
            <label><b>Race</b><input value={raceName} onChange={(e) => setRaceName(e.target.value)} placeholder="e.g. IRONMAN Texas" /></label>
            <label><b>Date</b><input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} /></label>
          </div>
          <div className="three">
            <label><b>Distance</b><select value={distance} onChange={(e) => setDistance(e.target.value as RaceDistance)}>{DISTANCES.map((d) => <option key={d.k} value={d.k}>{d.label}</option>)}</select></label>
            <label><b>Goal time (h:mm)</b><input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="13:00" inputMode="numeric" /></label>
            <label><b>Location</b><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="The Woodlands, TX" /></label>
          </div>
        </>
      )}
      {err && <div className="err">{err}</div>}
      {saved && mode === "edit" && <div className="ok-note">Saved.</div>}
      <div className="row"><button type="submit" className="btn" disabled={busy}>{busy ? "Saving…" : mode === "setup" ? "Save and open the app" : "Save changes"}</button></div>
    </form>
  );
}
