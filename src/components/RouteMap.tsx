/** Poster-style route thumbnail: the GPS trace on a soft ground. Base-map layers plug in later. */
export function RouteMap({ route, height = 120, stroke = "var(--accent)", bg = "var(--accent-soft)", pad = 0.18 }: { route?: [number, number][]; height?: number; stroke?: string; bg?: string; pad?: number }) {
  if (!route || route.length < 2) {
    return <div style={{ height, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 12 }}>No GPS route</div>;
  }
  const W = 400, H = 200;
  const lats = route.map((p) => p[0]), lons = route.map((p) => p[1]);
  let s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lons), e = Math.max(...lons);
  const cos = Math.cos(((s + n) / 2) * (Math.PI / 180));
  const py = Math.max((n - s) * pad, 0.002), px = Math.max((e - w) * pad, 0.002 / cos);
  s -= py; n += py; w -= px; e += px;
  const spanX = (e - w) * cos, spanY = n - s, sc = Math.min(W / spanX, H / spanY);
  const ox = (W - spanX * sc) / 2, oy = (H - spanY * sc) / 2;
  const X = (lon: number) => ox + (lon - w) * cos * sc, Y = (lat: number) => oy + (n - lat) * sc;
  const d = route.map((p, i) => `${i ? "L" : "M"}${X(p[1]).toFixed(1)} ${Y(p[0]).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height, display: "block", borderRadius: 10, background: bg }} preserveAspectRatio="xMidYMid slice" role="img" aria-label="Route map">
      <path d={d} fill="none" stroke={stroke} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={X(route[0][1])} cy={Y(route[0][0])} r={4.5} fill="#fff" stroke={stroke} strokeWidth={2.5} />
    </svg>
  );
}
