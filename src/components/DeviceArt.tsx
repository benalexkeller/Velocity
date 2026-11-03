// The athlete's wearable on the dashboard hero: a photo of the device they use (public/devices) with the session
// drawn on its screen, so a run shows RUN, its time, distance and heart rate the way that device would show them.
// Makers without their own photo get the round sports watch. The WHOOP strap has no screen, so it shows as is.
export type Device = "garmin" | "fitbit" | "apple" | "whoop";
export const deviceOf = (key: string | undefined): Device => (key === "fitbit" || key === "apple" || key === "whoop" ? key : "garmin");
export interface Face { sport: string; time: string; dist: string; hr?: number }
const SIZE: Record<Device, [number, number]> = { fitbit: [520, 810], apple: [520, 723], whoop: [520, 710], garmin: [520, 722] };

export function DeviceArt({ device, face, height = 178 }: { device: Device; face: Face | null; height?: number }) {
  const [W, H] = SIZE[device];
  const width = Math.round((height * W) / H);
  const sport = face?.sport.toUpperCase() ?? "";
  const small = face ? [face.dist, face.hr ? `♥ ${face.hr}` : ""].filter(Boolean) : [];
  return (
    <div className={`dev dev-${device}`} style={{ width, height }} aria-hidden="true">
      <img src={`/devices/${device}.webp`} alt="" width={W} height={H} draggable={false} />
      {face && device !== "whoop" && (
        <svg viewBox={`0 0 ${W} ${H}`} className="dev-face">
          {device === "garmin" && (
            <g>
              <ellipse cx={313} cy={326} rx={186} ry={202} fill="#050506" />
              <text x={313} y={238} textAnchor="middle" fontSize={26} fill="#fff" letterSpacing={2}>{sport}</text>
              <text x={313} y={340} textAnchor="middle" fontSize={88} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time}</text>
              <line x1={275} y1={364} x2={351} y2={364} stroke="#4CD964" strokeWidth={4} strokeLinecap="round" />
              <text x={313} y={412} textAnchor="middle" fontSize={38} fontWeight={500} fill="#fff">{face.dist}</text>
              {face.hr && <text x={313} y={452} textAnchor="middle" fontSize={24} fill="#fff" opacity={0.85}>♥ {face.hr}</text>}
            </g>
          )}
          {device === "fitbit" && (
            <g transform="rotate(-3 386 331)">
              <rect x={296} y={151} width={178} height={360} rx={28} fill="#050506" />
              <text x={386} y={205} textAnchor="middle" fontSize={22} fill="#fff" letterSpacing={2}>{sport}</text>
              <text x={386} y={318} textAnchor="middle" fontSize={92} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time.split(":")[0]}</text>
              <text x={386} y={410} textAnchor="middle" fontSize={92} fontWeight={600} fill="#fff" letterSpacing={-2}>{face.time.split(":")[1] ?? "00"}</text>
              <text x={386} y={470} textAnchor="middle" fontSize={22} fill="#fff" opacity={0.85}>{small.join("  ")}</text>
            </g>
          )}
          {device === "apple" && (
            <g transform="rotate(-2 177 317)">
              <rect x={41} y={132} width={273} height={371} rx={66} fill="#050506" />
              <text x={177} y={205} textAnchor="middle" fontSize={22} fill="#fff" letterSpacing={2}>{sport}</text>
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
