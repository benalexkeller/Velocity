"use client";
// "Connect wearable": one button and one sheet, used on the dashboard, Activities, Profile, the set-up screen and
// the plan builder. One row per maker. Garmin and WHOOP connect for real once the site has their keys (Garmin
// through Garmin's own program or Junction); Apple Watch connects through the Velocity iPhone app; COROS, Polar,
// Suunto and Wahoo through Junction. A maker that is not live yet can be "picked" so the athlete hears when it opens.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { WEARABLES, type ConnectStatus, type ConnectionRow, type WearableKey } from "@/lib/wearables/providers";
export { WEARABLES } from "@/lib/wearables/providers";

const KEY = "velocity.wearables.v1";
type Saved = Record<string, string>; // device → date the athlete asked for it
const read = (): Saved => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const write = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new Event("velocity-wearables")); } catch { /* storage off */ } };

const EMPTY_STATUS: ConnectStatus = { live: {}, garmin: false, via: "", connections: [] };
let statusCache: ConnectStatus | null = null;
const post = async (path: string, body?: unknown) => { const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { ok: r.ok, body: (await r.json().catch(() => ({}))) as Record<string, unknown> }; };
/** The address that starts a maker's sign-in (COROS, Polar, Suunto and Wahoo go through Junction's Garmin-style page later). */
export const connectHref = (k: WearableKey, next?: string) => `/api/connect/${k === "whoop" ? "whoop" : "garmin"}?next=${encodeURIComponent(next ?? (typeof window !== "undefined" ? window.location.pathname : "/profile"))}`;

/** What this site can connect and what the athlete has connected. Fetched once per page load; refresh() after changes. */
export function useConnections() {
  const [status, setStatus] = useState<ConnectStatus>(statusCache ?? EMPTY_STATUS);
  const refresh = useCallback(async () => {
    if (!ACCOUNTS_ON) return;
    try { const r = await fetch("/api/connect/status", { cache: "no-store" }); if (r.ok) { statusCache = (await r.json()) as ConnectStatus; setStatus(statusCache); } } catch { /* offline */ }
  }, []);
  useEffect(() => { if (!statusCache) void refresh(); }, [refresh]);
  const of = (k: string): ConnectionRow | null => status.connections.find((c) => c.provider === k) ?? null;
  const garmin = of("garmin");
  const connected = status.connections.filter((c) => c.status === "connected");
  return {
    status, garmin, garminLive: !!status.live.garmin, refresh,
    /** the connection row of one maker */
    of,
    /** makers connected right now */
    connected,
    isLive: (k: WearableKey) => !!status.live[k],
    disconnect: async (k: WearableKey) => { await post(k === "whoop" ? "/api/connect/whoop/disconnect" : "/api/connect/garmin/disconnect"); statusCache = null; await refresh(); },
    disconnectGarmin: async () => { await post("/api/connect/garmin/disconnect"); statusCache = null; await refresh(); },
    /** Pulls history for a maker; returns a short note, or null on failure. */
    sync: async (k: WearableKey, days = 90) => {
      try {
        const r = await post(k === "whoop" ? "/api/connect/whoop/sync" : "/api/connect/garmin/sync", { days });
        statusCache = null; await refresh();
        if (!r.ok) return typeof r.body.error === "string" ? r.body.error : null;
        if (typeof r.body.note === "string") return r.body.note;
        if (typeof r.body.error === "string") return r.body.error;
        const n = Number(r.body.saved ?? r.body.workouts ?? 0), d = Number(r.body.bodyDays ?? 0);
        return `${n} activit${n === 1 ? "y" : "ies"}${d ? ` and ${d} days of body data` : ""} saved.`;
      } catch { return null; }
    },
    /** kept for older code */
    syncGarmin: async (days = 90) => { try { const r = await post("/api/connect/garmin/sync", { days }); statusCache = null; await refresh(); return r.ok ? Number(r.body.saved ?? 0) : null; } catch { return null; } },
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

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString() : "");

/** What a connected row says under the maker's name; null when there is no connection to speak of. */
export function connectionText(k: WearableKey, c: ConnectionRow | null, via: string | undefined) {
  if (!c || c.status === "disconnected" || c.status === "pending") return null;
  if (c.status === "error") return c.error ? `Connection failed: ${c.error}` : "Connection failed. Try again.";
  const dev = c.device ? `${c.device}, ` : "";
  if (c.last_event_at) return `${dev}Connected, last data ${day(c.last_event_at)}`;
  if (k === "garmin" && via === "direct") return `${dev}Connected. Activities arrive as your watch syncs.`;
  return `${dev}Connected, waiting for the first sync`;
}

export function ConnectWearableSheet({ onClose, onPick }: { onClose: () => void; onPick?: (k: string, on: boolean) => void }) {
  const { saved, toggle } = useWearables();
  const { status, of, isLive, disconnect, sync } = useConnections();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const anyLive = Object.keys(status.live).length > 0;
  const pickButton = (k: string, on: boolean) => <button type="button" className={`btn small${on ? " ghost" : ""}`} aria-pressed={on} onClick={() => { toggle(k); onPick?.(k, !on); }}>{on ? "✓ Picked" : "I use this"}</button>;
  return createPortal(
    <div className="cw-scrim" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}>
      <section className="card cw-sheet" role="dialog" aria-modal="true" aria-label="Connect a wearable" onClick={(e) => { e.stopPropagation(); }}>
        <div className="cw-head">
          <div><h2>Connect a wearable</h2><p className="muted">{anyLive ? "A connected device syncs on its own. Pick any other device you use; each connects here when it opens." : "Connections are being set up. Pick the devices you use; each connects here when it opens."}</p></div>
          <button type="button" className="cw-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <ul className="cw-list">
          {WEARABLES.map((w) => {
            const c = of(w.k);
            const on = !!saved[w.k];
            const connected = c?.status === "connected";
            // Apple Watch: the iPhone app does the connecting; here it only shows its state
            if (w.k === "apple") {
              return (
                <li key={w.k} className={connected ? "on" : ""}>
                  <div><b>{w.name}</b><span className="muted">{connected ? connectionText(w.k, c, "app") : `${w.brings}. Connects through the Velocity iPhone app, coming soon.`}</span></div>
                  {connected
                    ? <span className="cw-actions"><button type="button" className="btn small ghost" disabled={busy === w.k} onClick={async () => { setBusy(w.k); await disconnect(w.k); setBusy(null); }}>Disconnect</button></span>
                    : pickButton(w.k, on)}
                </li>
              );
            }
            if (isLive(w.k)) {
              // history can be pulled from WHOOP and Junction; Garmin's own Starter tier only pushes new data
              const canSync = w.k === "whoop" || status.live[w.k] === "junction";
              return (
                <li key={w.k} className={connected ? "on" : ""}>
                  <div><b>{w.name}</b><span className="muted">{note[w.k] || connectionText(w.k, c, status.live[w.k]) || w.brings}</span></div>
                  {connected
                    ? <span className="cw-actions">
                        {canSync && <button type="button" className="btn small" disabled={busy === w.k} onClick={async () => { setBusy(w.k); setNote((n) => ({ ...n, [w.k]: "" })); const r = await sync(w.k); setNote((n) => ({ ...n, [w.k]: r ?? "Sync failed. Try again." })); setBusy(null); }}>{busy === w.k ? "Syncing…" : "Sync now"}</button>}
                        <button type="button" className="btn small ghost" disabled={busy === w.k} onClick={async () => { setBusy(w.k); await disconnect(w.k); setNote((n) => ({ ...n, [w.k]: "" })); setBusy(null); }}>Disconnect</button>
                      </span>
                    : <a className="btn small" href={connectHref(w.k)}>{c?.status === "error" ? "Connect again" : "Connect"}</a>}
                </li>
              );
            }
            return (
              <li key={w.k} className={on ? "on" : ""}>
                <div><b>{w.name}</b><span className="muted">{w.brings}</span></div>
                {pickButton(w.k, on)}
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
