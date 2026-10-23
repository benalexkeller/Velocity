export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fromYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function today() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}
export function todayLabel() {
  const d = new Date();
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function dateLabel(s: string) {
  const d = fromYmd(s);
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
/** One date style app-wide: "Wed 7 Oct" this year, "Sat 24 Apr 2027" in another year. */
export function dateFull(s: string) {
  const d = fromYmd(s);
  return `${dateLabel(s)}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}
/** Range: "5 – 11 Oct", "28 Sep – 4 Oct", "28 Dec 2026 – 3 Jan 2027". */
export function rangeLabel(a: string, b: string) {
  const x = fromYmd(a), y = fromYmd(b);
  const yr = (d: Date) => (d.getFullYear() !== new Date().getFullYear() || x.getFullYear() !== y.getFullYear() ? ` ${d.getFullYear()}` : "");
  if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) return `${x.getDate()} – ${y.getDate()} ${MONTHS[y.getMonth()]}${yr(y)}`;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}${x.getFullYear() !== y.getFullYear() ? ` ${x.getFullYear()}` : ""} – ${y.getDate()} ${MONTHS[y.getMonth()]}${yr(y)}`;
}
export function shortDate(s: string) {
  const d = fromYmd(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
/** minutes → "50 min" / "1:15 h" */
export function fmtDur(min: number) {
  if (!min) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? `${h}:${String(m).padStart(2, "0")} h` : `${h} h`;
}
/** minutes → "1:32:10" */
export function fmtHMS(min: number) {
  const s = Math.round(min * 60);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}
/** hours → "3.8 h" */
export function fmtHours(h: number, digits = 1) {
  return `${(Math.round(h * 10 ** digits) / 10 ** digits).toFixed(digits)} h`;
}
/** seconds per unit → "5:28" */
export function fmtPace(sec: number) {
  if (!sec || !isFinite(sec)) return "—";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtTime(hhmm: string) {
  return hhmm;
}
export function hoursToClock(h: number) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
