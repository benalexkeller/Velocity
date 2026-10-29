// The calendar mock-up used on the front page and the Train product page: one week, training in blue, the rest of
// life in grey, hours 06:00 to 20:00. It is not live data (calendar sync is not in the app yet); the "Preview" tag
// says so. With `animate`, Thursday's ride slides to the evening, a run appears on Friday and the request to the
// coach is typed under the grid (the loop lives in landing.css: lp-move, lp-new, lp-type). Under the grid, the
// weekly-hours strip shows where the week sits in the whole plan.
const DAYS = ["Mon 26", "Tue 27", "Wed 28", "Thu 29", "Fri 30", "Sat 31", "Sun 1"];
type Block = { d: number; from: number; to: number; t: string; sub?: string; kind: "train" | "life"; anim?: "move" | "new" };
const BLOCKS: Block[] = [
  { d: 0, from: 6, to: 7.5, t: "Long run", sub: "90 min, Z2", kind: "train" },
  { d: 0, from: 9, to: 10, t: "Stand-up", kind: "life" },
  { d: 0, from: 14, to: 15.5, t: "Design review", kind: "life" },
  { d: 1, from: 6.5, to: 7.75, t: "Swim", sub: "2,500 yd, technique", kind: "train" },
  { d: 1, from: 10.5, to: 11.5, t: "Dentist", kind: "life" },
  { d: 1, from: 13, to: 14, t: "Lunch with Anna", kind: "life" },
  { d: 2, from: 8, to: 12, t: "Client workshop", kind: "life" },
  { d: 2, from: 18, to: 19.25, t: "Easy run", sub: "45 min, Z2", kind: "train" },
  { d: 3, from: 6.5, to: 7.9, t: "Threshold ride", sub: "75 min, Z4", kind: "train", anim: "move" },
  { d: 3, from: 11, to: 12, t: "Budget call", kind: "life" },
  { d: 3, from: 16.5, to: 17.5, t: "Kids pick-up", kind: "life" },
  { d: 4, from: 6.5, to: 7.75, t: "Swim", sub: "3,000 yd, Z2", kind: "train" },
  { d: 4, from: 12, to: 13, t: "Lunch", kind: "life" },
  { d: 4, from: 17, to: 19, t: "Flight BER", kind: "life" },
  { d: 4, from: 14.25, to: 15.5, t: "Run", sub: "60 min, Z2", kind: "train", anim: "new" },
  { d: 5, from: 8, to: 10.5, t: "Long ride", sub: "2:30 h, Z2", kind: "train" },
  { d: 5, from: 19, to: 20, t: "Dinner with Jonas", kind: "life" },
  { d: 6, from: 8, to: 9.25, t: "Run", sub: "65 min, Z2", kind: "train" },
  { d: 6, from: 11, to: 13, t: "Family", kind: "life" },
];
const H0 = 6, H1 = 20;
// 33 weeks of planned hours: a textbook ramp with recovery weeks every third or fourth week, the race at the end
const RAMP = [5, 5.4, 6, 4.5, 6.8, 5.3, 7.6, 8.5, 9.4, 5.5, 10.4, 5.7, 10.6, 11.2, 11.6, 6, 12.1, 11.8, 13, 13.6, 14.1, 7.4, 14.6, 15.2, 15.4, 8.3, 15.4, 14.9, 14.3, 11.4, 9.7, 6.3, 4];
const pct = (h: number) => `${((h - H0) / (H1 - H0)) * 100}%`;

export function CalendarMock({ animate = true }: { animate?: boolean }) {
  const label = animate
    ? "A week calendar with training sessions in blue beside meetings, a dentist appointment, a flight and family time. A ride moves to the evening, a run is added, and the athlete asks the coach to move a session."
    : "A week calendar with training sessions in blue beside meetings, a dentist appointment, a flight and family time, and the weekly hours of the whole plan underneath.";
  return (
    <div className={`lp-cal${animate ? "" : " lp-cal-still"}`} role="img" aria-label={label}>
      <div className="lp-cal-head"><b>26 Oct - 1 Nov</b><span className="lp-cal-src">Google Calendar and Outlook<i>Preview</i></span></div>
      <div className="lp-cal-grid">
        <div className="lp-cal-hours">{[6, 8, 10, 12, 14, 16, 18, 20].map((h) => <span key={h} style={{ top: pct(h) }}>{h}:00</span>)}</div>
        {DAYS.map((d, i) => (
          <div key={d} className="lp-cal-day">
            <div className="lp-cal-dh">{d}</div>
            <div className="lp-cal-col">
              {BLOCKS.filter((b) => b.d === i && (animate || b.anim !== "new")).map((b) => (
                <div key={b.t + b.from} className={`lp-ev ${b.kind}${animate && b.anim ? ` lp-anim-${b.anim}` : ""}`} style={{ top: pct(b.from), height: `calc(${((b.to - b.from) / (H1 - H0)) * 100}% - 2px)` }}><b>{b.t}</b>{b.sub && <span>{b.sub}</span>}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lp-cal-foot">
        <div className="lp-ramp" aria-label="Weekly hours across the plan">
          {RAMP.map((h, i) => <i key={i} className={i === 7 ? "now" : i === 32 ? "race" : ""} style={{ height: `${(h / 16) * 100}%` }} />)}
          <span className="lp-ramp-now">Week 8</span><span className="lp-ramp-race">Race</span>
        </div>
        {animate && <div className="lp-cal-coach"><span className="lp-cal-typing">Move Thursday&apos;s ride to after work<i /></span><em>→</em></div>}
      </div>
    </div>
  );
}
