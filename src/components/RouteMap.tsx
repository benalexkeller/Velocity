"use client";
// Poster-style route map: the GPS trace over a quiet base map of the area — grey streets, blue water, green parks.
// Base maps come from OpenStreetMap: vector layers bundled for known areas (seed/maps.json), and CARTO's
// label-free raster tiles for anywhere else. `interactive` adds zoom (wheel, buttons, double-click) and drag-to-pan.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons";

type Way = [number, number][];
export interface AreaMap { slug: string; bounds: { s: number; w: number; n: number; e: number }; layers: Partial<Record<"major" | "minor" | "path" | "water_line" | "water_poly" | "green", Way[]>> }

let cache: AreaMap[] | null = null;
let loading: Promise<AreaMap[]> | null = null;
function loadMaps() {
  if (cache) return Promise.resolve(cache);
  if (!loading) loading = import("@/lib/data/seed/maps.json").then((m) => (cache = m.default as AreaMap[]));
  return loading;
}
/** The tightest bundled map that covers the box (or covers most of it). */
export function pickMap(maps: AreaMap[], b: { s: number; w: number; n: number; e: number }): AreaMap | null {
  const area = (m: AreaMap) => (m.bounds.n - m.bounds.s) * (m.bounds.e - m.bounds.w);
  const covering = maps.filter((m) => m.bounds.s <= b.s && m.bounds.n >= b.n && m.bounds.w <= b.w && m.bounds.e >= b.e).sort((x, y) => area(x) - area(y));
  if (covering.length) return covering[0];
  const overlap = (m: AreaMap) => { const h = Math.max(0, Math.min(m.bounds.n, b.n) - Math.max(m.bounds.s, b.s)), w = Math.max(0, Math.min(m.bounds.e, b.e) - Math.max(m.bounds.w, b.w)); return (h * w) / ((b.n - b.s) * (b.e - b.w)); };
  const best = maps.map((m) => ({ m, f: overlap(m) })).sort((x, y) => y.f - x.f)[0];
  return best && best.f >= 0.6 ? best.m : null;
}

// Web Mercator in world units [0, 1] — the same projection as the tiles, so vectors and tiles line up.
const mx = (lon: number) => (lon + 180) / 360;
const my = (lat: number) => { const r = (lat * Math.PI) / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; };
const invY = (v: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180) / Math.PI;

export function RouteMap({ route, height = 120, stroke = "var(--accent)", bg = "var(--surface-2)", pad = 0.18, interactive = false }: { route?: [number, number][]; height?: number | string; stroke?: string; bg?: string; pad?: number; interactive?: boolean }) {
  const [maps, setMaps] = useState<AreaMap[] | null>(cache);
  useEffect(() => { if (!maps) loadMaps().then(setMaps).catch(() => setMaps([])); }, [maps]);
  // interactive: real pixel size of the box, zoom factor and pan offset
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ k: 1, px: 0, py: 0 }); // k = zoom on top of "fit", px/py = pan in pixels
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>()); // for two-finger pinch
  const pinch = useRef<number | null>(null);
  useEffect(() => {
    if (!interactive || !box.current) return;
    const el = box.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [interactive]);
  useEffect(() => {
    if (!interactive || !box.current) return;
    const el = box.current;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  if (!route || route.length < 2) {
    return <div style={{ height, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>No GPS route</div>;
  }
  const W = interactive ? (size?.w ?? 800) : 400, H = interactive ? (size?.h ?? 500) : 200;
  const lats = route.map((p) => p[0]), lons = route.map((p) => p[1]);
  let s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lons), e = Math.max(...lons);
  const cos = Math.cos(((s + n) / 2) * (Math.PI / 180));
  const py0 = Math.max((n - s) * pad, 0.002), px0 = Math.max((e - w) * pad, 0.002 / cos);
  s -= py0; n += py0; w -= px0; e += px0;
  const x0 = mx(w), x1 = mx(e), y0 = my(n), y1 = my(s);
  // thumbnails fill the frame (slice); the interactive view shows the whole route (fit), then zooms from there
  const fit = interactive ? Math.min(W / (x1 - x0), H / (y1 - y0)) : Math.max(W / (x1 - x0), H / (y1 - y0));
  const sc = fit * view.k;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const ox = W / 2 + view.px, oy = H / 2 + view.py; // screen position of the route centre
  const X = (lon: number) => ox + (mx(lon) - cx) * sc, Y = (lat: number) => oy + (my(lat) - cy) * sc;
  const Xw = (v: number) => ox + (v - cx) * sc, Yw = (v: number) => oy + (v - cy) * sc;
  // what the frame actually shows (degrees), for picking map data and tiles
  const shown = { w: (cx - ox / sc) * 360 - 180, e: (cx + (W - ox) / sc) * 360 - 180, n: invY(cy - oy / sc), s: invY(cy + (H - oy) / sc) };
  const base = maps && maps.length ? pickMap(maps, shown) : null;
  const d = route.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("");
  const inView = (way: Way) => way.some((p) => p[0] >= shown.s && p[0] <= shown.n && p[1] >= shown.w && p[1] <= shown.e);
  const path = (ways: Way[] | undefined, close = false) => (ways ?? []).filter(inView).map((way) => way.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("") + (close ? "Z" : "")).join("");
  const tiles = !base && maps ? tilesFor(shown, sc) : [];
  const credit = (base || tiles.length > 0) && (interactive || (typeof height === "number" && height >= 100));
  const lw = interactive ? Math.min(2, 1 + view.k * 0.15) : 1; // lines thicken a little when zoomed in

  function zoomAt(f: number, sx: number, sy: number) {
    setView((v) => {
      const k = Math.min(40, Math.max(1, v.k * f)); const real = k / v.k;
      if (real === 1) return v;
      // keep the point under the cursor still: move the centre towards/away from it
      const px = sx - (sx - (W / 2 + v.px)) * real - W / 2, py = sy - (sy - (H / 2 + v.py)) * real - H / 2;
      return k === 1 ? { k: 1, px: 0, py: 0 } : { k, px, py };
    });
  }
  const onDown = (ev: React.PointerEvent) => {
    if (!interactive) return;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    if (pointers.current.size === 1) drag.current = { x: ev.clientX, y: ev.clientY, px: view.px, py: view.py };
    else { drag.current = null; pinch.current = null; }
  };
  const onMove = (ev: React.PointerEvent) => {
    if (!pointers.current.has(ev.pointerId)) return;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) { const r = box.current!.getBoundingClientRect(); zoomAt(dist / pinch.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); }
      pinch.current = dist;
      return;
    }
    const g = drag.current; if (!g) return;
    setView((v) => ({ ...v, px: g.px + ev.clientX - g.x, py: g.py + ev.clientY - g.y }));
  };
  const onUp = (ev: React.PointerEvent) => {
    if (pointers.current.has(ev.pointerId)) (ev.currentTarget as HTMLElement).releasePointerCapture(ev.pointerId);
    pointers.current.delete(ev.pointerId);
    drag.current = null; pinch.current = null;
  };

  return (
    <div ref={box} className={`rmap${interactive ? " interactive" : ""}`} style={{ position: "relative", height, borderRadius: 10, overflow: "hidden", background: bg, touchAction: interactive ? "none" : undefined, cursor: interactive ? (drag.current ? "grabbing" : "grab") : undefined }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={interactive ? (ev) => { const r = box.current!.getBoundingClientRect(); zoomAt(1.6, ev.clientX - r.left, ev.clientY - r.top); } : undefined}>
    <svg viewBox={`0 0 ${W} ${H}`} width={interactive ? W : undefined} height={interactive ? H : undefined} style={{ width: "100%", height: "100%", display: "block" }} preserveAspectRatio={interactive ? "none" : "xMidYMid slice"} role="img" aria-label="Route map">
      {tiles.map((t) => <image key={t.key} href={t.url} x={Xw(t.x0)} y={Yw(t.y0)} width={Xw(t.x1) - Xw(t.x0)} height={Yw(t.y1) - Yw(t.y0)} preserveAspectRatio="none" opacity={0.9} />)}
      {base && (
        <g className="basemap">
          <path d={path(base.layers.green, true)} fill="#E6F0E2" stroke="none" />
          <path d={path(base.layers.water_poly, true)} fill="#D7E6FA" stroke="none" />
          <path d={path(base.layers.water_line)} fill="none" stroke="#C7DBF6" strokeWidth={2.2 * lw} strokeLinecap="round" />
          <path d={path(base.layers.path)} fill="none" stroke="#E7E9ED" strokeWidth={0.9 * lw} strokeLinecap="round" />
          <path d={path(base.layers.minor)} fill="none" stroke="#DFE2E7" strokeWidth={1.3 * lw} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path(base.layers.major)} fill="none" stroke="#CDD1D8" strokeWidth={2 * lw} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <path d={d} fill="none" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(route[route.length - 1][1])} cy={Y(route[route.length - 1][0])} r={3.5} fill={stroke} stroke="#fff" strokeWidth={1.5} />
      <circle cx={X(route[0][1])} cy={Y(route[0][0])} r={4.5} fill="#fff" stroke={stroke} strokeWidth={2.5} />
    </svg>
    {interactive && (
      <div className="rmap-ctl" onPointerDown={(ev) => ev.stopPropagation()} onDoubleClick={(ev) => ev.stopPropagation()}>
        <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.5, W / 2, H / 2)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5, W / 2, H / 2)}>−</button>
        <button type="button" aria-label="Fit the whole route" title="Whole route" onClick={() => setView({ k: 1, px: 0, py: 0 })} disabled={view.k === 1 && !view.px && !view.py}><Icon name="expand" /></button>
      </div>
    )}
    {interactive && <span className="rmap-zoom">{view.k === 1 ? "whole route" : `${view.k.toFixed(1)}×`}</span>}
    {credit && <span style={{ position: "absolute", left: 6, bottom: 3, fontSize: 12, color: "#8A909B", background: "rgba(255,255,255,0.7)", borderRadius: 4, padding: "0 4px", pointerEvents: "none" }}>© OpenStreetMap{tiles.length ? " © CARTO" : ""}</span>}
    </div>
  );
}

/** Raster tiles covering the view at a zoom where one tile ≈ 256 px on screen. */
function tilesFor(view: { w: number; e: number; n: number; s: number }, sc: number) {
  const z = Math.max(3, Math.min(18, Math.round(Math.log2(sc / 256))));
  const N = 2 ** z;
  const tx0 = Math.floor(mx(view.w) * N), tx1 = Math.floor(mx(view.e) * N), ty0 = Math.floor(my(view.n) * N), ty1 = Math.floor(my(view.s) * N);
  const out: { key: string; url: string; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= N) continue;
    const wx = ((tx % N) + N) % N;
    out.push({ key: `${z}/${tx}/${ty}`, url: `https://${"abcd"[(wx + ty) % 4]}.basemaps.cartocdn.com/light_nolabels/${z}/${wx}/${ty}.png`, x0: tx / N, x1: (tx + 1) / N, y0: ty / N, y1: (ty + 1) / N });
  }
  return out.length <= 48 ? out : [];
}

/** Full-screen map of one activity: whole route first, then zoom and drag. */
export function MapModal({ route, title, sub, onClose }: { route: [number, number][]; title: string; sub?: string; onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  if (typeof document === "undefined") return null;
  // rendered at the end of <body> so sticky headers and scroll boxes on the page cannot sit above it
  return createPortal(
    <div className="map-modal" role="dialog" aria-label={`Map · ${title}`} onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="hd"><div><b>{title}</b>{sub && <span className="muted"> · {sub}</span>}</div><button type="button" className="close" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
        <RouteMap route={route} height="100%" interactive pad={0.08} />
      </div>
    </div>,
    document.body,
  );
}
