require('./bundle.cjs'); const V = globalThis.V;
const t = new Date(2026, 9, 7);
const base = { goal: { type: "marathon", event: "M", location: "", date: "2027-01-24", kind: "finish", target_hours: null, splits: null },
  history: { raced: false, races: [], sessions_per_week: 3, hours: { swim: 0, bike: 0, run: 2, strength: 0 } },
  fitness: { swim_pace_100: "", swim_longest: null, bike_speed: null, bike_ftp: null, bike_longest: null, run_pace: "10:00", run_longest: 4, vo2max: null, rhr: null, lthr: null, garmin_later: false },
  time: { max_hours: 10, days: [1,2,3,4,5,6,0], time_of_day: "morning", weekend_start: "08:00", long_weekend: true, blackouts: [], calendar_sync: false },
  devices: [], strength: false, created_at: "" };
const { weeks, summary } = V.generatePlan(base, t, true);
console.log('hours', summary.hours.map(h=>h.toFixed(2)).join(' '));
let prev=null; for (let i=0;i<summary.hours.length;i++){ const h=summary.hours[i]; console.log('W'+(i+1), h.toFixed(2), prev? ((h/prev-1)*100).toFixed(0)+'%':'', weeks[i].recovery?'REC':'', weeks[i].phase); prev=h; }
for (const n of [1,2,3,4,5]) { const w = weeks[n-1]; console.log('--- W'+n, w.focus); for (const d of w.days) console.log('   ', String(d.min).padStart(4), d.text); }
console.log('\nactual scheduled hours per week:');
let ps=null; weeks.forEach((w,i)=>{ const s=w.days.reduce((a,d)=>a+(/^Race day/.test(d.text)?0:d.min),0)/60; const lr=Math.max(0,...w.days.filter(d=>/Long run/.test(d.text)).map(d=>d.min)); console.log('W'+(i+1), 'target', summary.hours[i].toFixed(2), 'scheduled', s.toFixed(2), ps!=null?((s/ps-1)*100).toFixed(0)+'%':'', w.recovery?'REC':'', 'longRun', lr, 'sessions', w.days.filter(d=>d.min>0&&!/^Race day/.test(d.text)).length); ps=s; });
