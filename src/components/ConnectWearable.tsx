"use client";
// "Connect wearable": one button and one sheet, used on the dashboard, Activities, Profile, the set-up screen
// and the plan builder. Garmin connects for real once the site has a Junction key (/api/connect/status says so);
// every other device is recorded as "picked" until its connection exists.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import type { ConnectStatus } from "@/app/api/connect/status/route";

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

const EMPTY_STATUS: ConnectStatus = { garmin: false, via: "", connections: [] };
let statusCache: ConnectStatus | null = null;
/** What this site can connect and what the athlete has connected. Fetched once per page load; refresh() after changes. */
export function useConnections() {
  const [status, setStatus] = useState<ConnectStatus>(statusCache ?? EMPTY_STATUS);
  const refresh = useCallback(async () => {
    if (!ACCOUNTS_ON) return;
    try { const r = await fetch("/api/connect/status", { cache: "no-store" }); if (r.ok) { statusCache = (await r.json()) as ConnectStatus; setStatus(statusCache); } } catch { /* offline */ }
  }, []);
  useEffect(() => { if (!statusCache) void refresh(); }, [refresh]);
  const garmin = status.connections.find((c) => c.provider === "garmin") ?? null;
  return {
    status, garmin, garminLive: status.garmin, refresh,
    disconnectGarmin: async () => { await fetch("/api/connect/garmin/disconnect", { method: "POST" }); statusCache = null; await refresh(); },
    /** Pulls the last 90 days from Junction into the athlete's activities; returns how many were saved, or null on failure. */
    syncGarmin: async (days = 90) => { try { const r = await fetch("/api/connect/garmin/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) }); if (!r.ok) return null; const j = (await r.json()) as { saved: number }; statusCache = null; await refresh(); return j.saved; } catch { return null; } },
  };
}

/** The devices the athlete picked (until their connections are live, that is all there is). */
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
  const { garmin, garminLive, disconnectGarmin, syncGarmin } = useConnections();
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState<string | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const connected = garmin?.status === "connected";
  return createPortal(
    <div className="cw-scrim" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}>
      <section className="card cw-sheet" role="dialog" aria-modal="true" aria-label="Connect a wearable" onClick={(e) => { e.stopPropagation(); }}>
        <div className="cw-head">
          <div><h2>Connect a wearable</h2><p className="muted">{garminLive ? "Garmin syncs on its own once connected. Pick any other device you use; each connects here when it opens." : "Garmin sync is being set up. Pick the devices you use; each connects here when it opens."}</p></div>
          <button type="button" className="cw-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <ul className="cw-list">
          {WEARABLES.map((w) => {
            const on = !!saved[w.k];
            if (w.k === "garmin" && garminLive) {
              return (
                <li key={w.k} className={connected ? "on" : ""}>
                  <div><b>{w.name}</b><span className="muted">{synced ?? (connected ? `Connected${garmin?.last_event_at ? `, last data ${new Date(garmin.last_event_at).toLocaleDateString()}` : ", waiting for the first sync"}` : garmin?.status === "error" ? `Connection failed${garmin.error ? `: ${garmin.error}` : ""}. Try again.` : w.brings)}</span></div>
                  {connected
                    ? <span className="cw-actions">
                        <button type="button" className="btn small" disabled={busy} onClick={async () => { setBusy(true); setSynced(null); const n = await syncGarmin(); setSynced(n == null ? "Sync failed. Try again." : `${n} activit${n === 1 ? "y" : "ies"} saved.`); setBusy(false); }}>{busy ? "Syncing…" : "Sync now"}</button>
                        <button type="button" className="btn small ghost" disabled={busy} onClick={async () => { setBusy(true); await disconnectGarmin(); setBusy(false); }}>Disconnect</button>
                      </span>
                    : <a className="btn small" href="/api/connect/garmin">Connect</a>}
                </li>
              );
            }
            return (
              <li key={w.k} className={on ? "on" : ""}>
                <div><b>{w.name}</b><span className="muted">{w.brings}</span></div>
                <button type="button" className={`btn small${on ? " ghost" : ""}`} aria-pressed={on} onClick={() => { toggle(w.k); onPick?.(w.k, !on); }}>{on ? "✓ Picked" : "I use this"}</button>
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
