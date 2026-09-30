// Import a plan from a spreadsheet (.xlsx / .csv). One row per session:
//   Date | Sport | Minutes | Description | Intensity (optional) | Phase (optional)
// Rows on the same day are joined into one session; days without a row are rest days.
import type { PlanWeekJson } from "../data";
import { addDays, fromYmd, ymd } from "../format";

export const TEMPLATE_CSV = [
  "Date,Sport,Minutes,Description,Intensity,Phase",
  "2026-10-05,Rest,0,,,Base 1",
  "2026-10-06,Swim,45,drills + 6x100 smooth,Technique,Base 1",
  "2026-10-07,Bike,60,EZ + 3x1min fast cadence,Zone 2,Base 1",
  "2026-10-08,Run,45,EZ + 6x20s strides,Zone 2,Base 1",
  "2026-10-09,Strength,30,squats lunges hinges planks,,Base 1",
  "2026-10-10,Bike,120,Long ride EZ,Endurance,Base 1",
  "2026-10-11,Run,60,Long run EZ,Endurance,Base 1",
].join("\n");

const SPORT_WORD: Record<string, string> = { swim: "Swim", swimming: "Swim", bike: "Bike", ride: "Bike", cycling: "Bike", cycle: "Bike", run: "Run", running: "Run", jog: "Run", brick: "Brick", strength: "Strength", gym: "Strength", core: "Strength", rest: "Rest", off: "Rest", hike: "Hike", hiking: "Hike", walk: "Hike", race: "Race", other: "Session" };

type Row = Record<string, unknown>;
export interface ImportResult { weeks: PlanWeekJson[]; rows: number; days: number; issues: string[] }

function pick(row: Row, names: string[]) {
  const keys = Object.keys(row);
  for (const n of names) { const k = keys.find((x) => x.trim().toLowerCase() === n); if (k != null && row[k] !== "" && row[k] != null) return row[k]; }
  return undefined;
}
function toDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return ymd(v);
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); } // Excel serial
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; // US m/d/yyyy
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // d.m.yyyy
  const d = new Date(s); return isNaN(d.getTime()) ? null : ymd(d);
}
function toMin(v: unknown): number {
  if (typeof v === "number") return v < 1 && v > 0 ? Math.round(v * 24 * 60) : Math.round(v); // Excel time fraction or minutes
  const s = String(v ?? "").trim().toLowerCase();
  let m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/); if (m) return m[3] != null && +m[1] < 10 && s.split(":").length === 3 ? +m[1] * 60 + +m[2] : +m[1] * 60 + +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+)\s*m)?/); if (m) return Math.round(+m[1] * 60 + (+(m[2] ?? 0)));
  m = s.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)?$/); if (m) return Math.round(+m[1]);
  return 0;
}
const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

/** Parse rows (already read from the sheet) into plan weeks. */
export function rowsToPlan(rows: Row[]): ImportResult {
  const issues: string[] = [];
  const byDay = new Map<string, { text: string; min: number; phase?: string; race: boolean }>();
  let n = 0;
  rows.forEach((r, i) => {
    const date = toDate(pick(r, ["date", "day", "datum"]));
    if (!date) { if (Object.values(r).some((v) => v !== "" && v != null)) issues.push(`Row ${i + 2}: no date`); return; }
    n++;
    const sportRaw = String(pick(r, ["sport", "type", "discipline", "activity"]) ?? "").trim().toLowerCase();
    const sport = SPORT_WORD[sportRaw] ?? (sportRaw ? sportRaw[0].toUpperCase() + sportRaw.slice(1) : "Session");
    const min = sport === "Rest" ? 0 : toMin(pick(r, ["minutes", "min", "mins", "duration", "time", "length"]));
    const desc = String(pick(r, ["description", "session", "workout", "text", "notes", "details"]) ?? "").trim();
    const intensity = String(pick(r, ["intensity", "zone", "effort"]) ?? "").trim();
    const phase = String(pick(r, ["phase", "block"]) ?? "").trim();
    const isRace = sport === "Race" || /race day/i.test(desc);
    // the text must start with the sport so the app can classify it; the description follows
    let text = isRace ? `Race day — ${desc || "race"}` : sport === "Rest" ? `Rest${desc ? ` — ${desc}` : ""}` : sport === "Brick" ? `Brick: bike + run ${hm(min)}${desc ? ` — ${desc}` : ""}` : `${sport} ${hm(min)}${desc ? ` ${/^[—-]/.test(desc) ? "" : "— "}${desc}` : ""}`;
    if (intensity && !new RegExp(intensity, "i").test(text)) text += ` (${intensity})`;
    const cur = byDay.get(date);
    if (cur) { if (cur.min === 0 && cur.text.startsWith("Rest")) byDay.set(date, { text, min, phase: phase || cur.phase, race: cur.race || isRace }); else if (min > 0) byDay.set(date, { text: `${cur.text} + ${text}`, min: cur.min + min, phase: phase || cur.phase, race: cur.race || isRace }); }
    else byDay.set(date, { text, min, phase: phase || undefined, race: isRace });
  });
  if (!byDay.size) return { weeks: [], rows: n, days: 0, issues: [...issues, "No rows with a date were found. The first row must be the header: Date, Sport, Minutes, Description."] };
  const dates = [...byDay.keys()].sort();
  const first = fromYmd(dates[0]), last = fromYmd(dates[dates.length - 1]);
  const mon0 = addDays(first, -((first.getDay() + 6) % 7));
  const nWeeks = Math.floor((last.getTime() - mon0.getTime()) / (7 * 86400000)) + 1;
  const weeks: PlanWeekJson[] = [];
  let lastPhase = "Imported plan";
  for (let w = 0; w < nWeeks; w++) {
    const start = addDays(mon0, w * 7);
    const days = Array.from({ length: 7 }, (_, d) => byDay.get(ymd(addDays(start, d))) ?? { text: "Rest", min: 0, race: false });
    const phase = days.find((d) => d.phase)?.phase ?? lastPhase; lastPhase = phase;
    const race = days.some((d) => d.race);
    const hours = days.reduce((s, d) => s + (d.race ? 0 : d.min), 0) / 60;
    weeks.push({ week: w + 1, start: ymd(start), phase, focus: `${phase} · ${hours.toFixed(1)} h · imported`, recovery: false, race, days: days.map((d) => ({ text: d.text, min: d.min })) });
  }
  return { weeks, rows: n, days: byDay.size, issues };
}

/** Read a .xlsx / .xls / .csv file in the browser. */
export async function parsePlanFile(file: File): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { weeks: [], rows: 0, days: 0, issues: ["The file has no sheet."] };
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: true });
  return rowsToPlan(rows);
}
