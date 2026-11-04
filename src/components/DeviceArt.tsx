// The athlete's wearable on the dashboard hero: a photo of the device they use (public/devices, cut out of its
// background). The Garmin photo follows the sport of the day (run, bike or swim screen as the watch shows it);
// the Fitbit band and the Apple Watch get the session drawn on their screens; the WHOOP strap has no screen.
// Makers without their own photo get the Garmin-style round watch.
export type Device = "garmin" | "fitbit" | "apple" | "whoop";
export const deviceOf = (key: string | undefined): Device => (key === "fitbit" || key === "apple" || key === "whoop" ? key : "garmin");
export interface Face { sport: string; time: string; dist: string; hr?: number }
const SIZE: Record<Device, [number, number]> = { fitbit: [520, 810], apple: [520, 723], whoop: [520, 710], garmin: [520, 722] };

export function DeviceArt({ device, face, sport, height = 168 }: { device: Device; face: Face | null; sport?: string; height?: number }) {
  const [W, H] = SIZE[device];
  const width = Math.round((height * W) / H);
  const label = face?.sport.toUpperCase() ?? "";
  const small = face ? [face.dist, face.hr ? `♥ ${face.hr}` : ""].filter(Boolean) : [];
  const file = device === "garmin" ? `garmin-${sport === "bike" || sport === "swim" ? sport : "run"}` : device;
  return (
    <div className={`dev dev-${device}`} style={{ width, height }} aria-hidden="true">
      <img src={`/devices/${file}.webp`} alt="" width={W} height={H} draggable={false} />
      {face && (device === "fitbit" || device === "apple") && (
        <svg viewBox={`0 0 ${W} ${H}`} className="dev-face">
          {device === "fitbit" && (
            <g transform="rotate(-3 386 331)">
              <rect x={296} y={151} width={178} height={360} rx={28} fill="#050506" />
              <text x={386} y={205} textAnchor="middle" fontSize={22} fill="#fff" letterSpacing={2}>{label}</text>
              <text x={386} y={318} textAnchor="middle" fontSize={92} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time.split(":")[0]}</text>
              <text x={386} y={410} textAnchor="middle" fontSize={92} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time.split(":")[1] ?? "00"}</text>
              <text x={386} y={470} textAnchor="middle" fontSize={22} fill="#fff" opacity={0.85}>{small.join("  ")}</text>
            </g>
          )}
          {device === "apple" && (
            <g transform="rotate(-2 177 317)">
              <rect x={41} y={132} width={273} height={371} rx={66} fill="#050506" />
              <text x={177} y={205} textAnchor="middle" fontSize={22} fill="#fff" letterSpacing={2}>{label}</text>
              <text x={177} y={290} textAnchor="middle" fontSize={72} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time}</text>
              <circle cx={177} cy={372} r={34} fill="none" stroke="#1C3F6E" strokeWidth={9} />
              <circle cx={177} cy={372} r={34} fill="none" stroke="#3B82F6" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 34 * 0.72} ${2 * Math.PI * 34}`} transform="rotate(-90 177 372)" />
              <text x={177} y={452} textAnchor="middle" fontSize={22} fill="#fff" opacity={0.85}>{small.join("  ")}</text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
