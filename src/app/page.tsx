// The public front page at "/", built on PR's design (2026-10-27): full-screen dark hero, then Train, Plan,
// Nutrition, Coach and Analysis, each text left and product right. Signed-in athletes never see it: proxy.ts
// sends them to /dashboard. In local mode (no accounts) the buttons open the app directly.
// Photos (PR, 2026-10-28): /landing/hero.webp (rider at sunrise; hero-tall.webp is the phone crop), /landing/trainer.webp
// (closing band), /food/*.webp (the meal library, shared with the Nutrition tab).
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { START } from "@/components/public/start";
import "./landing.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — create a plan, strategize nutrition, become the expert`,
  description: "A week-by-week plan for your race, every session from your watch, nutrition targets per day, and a coach that reads all of it.",
};

const SHOT = { width: 1440, height: 940 };

// The calendar mock-up: one week, training in blue, the rest of life in grey. Hours 06:00–20:00.
const DAYS = ["Mon 26", "Tue 27", "Wed 28", "Thu 29", "Fri 30", "Sat 31", "Sun 1"];
type Block = { d: number; from: number; to: number; t: string; sub?: string; kind: "train" | "life" };
const BLOCKS: Block[] = [
  { d: 0, from: 6, to: 7.5, t: "Long run", sub: "90 min, Z2", kind: "train" },
  { d: 0, from: 9, to: 10, t: "Stand-up", kind: "life" },
  { d: 0, from: 14, to: 15.5, t: "Design review", kind: "life" },
  { d: 1, from: 6.5, to: 7.75, t: "Swim", sub: "60 min, technique", kind: "train" },
  { d: 1, from: 10.5, to: 11.5, t: "Dentist", kind: "life" },
  { d: 1, from: 13, to: 14, t: "Lunch with Anna", kind: "life" },
  { d: 2, from: 8, to: 12, t: "Client workshop", kind: "life" },
  { d: 2, from: 18, to: 19.25, t: "Easy run", sub: "45 min, Z2", kind: "train" },
  { d: 3, from: 6.5, to: 7.9, t: "Threshold ride", sub: "75 min, Z4", kind: "train" },
  { d: 3, from: 11, to: 12, t: "Budget call", kind: "life" },
  { d: 3, from: 16.5, to: 17.5, t: "Kids pick-up", kind: "life" },
  { d: 4, from: 6.5, to: 7.75, t: "Swim", sub: "60 min, Z2", kind: "train" },
  { d: 4, from: 12, to: 13, t: "Lunch", kind: "life" },
  { d: 4, from: 17, to: 19, t: "Flight BER", kind: "life" },
  { d: 5, from: 8, to: 10.5, t: "Long ride", sub: "2:30 h, Z2", kind: "train" },
  { d: 5, from: 19, to: 20, t: "Dinner with Jonas", kind: "life" },
  { d: 6, from: 8, to: 9.25, t: "Run", sub: "65 min, Z2", kind: "train" },
  { d: 6, from: 11, to: 13, t: "Family", kind: "life" },
];
const H0 = 6, H1 = 20;

export default function Landing() {
  const start = START;
  const pct = (h: number) => `${((h - H0) / (H1 - H0)) * 100}%`;
  return (
    <main className="lp">
      <section className="lp-hero" aria-label="Velocity">
        <PublicNav tone="dark" start={start} accountsOn={ACCOUNTS_ON} />
        <div className="lp-hero-text">
          <h1><span>Create a plan</span><span>Strategize nutrition</span><span>Become the expert</span></h1>
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
        </div>
      </section>

      <section className="lp-band"><h2>Built for athletes, like you.</h2></section>

      <section className="lp-feature" id="train" aria-labelledby="train-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Train</div>
          <h2 id="train-h">Today&apos;s session, in front of you.</h2>
          <p>The plan, every logged activity and this week&apos;s totals in one place. On the phone, the next session starts with one tap.</p>
        </div>
        <div className="lp-devices">
          <div className="lp-laptop"><div className="lp-screen"><img src="/landing/dashboard-crop.webp" width={1310} height={790} alt="The dashboard: today's session, the next two days, this week's totals and the last activity with its route." /></div><div className="lp-laptop-base" /></div>
          <div className="lp-phone" aria-label="Phone app: today's session">
            <div className="lp-phone-top"><span className="wordmark">{BRAND.name}</span><span>Tue 27 Oct</span></div>
            <div className="lp-phone-hero">
              <div className="k">Today</div>
              <div className="big">Run</div>
              <div className="sub">Tempo, 60 min</div>
              <div className="row"><span>Pace /mi</span><b>10:15–11:15</b></div>
              <div className="row"><span>Garmin</span><b>connected</b></div>
            </div>
            <div className="lp-phone-next"><div><b>Tomorrow</b><span>Swim, 1:30 h</span></div><div><b>Thursday</b><span>Brick, 1:25 h</span></div></div>
            <div className="lp-phone-btn">Start session</div>
          </div>
        </div>
      </section>

      <section className="lp-feature" id="plan" aria-labelledby="plan-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Plan</div>
          <h2 id="plan-h">A plan with room for life.</h2>
          <p>Training, work and the rest of the week on one calendar. Sessions move around meetings; locked ones stay put.</p>
        </div>
        <div className="lp-cal" role="img" aria-label="A week calendar with training sessions in blue beside meetings, a dentist appointment, a flight and family time.">
          <div className="lp-cal-head"><b>26 Oct – 1 Nov</b><span className="lp-cal-src">Google Calendar and Outlook<i>Preview</i></span></div>
          <div className="lp-cal-grid">
            <div className="lp-cal-hours">{[6, 8, 10, 12, 14, 16, 18, 20].map((h) => <span key={h} style={{ top: pct(h) }}>{h}:00</span>)}</div>
            {DAYS.map((d, i) => (
              <div key={d} className="lp-cal-day">
                <div className="lp-cal-dh">{d}</div>
                <div className="lp-cal-col">
                  {BLOCKS.filter((b) => b.d === i).map((b) => (
                    <div key={b.t + b.from} className={`lp-ev ${b.kind}`} style={{ top: pct(b.from), height: `calc(${((b.to - b.from) / (H1 - H0)) * 100}% - 2px)` }}><b>{b.t}</b>{b.sub && <span>{b.sub}</span>}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-feature" id="nutrition" aria-labelledby="nutrition-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Nutrition</div>
          <h2 id="nutrition-h">Food planned around the session.</h2>
          <p>Daily targets from your weight and the day&apos;s training. Carbohydrate timed before, during and after each session, with the clock times.</p>
        </div>
        <div className="lp-nutri">
          <figure className="lp-shot lp-shot-fuel"><img src="/landing/nutrition-fuel.webp" width={940} height={790} loading="lazy" alt="Carbohydrate panel: 404 g target for the day, split into before, during and after the session." /></figure>
          <div className="lp-fuel-cards">
            <div className="lp-fuel"><img className="lp-food" src="/food/oats-banana-s.webp" width={64} height={64} loading="lazy" alt="Oats with banana and honey" /><b>Before</b><p>30 g carbs by 05:45. Low fibre, low fat.</p></div>
            <div className="lp-fuel"><img className="lp-food" src="/food/water-s.webp" width={64} height={64} loading="lazy" alt="A water bottle" /><b>During</b><p>Water, 0.7 L per hour. Carbs only past 75 minutes.</p></div>
            <div className="lp-fuel"><img className="lp-food" src="/food/chicken-rice-s.webp" width={64} height={64} loading="lazy" alt="Chicken, rice and broccoli" /><b>After</b><p>75 g carbs and 22 g protein within 2 hours.</p></div>
          </div>
        </div>
      </section>

      <section className="lp-feature" id="coach" aria-labelledby="coach-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Coach</div>
          <h2 id="coach-h">A coach that knows your context.</h2>
          <p>It reads your plan, your sessions, your body data and your meals before it answers. Changes to the plan are proposals until you accept them.</p>
        </div>
        <div className="lp-chats">
          <div className="lp-chat">
            <div className="lp-msg lp-you">My calves cramped near the end of the long run.</div>
            <div className="lp-msg lp-them">That was the pace, not the salt. You ran the last 5 km at 9:50 /mi against a 10:15–11:15 target, on the longest run you&apos;ve done in 30 days. Next long run, hold the easy range. I&apos;ll add calf raises twice a week; if it happens again we look at sodium.<sup>1</sup></div>
            <div className="lp-src"><span>1</span>Schwellnus, Br J Sports Med 2009</div>
          </div>
          <div className="lp-chat">
            <div className="lp-msg lp-you">Log chicken and rice for last night.</div>
            <div className="lp-msg lp-them">Logged. Dinner, chicken and rice, 620 kcal, 68 g carbs. That puts yesterday at 310 g of the 404 g carb target.</div>
            <div className="lp-proposal"><div className="lp-prop-head">Proposed change</div><b>Thursday&apos;s ride to 18:00.</b><p>You asked for after work; your evening slot is 18:00.</p><div className="lp-prop-actions"><span className="btn small">Accept</span><span className="btn small ghost">Decline</span></div></div>
          </div>
        </div>
      </section>

      <section className="lp-feature" id="analysis" aria-labelledby="analysis-h">
        <div className="lp-text">
          <div className="lp-eyebrow">Analysis</div>
          <h2 id="analysis-h">Become your own analyst.</h2>
          <p>Key metrics with their definitions: load, fitness, form, pace per sport, zone time, compliance. Every week the coach reviews the numbers with you.</p>
          <ul className="lp-facts">
            <li>Zones from your own threshold tests, not your age.</li>
            <li>Hover any number and it says how it is measured.</li>
            <li>Sunday review: what the week did, what changes.</li>
          </ul>
        </div>
        <figure className="lp-shot"><img src="/landing/analysis-crop.webp" width={1280} height={605} loading="lazy" alt="The Analysis page: key figures, the Sunday review facts and the fitness, fatigue and form chart." /></figure>
      </section>

      <section className="lp-close" aria-label="Create an account">
        <img src="/landing/trainer.webp" width={2233} height={1026} loading="lazy" alt="" />
        <div className="lp-close-text">
          <h2><span>Create a plan</span><span>Strategize nutrition</span><span>Become the expert</span></h2>
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
