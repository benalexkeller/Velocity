"use client";
// Poster-style route map: the GPS trace over a quiet base map of the area — grey streets, blue water, green parks.
// Base maps come from OpenStreetMap: vector layers bundled for known areas (seed/maps.json), and CARTO's
// label-free raster tiles for anywhere else.
import { useEffect, useState } from "react";

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

export function RouteMap({ route, height = 120, stroke = "var(--accent)", bg = "var(--surface-2)", pad = 0.18 }: { route?: [number, number][]; height?: number; stroke?: string; bg?: string; pad?: number }) {
  const [maps, setMaps] = useState<AreaMap[] | null>(cache);
  useEffect(() => { if (!maps) loadMaps().then(setMaps).catch(() => setMaps([])); }, [maps]);
  if (!route || route.length < 2) {
    return <div style={{ height, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>No GPS route</div>;
  }
  const W = 400, H = 200;
  const lats = route.map((p) => p[0]), lons = route.map((p) => p[1]);
  let s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lons), e = Math.max(...lons);
  const cos = Math.cos(((s + n) / 2) * (Math.PI / 180));
  const py = Math.max((n - s) * pad, 0.002), px = Math.max((e - w) * pad, 0.002 / cos);
  s -= py; n += py; w -= px; e += px;
  // fit the padded box into the frame, then widen the shorter side so the frame is filled (slice)
  const x0 = mx(w), x1 = mx(e), y0 = my(n), y1 = my(s);
  const sc = Math.max(W / (x1 - x0), H / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const X = (lon: number) => W / 2 + (mx(lon) - cx) * sc, Y = (lat: number) => H / 2 + (my(lat) - cy) * sc;
  const Xw = (v: number) => W / 2 + (v - cx) * sc, Yw = (v: number) => H / 2 + (v - cy) * sc; // from world units
  // what the frame actually shows (in degrees), for picking map data and tiles
  const view = { w: (cx - W / 2 / sc) * 360 - 180, e: (cx + W / 2 / sc) * 360 - 180, n: invY(cy - H / 2 / sc), s: invY(cy + H / 2 / sc) };
  const base = maps && maps.length ? pickMap(maps, view) : null;
  const d = route.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("");
  const inView = (way: Way) => way.some((p) => p[0] >= view.s && p[0] <= view.n && p[1] >= view.w && p[1] <= view.e);
  const path = (ways: Way[] | undefined, close = false) => (ways ?? []).filter(inView).map((way) => way.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("") + (close ? "Z" : "")).join("");
  const tiles = !base && maps ? tilesFor(view, sc) : [];
  const credit = (base || tiles.length > 0) && height >= 100;
  return (
    <div style={{ position: "relative", height, borderRadius: 10, overflow: "hidden" }}>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, display: "block", borderRadius: 10, background: bg }} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Route map">
      {tiles.map((t) => <image key={t.key} href={t.url} x={Xw(t.x0)} y={Yw(t.y0)} width={Xw(t.x1) - Xw(t.x0)} height={Yw(t.y1) - Yw(t.y0)} preserveAspectRatio="none" opacity={0.9} />)}
      {base && (
        <g className="basemap">
          <path d={path(base.layers.green, true)} fill="#E6F0E2" stroke="none" />
          <path d={path(base.layers.water_poly, true)} fill="#D7E6FA" stroke="none" />
          <path d={path(base.layers.water_line)} fill="none" stroke="#C7DBF6" strokeWidth={2.2} strokeLinecap="round" />
          <path d={path(base.layers.path)} fill="none" stroke="#E7E9ED" strokeWidth={0.9} strokeLinecap="round" />
          <path d={path(base.layers.minor)} fill="none" stroke="#DFE2E7" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path(base.layers.major)} fill="none" stroke="#CDD1D8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      <path d={d} fill="none" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(route[route.length - 1][1])} cy={Y(route[route.length - 1][0])} r={3.5} fill={stroke} stroke="#fff" strokeWidth={1.5} />
      <circle cx={X(route[0][1])} cy={Y(route[0][0])} r={4.5} fill="#fff" stroke={stroke} strokeWidth={2.5} />
    </svg>
    {credit && <span style={{ position: "absolute", left: 6, bottom: 3, fontSize: 9, color: "#8A909B", background: "rgba(255,255,255,0.7)", borderRadius: 4, padding: "0 4px", pointerEvents: "none" }}>© OpenStreetMap{tiles.length ? " © CARTO" : ""}</span>}
    </div>
  );
}

const invY = (v: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180) / Math.PI;

/** Raster tiles covering the view at a zoom where one tile ≈ 256 px of the 400-px frame. */
function tilesFor(view: { w: number; e: number; n: number; s: number }, sc: number) {
  const z = Math.max(3, Math.min(17, Math.round(Math.log2(sc / 256))));
  const N = 2 ** z;
  const tx0 = Math.floor(mx(view.w) * N), tx1 = Math.floor(mx(view.e) * N), ty0 = Math.floor(my(view.n) * N), ty1 = Math.floor(my(view.s) * N);
  const out: { key: string; url: string; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= N) continue;
    const wx = ((tx % N) + N) % N;
    out.push({ key: `${z}/${tx}/${ty}`, url: `https://${"abcd"[(wx + ty) % 4]}.basemaps.cartocdn.com/light_nolabels/${z}/${wx}/${ty}.png`, x0: tx / N, x1: (tx + 1) / N, y0: ty / N, y1: (ty + 1) / N });
  }
  return out.length <= 30 ? out : [];
}
