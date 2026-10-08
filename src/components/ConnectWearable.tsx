"use client";
// "Connect wearable": one button and one sheet, used on the dashboard, Activities, Profile, the set-up screen
// and the plan builder. Direct connections are not live yet, so the sheet says so and records which device
// the athlete uses; when an integration opens, its row becomes the real sign-in.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

export interface Wearable { k: string; name: string; brings: string }
export const WEARABLES: Wearable[] = [
  { k: "garmin", name: "Garmin", brings: "Activities with routes, heart rate, power, VO2max, resting HR, HRV, sleep" },
  { k: "apple", name: "Apple Watch", brings: "Workouts and heart rate through Apple Health" },
  { k: "coros", name: "COROS", brings: "Activities, heart rate, training load" },
  { k: "polar", name: "Polar", brings: "Activities, heart rate, recovery data" },
  { k: "suunto", name: "Suunto", brings: "Activities, routes, heart rate" },
  { k: "whoop", name: "WHOOP", brings: "Strain, sleep, HRV, resting HR" },
  { k: "wahoo", name: "Wahoo", brings: "Rides with power and heart rate" },
  { k: "strava", name: "Strava", brings: "Activities from any device that syncs to Strava" },
];

const KEY = "velocity.wearables.v1";
type Saved = Record<string, string>; // device → date the athlete asked for it
const read = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const write = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event("velocity-wearables")); } catch { /* storage off */ } };

/** The devices the athlete picked (until connections are live, that is all there is). */
export function useWearables() {
  const [saved, setSaved] = useState<Saved>({});
  useEffect(() => {
    const on = () => setSaved(read());
    on();
    window.addEventListener("velocity-wearables", on);
    return () => window.removeEventListener("velocity-wearables", on);
  }, []);
  const toggle = (k: string) => { const s = read(); if (s[k]) delete s[k]; else s[k] = new Date().toISOString().slice(0, 10); write(s); };
  return { saved, picked: Object.keys(saved), toggle };
}

export function ConnectWearableSheet({ onClose, onPick }: { onClose: () => void; onPick?: (k: string, on: boolean) => void }) {
  const { saved, toggle } = useWearables();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return createPortal(
    <div className="cw-scrim" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}>
      <section className="card cw-sheet" role="dialog" aria-modal="true" aria-label="Connect a wearable" onClick={(e) => { e.stopPropagation(); }}>
        <div className="cw-head">
          <div><h2>Connect a wearable</h2><p className="muted">Direct connections are not live yet. Pick the devices you use: each one signs in here when its connection opens, and your history imports then. Until then, log sessions by hand.</p></div>
          <button type="button" className="cw-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <ul className="cw-list">
          {WEARABLES.map((w) => {
            const on = !!saved[w.k];
            return (
              <li key={w.k} className={on ? "on" : ""}>
                <div><b>{w.name}</b><span className="muted">{w.brings}</span></div>
                <span className="cw-state">{on ? "Picked · connects when live" : "Not live yet"}</span>
                <button type="button" className={`btn small${on ? " ghost" : ""}`} aria-pressed={on} onClick={() => { toggle(w.k); onPick?.(w.k, !on); }}>{on ? "Remove" : "I use this"}</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>,
    document.body,
  );
}

/** The button. `variant="dark"` for the dashboard hero. */
export function ConnectWearable({ label = "Connect wearable", variant, onPick }: { label?: string; variant?: "dark" | "ghost" | "link"; onPick?: (k: string, on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={variant === "link" ? "linkbtn cw-btn" : `btn small cw-btn${variant === "ghost" ? " ghost" : ""}${variant === "dark" ? " on-dark" : ""}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}><Icon name="watch" />{label}</button>
      {open && <ConnectWearableSheet onClose={() => setOpen(false)} onPick={onPick} />}
    </>
  );
}
