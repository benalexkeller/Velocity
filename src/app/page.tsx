// The public front page at "/", built on PR's design (2026-10-27, reviewed 2026-10-29): a full-screen photo that
// stays put while the white page slides up over it, a fixed top bar whose text turns black as it meets the white,
// then Train, Plan, Nutrition, Coach and Analysis, each sliding into view. Signed-in athletes never see it: proxy.ts
// sends them to /dashboard. In local mode (no accounts) the buttons open the app directly.
// Photos: /landing/hero.webp (rider at sunrise; hero-tall.webp is the phone crop), /landing/trainer.webp (closing band),
// /food/*.webp (the meal library, shared with the Nutrition tab). Screenshots come from scripts/product-shots.js.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { SportIcon } from "@/components/SportIcon";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Reveal } from "@/components/public/Reveal";
import { START } from "@/components/public/start";
import "./landing.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — create a plan, strategize nutrition, become the expert`,
  description: "A week-by-week plan for your race, every session from your watch, nutrition targets per day, and a coach that reads all of it.",
};

// The calendar mock-up: one week, training in blue, the rest of life in grey. Hours 06:00–20:00. It is not live
// data (calendar sync is not in the app yet); the "Preview" tag says so. Thursday's ride moves to the evening in
// the animation, and a new run appears on Friday.
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
// the weekly-hours strip under the calendar: 33 weeks, a textbook ramp with recovery weeks, the race at the end
const RAMP = [5, 5.4, 6, 4.5, 6.8, 5.3, 7.6, 8.5, 9.4, 5.5, 10.4, 5.7, 10.6, 11.2, 11.6, 6, 12.1, 11.8, 13, 13.6, 14.1, 7.4, 14.6, 15.2, 15.4, 8.3, 15.4, 14.9, 14.3, 11.4, 9.7, 6.3, 4];

export default function Landing() {
  const start = START;
  const pct = (h: number) => `${((h - H0) / (H1 - H0)) * 100}%`;
  return (
    <main className="lp">
      <PublicNav tone="dark" start={start} accountsOn={ACCOUNTS_ON} sticky />
      <section className="lp-hero" aria-label="Velocity">
        <div className="lp-hero-text">
          <h1><span>Create a plan</span><span>Strategize nutrition</span><span>Become the expert</span></h1>
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
        </div>
      </section>

      <div className="lp-body">
      <Reveal className="lp-band"><h2>Built for athletes.</h2></Reveal>

      <Reveal className="lp-feature" id="train" aria-labelledby="train-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Train</div>
          <h2 id="train-h">Today&apos;s session, easily explained</h2>
          <ul className="lp-facts">
            <li>Check the splits, connect your wearable and start the session</li>
            <li>See the next two planned activities to shape today&apos;s</li>
            <li>Your core metrics and the week&apos;s totals, in front of you</li>
          </ul>
        </div>
        <div className="lp-devices">
          <div className="lp-laptop"><div className="lp-screen"><img src="/landing/dashboard-crop.webp" width={1310} height={790} alt="The dashboard: today's session, the next two days, this week's totals and the last activity with its route." /></div><div className="lp-laptop-base" /></div>
          <div className="lp-phone" aria-label="Phone app: today's session">
            <div className="lp-phone-status"><span>9:41</span><span className="lp-phone-sig"><i /><i /><i /><i /><b><em /></b></span></div>
            <div className="lp-phone-top"><span className="wordmark">{BRAND.name}</span><span>Thu 29 Oct</span></div>
            <div className="lp-phone-hero">
              <div className="k">Today</div>
              <div className="big"><SportIcon sport="run" size={22} />Run</div>
              <div className="sub">Tempo, 60 min</div>
              <div className="lp-phone-stats"><div><span>Pace</span><b>10:15-11:15</b></div><div><span>Zone</span><b>Z3</b></div><div><span>Load</span><b>68</b></div></div>
              <div className="lp-phone-gm"><i />Garmin connected</div>
            </div>
            <ol className="lp-phone-steps">
              <li><i>1</i>Warm-up<span>10 min</span></li>
              <li><i>2</i>Tempo 3 × 10 min<span>40 min</span></li>
              <li><i>3</i>Cool-down<span>10 min</span></li>
            </ol>
            <div className="lp-phone-next"><div><b>Tomorrow</b><span>Swim 3,000 yd</span></div><div><b>Saturday</b><span>Ride 2:30</span></div></div>
            <div className="lp-phone-btn">Start session</div>
            <div className="lp-phone-tabs"><span className="on">Today</span><span>Plan</span><span>Nutrition</span><span>Coach</span></div>
          </div>
          <div className="lp-watch" aria-label="Garmin connected">
            <svg className="lp-watch-img" viewBox="0 0 120 150" aria-hidden="true">
              <rect x="38" y="4" width="44" height="26" rx="6" fill="#1B1C20" /><rect x="38" y="120" width="44" height="26" rx="6" fill="#1B1C20" />
              <circle cx="60" cy="75" r="54" fill="#1B1C20" /><circle cx="60" cy="75" r="46" fill="#0B0C10" stroke="#3A3C44" strokeWidth="2" />
              <rect x="112" y="60" width="6" height="12" rx="2" fill="#2A2C33" /><rect x="112" y="82" width="6" height="12" rx="2" fill="#2A2C33" />
              <text x="60" y="63" textAnchor="middle" fill="#9AA0AE" fontSize="9" fontWeight="600" letterSpacing="1">RUN</text>
              <text x="60" y="88" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="600" letterSpacing="-0.5">42:18</text>
              <text x="60" y="104" textAnchor="middle" fill="#9AA0AE" fontSize="8">10:32 /mi</text>
              <circle cx="60" cy="75" r="40" fill="none" stroke="#2459FE" strokeWidth="3" strokeDasharray="176 76" strokeLinecap="round" transform="rotate(-90 60 75)" />
            </svg>
            <div className="lp-watch-card"><b>Garmin</b><span><i />Connected</span><small>Last sync 07:42</small></div>
          </div>
        </div>
      </Reveal>

      <Reveal className="lp-feature" id="plan" aria-labelledby="plan-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Plan</div>
          <h2 id="plan-h">Life moves fast, your plan adapts around it</h2>
          <ul className="lp-facts">
            <li>Every activity planned around your schedule</li>
            <li>Attach your own calendar so others see when you&apos;re busy</li>
            <li>Drag and drop sessions, or add one when you&apos;re feeling good</li>
          </ul>
        </div>
        <div className="lp-cal" role="img" aria-label="A week calendar with training sessions in blue beside meetings, a dentist appointment, a flight and family time. A ride moves to the evening, a run is added, and the athlete asks the coach to move a session.">
          <div className="lp-cal-head"><b>26 Oct - 1 Nov</b><span className="lp-cal-src">Google Calendar and Outlook<i>Preview</i></span></div>
          <div className="lp-cal-grid">
            <div className="lp-cal-hours">{[6, 8, 10, 12, 14, 16, 18, 20].map((h) => <span key={h} style={{ top: pct(h) }}>{h}:00</span>)}</div>
            {DAYS.map((d, i) => (
              <div key={d} className="lp-cal-day">
                <div className="lp-cal-dh">{d}</div>
                <div className="lp-cal-col">
                  {BLOCKS.filter((b) => b.d === i).map((b) => (
                    <div key={b.t + b.from} className={`lp-ev ${b.kind}${b.anim ? ` lp-anim-${b.anim}` : ""}`} style={{ top: pct(b.from), height: `calc(${((b.to - b.from) / (H1 - H0)) * 100}% - 2px)` }}><b>{b.t}</b>{b.sub && <span>{b.sub}</span>}</div>
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
            <div className="lp-cal-coach"><span className="lp-cal-typing">Move Thursday&apos;s ride to after work<i /></span><em>→</em></div>
          </div>
        </div>
      </Reveal>

      <Reveal className="lp-feature" id="nutrition" aria-labelledby="nutrition-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Nutrition</div>
          <h2 id="nutrition-h">Food planned around the session</h2>
          <ul className="lp-facts">
            <li>Meal plans set from your attributes, tastes and the day&apos;s training</li>
            <li>Concise fuelling recommendations for every activity</li>
          </ul>
        </div>
        <div className="lp-nutri">
          <figure className="lp-shot lp-shot-fuel"><img src="/landing/nutrition-fuel.webp" width={940} height={790} loading="lazy" alt="Activity fuel plan: the carbohydrate target for the day, split into before, during and after the session, each against what was logged." /></figure>
          <div className="lp-fuel-cards">
            <div className="lp-fuel"><img className="lp-food" src="/food/oats-banana-s.webp" width={64} height={64} loading="lazy" alt="Oats with banana and honey" /><b>Before</b><p>30 g carbs by 05:45. Low fibre, low fat.</p></div>
            <div className="lp-fuel"><img className="lp-food" src="/food/water-s.webp" width={64} height={64} loading="lazy" alt="A water bottle" /><b>During</b><p>Water, 0.7 L per hour. Carbs only past 75 minutes.</p></div>
            <div className="lp-fuel"><img className="lp-food" src="/food/chicken-rice-s.webp" width={64} height={64} loading="lazy" alt="Chicken, rice and broccoli" /><b>After</b><p>75 g carbs and 22 g protein within 2 hours.</p></div>
          </div>
        </div>
      </Reveal>

      <Reveal className="lp-feature" id="coach" aria-labelledby="coach-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Coach</div>
          <h2 id="coach-h">A coach that knows your situation and doesn&apos;t forget</h2>
          <ul className="lp-facts">
            <li>Reads your plan, your sessions, your body data and your nutrition before every answer</li>
            <li>Reschedules activities, adjusts splits and redesigns your long-term plan around your life</li>
            <li>Recommendations informed by professional coaches and sports doctors</li>
          </ul>
        </div>
        <div className="lp-chats">
          <div className="lp-chat">
            <div className="lp-msg lp-you">My calves cramped near the end of the long run.</div>
            <div className="lp-msg lp-them">
              <p>That was the pace, not the salt.</p>
              <ul>
                <li>Last 3 miles at <b>9:50 /mi</b> against a 10:15-11:15 target</li>
                <li>Longest run in 30 days: <b>13.1 mi</b>, up from 11.2</li>
                <li>Sodium intake not in your data, so no reason to blame it yet</li>
              </ul>
              <p>Next long run, hold the easy range. Calf raises go in twice a week from Monday.<sup>1</sup></p>
            </div>
            <div className="lp-msg lp-you">So how can I stretch them out now, what are the best stretches?</div>
            <div className="lp-msg lp-them">
              <p>Easy ones, nothing forced for 48 hours.</p>
              <ul>
                <li><b>Wall calf stretch</b>, straight knee, 3 × 30 s each side</li>
                <li><b>Bent-knee version</b> for the soleus, 3 × 30 s</li>
                <li><b>Foam roll</b> the calf, 2 min each, before the stretches</li>
              </ul>
              <p>Walk tomorrow, swim Wednesday as planned. If the cramp comes back at the right pace, we look at sodium.</p>
            </div>
            <div className="lp-src"><span>1</span>Schwellnus, Br J Sports Med 2009</div>
          </div>
          <div className="lp-chat">
            <div className="lp-msg lp-you">Log chicken and rice for last night.</div>
            <div className="lp-msg lp-them">Logged under dinner. That puts yesterday at 310 g of the 404 g carb target.</div>
            <div className="lp-meal"><img src="/food/chicken-rice-s.webp" width={56} height={56} alt="Chicken, rice and broccoli" loading="lazy" /><div><b>Chicken, rice and broccoli</b><span>Dinner, 1 serving</span><span>550 kcal, 65 g carbs, 55 g protein</span></div><em>Logged</em></div>
            <div className="lp-msg lp-you">Move Thursday&apos;s ride to after work.</div>
            <div className="lp-proposal"><div className="lp-prop-head">Proposed change</div><b>Thursday&apos;s ride to 18:00</b><p>You asked for after work; your evening slot is 18:00.</p><div className="lp-prop-actions"><span className="btn small">Accept</span><span className="btn small ghost">Decline</span></div></div>
          </div>
        </div>
      </Reveal>

      <Reveal className="lp-feature" id="analysis" aria-labelledby="analysis-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Analysis</div>
          <h2 id="analysis-h">The full picture of your training</h2>
          <ul className="lp-facts">
            <li>Key metrics tracked, projected and digested into better training recommendations</li>
            <li>Your total workload against the planned load, day by day, week by week</li>
          </ul>
        </div>
        <figure className="lp-shot"><img src="/landing/analysis-crop.webp" width={1280} height={605} loading="lazy" alt="The Analysis page: key figures, the Sunday review and training volume against the plan." /></figure>
      </Reveal>

      <Reveal className="lp-close" aria-label="Create an account">
        <img src="/landing/trainer.webp" width={2233} height={1026} loading="lazy" alt="" />
        <div className="lp-close-text">
          <h2><span>Create a plan</span><span>Strategize nutrition</span><span>Become the expert</span></h2>
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
        </div>
      </Reveal>

      <PublicFooter />
      </div>
    </main>
  );
}
