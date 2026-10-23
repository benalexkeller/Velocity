require('./bundle.cjs'); const V = globalThis.V;
const t = new Date(2026, 9, 7); // Wed 7 Oct 2026 → planStart Mon 5 Oct
// 16 weeks: race Sunday 24 Jan 2027? planStart 5 Oct; raceMon = 18 Jan → (18 Jan - 5 Oct)/7 + 1 = 15+1 = 16 weeks
const intake = { goal: { type: "70.3", event: "Test 70.3", location: "", date: "2027-01-24", kind: "time", target_hours: 6, splits: null },
  history: { raced: true, races: [], sessions_per_week: 5, hours: { swim: 1, bike: 3, run: 2, strength: 0 } },
  fitness: { swim_pace_100: "2:00", swim_longest: 2000, bike_speed: 17, bike_ftp: null, bike_longest: 40, run_pace: "9:30", run_longest: 8, vo2max: null, rhr: null, lthr: null, garmin_later: false },
  time: { max_hours: 10, days: [1,2,3,4,5,6,0], time_of_day: "morning", weekend_start: "08:00", long_weekend: true, blackouts: [], calendar_sync: false },
  devices: ["garmin"], strength: false, created_at: "" };
const { weeks, summary } = V.generatePlan(intake, t, true);
console.log('N', summary.weeks, 'start', summary.start, 'phases', JSON.stringify(summary.phases), 'peakHours', summary.peakHours, 'longest', JSON.stringify(summary.longest));
console.log('stated longest (h): ride', 40/17, 'run', 8*570/3600, 'swim', 20*120/3600);
let prevH = null, prevSum = null;
for (const w of weeks) {
  const i = w.week - 1; const H = summary.hours[i];
  const sum = w.days.reduce((s, d) => s + (/^Race day/.test(d.text) ? 0 : d.min), 0) / 60;
  const longRide = Math.max(0, ...w.days.filter(d=>/Long ride|Race sim|Brick/.test(d.text)).map(d=>d.min))/60;
  const longRun = Math.max(0, ...w.days.filter(d=>/Long run/.test(d.text)).map(d=>d.min))/60;
  console.log(`W${String(w.week).padStart(2)} ${w.start} ${w.phase.padEnd(30)} ${w.recovery?'REC ':'    '} target ${H.toFixed(2)} h (${prevH!=null? ((H/prevH-1)*100).toFixed(0).padStart(4)+'%':'    '})  actual ${sum.toFixed(2)} h (${prevSum!=null? ((sum/prevSum-1)*100).toFixed(0).padStart(4)+'%':'    '})  longRide ${longRide.toFixed(2)}  longRun ${longRun.toFixed(2)}`);
  prevH = H; prevSum = sum;
}
console.log('\nWeek 1 & 9 & 14 & 16 sessions:');
for (const n of [1, 4, 5, 9, 13, 14, 15, 16]) { const w = weeks[n-1]; console.log('--- W'+n, w.phase, w.focus); for (const d of w.days) console.log('   ', String(d.min).padStart(4), d.text); }
