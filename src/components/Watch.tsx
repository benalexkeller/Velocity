// A round multisport watch, drawn in SVG. Used as the "hovering" device on the dashboard hero.
export function Watch({ width = 118, time = "07:42", hr = 58 }: { width?: number; time?: string; hr?: number }) {
  const height = Math.round((width * 164) / 120);
  return (
    <svg className="watch" width={width} height={height} viewBox="0 0 120 164" role="img" aria-label="Garmin watch">
      <defs>
        <linearGradient id="w-strap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#25282D" /><stop offset="0.5" stopColor="#33363C" /><stop offset="1" stopColor="#25282D" />
        </linearGradient>
        <radialGradient id="w-case" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3A3D44" /><stop offset="1" stopColor="#15171A" />
        </radialGradient>
        <radialGradient id="w-face" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#0F1114" /><stop offset="1" stopColor="#040506" />
        </radialGradient>
      </defs>
      {/* straps */}
      <rect x="39" y="0" width="42" height="46" rx="8" fill="url(#w-strap)" />
      <rect x="39" y="118" width="42" height="46" rx="8" fill="url(#w-strap)" />
      {[10, 20, 30].map((y) => <rect key={y} x="56" y={y} width="8" height="3" rx="1.5" fill="#15171A" />)}
      {[132, 142, 152].map((y) => <rect key={y} x="56" y={y} width="8" height="3" rx="1.5" fill="#15171A" />)}
      {/* buttons */}
      <rect x="6" y="62" width="6" height="12" rx="2" fill="#2E3136" />
      <rect x="6" y="90" width="6" height="12" rx="2" fill="#2E3136" />
      <rect x="108" y="62" width="6" height="12" rx="2" fill="#2E3136" />
      <rect x="108" y="90" width="6" height="12" rx="2" fill="#2E3136" />
      {/* case + bezel */}
      <circle cx="60" cy="82" r="50" fill="url(#w-case)" />
      <circle cx="60" cy="82" r="45" fill="none" stroke="#4A4E56" strokeWidth="1.2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2, r = (n: number) => Math.round(n * 100) / 100; // rounded so server and browser render identical numbers
        return <line key={i} x1={r(60 + Math.cos(a) * 43)} y1={r(82 + Math.sin(a) * 43)} x2={r(60 + Math.cos(a) * 46)} y2={r(82 + Math.sin(a) * 46)} stroke="#6A6E76" strokeWidth="1" />;
      })}
      {/* face */}
      <circle cx="60" cy="82" r="39" fill="url(#w-face)" />
      <circle cx="60" cy="82" r="35" fill="none" stroke="#1E2A45" strokeWidth="3" />
      <path d="M 60 47 A 35 35 0 1 1 30 65" fill="none" stroke="#2459FE" strokeWidth="3" strokeLinecap="round" />
      <text x="60" y="80" textAnchor="middle" fill="#FFFFFF" fontSize="17" fontWeight="600" fontFamily="inherit" letterSpacing="-0.02em">{time}</text>
      <path d="M 52 92 c -2.4 -2.2 -2.4 -5.4 0 -7 c 1.4 -1 3.2 -0.5 4 0.9 c 0.8 -1.4 2.6 -1.9 4 -0.9 c 2.4 1.6 2.4 4.8 0 7 l -4 3.6 z" fill="#EF4444" />
      <text x="64" y="95" textAnchor="start" fill="#C9CDD4" fontSize="9" fontFamily="inherit">{hr} bpm</text>
      <text x="60" y="108" textAnchor="middle" fill="#7C8290" fontSize="7" letterSpacing="0.14em" fontFamily="inherit">GARMIN</text>
    </svg>
  );
}
