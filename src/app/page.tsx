// The public front page at "/". Signed-in athletes never see it: proxy.ts sends them to /dashboard.
// In local mode (no accounts) the buttons open the app directly.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { GARMIN_ON } from "@/lib/integrations/config";
import "./landing.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — training plans that react to the training you did`,
  description: "A week-by-week plan for your race, every session from your watch, nutrition targets per day, and a coach that reviews the week against the plan.",
};

const STEPS = [
  { t: "Set the race", d: "Event, date, goal time, the hours you have each week and the days you can't train." },
  { t: "Get the plan", d: "Built in about 30 seconds from published coaching rules. Every session has a zone, a target pace and numbered steps." },
  { t: "Train", d: "Sessions come in from your watch or get logged by hand. Each one is matched to the session it was meant to be." },
  { t: "Weekly review", d: "The coach compares the week with the plan and proposes changes. You accept or decline each one." },
];

export default function Landing() {
  const start = ACCOUNTS_ON ? { href: "/login?mode=up", label: "Create account" } : { href: "/dashboard", label: "Open the app" };
  return (
    <main className="lp">
      <header className="lp-top">
        <span className="wordmark">{BRAND.name}</span>
        <nav aria-label="Account">
          {ACCOUNTS_ON && <Link href="/login" className="lp-link">Sign in</Link>}
          <Link href={start.href} className="btn">{start.label}</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <h1>A training plan that reacts to the training you did.</h1>
        <p className="lp-lead">
          {BRAND.name} builds a week-by-week plan for your race, takes every session from your watch, and reviews the week against the plan.
          Load is counted from work done. There is no readiness score and nothing to keep a streak for.
        </p>
        <div className="lp-cta">
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
          <span className="lp-note">Run, bike, triathlon. Marathon to full-distance Ironman.</span>
        </div>
        <figure className="lp-shot lp-shot-hero">
          <img src="/landing/dashboard.webp" width={1440} height={940} alt="The dashboard: today's session as a black card with duration, intensity and target pace; the next two days; this week's sessions, hours and load; the last activity with its route." />
        </figure>
      </section>

      <section className="lp-steps" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="lp-n">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-feature" aria-labelledby="plan">
        <div className="lp-text">
          <h2 id="plan">The plan is a calendar you can move things in.</h2>
          <ul className="lp-facts">
            <li>Week and month views. Drag a session to another day or time.</li>
            <li>Lock a session and the coach&apos;s changes go around it.</li>
            <li>Each session: zone, target pace, planned load, and the steps in order.</li>
            <li>The whole plan as one chart: phases, weekly hours and where you are now.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/plan.webp" width={1440} height={940} loading="lazy" alt="The Plan page: a week grid from 06:00 to 20:00 with sessions placed at their times, and a session panel showing duration, zone, target pace and seven numbered steps." />
        </figure>
      </section>

      <section className="lp-feature lp-flip" aria-labelledby="nutrition">
        <div className="lp-text">
          <h2 id="nutrition">Food is planned around the session, not the other way round.</h2>
          <ul className="lp-facts">
            <li>Daily calories, carbohydrate, protein, fat and fluid targets from your weight and the day&apos;s training.</li>
            <li>Carbohydrate split into before, during and after each session, with the clock times.</li>
            <li>Staged weight targets along the plan&apos;s phases, not one number for the whole year.</li>
            <li>Supplements graded by the evidence, with the studies attached.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/nutrition.webp" width={1440} height={940} loading="lazy" alt="The Nutrition page: calories, carbs, protein, fat and hydration against the day's targets; the daily timeline with the session and logged meals; carbohydrate timing before, during and after the session." />
        </figure>
      </section>

      <section className="lp-feature" aria-labelledby="analysis">
        <div className="lp-text">
          <h2 id="analysis">The numbers a coach would look at, with the definitions.</h2>
          <ul className="lp-facts">
            <li>Pace per sport over time, weekly volume against the plan, load and compliance.</li>
            <li>Heart-rate zones from your own threshold tests, not from your age.</li>
            <li>Every metric shows how it is measured when you hover over it.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/analysis.webp" width={1440} height={940} loading="lazy" alt="The Analysis page: key figures, pace trends per sport, weekly volume and zone tables." />
        </figure>
      </section>

      <section className="lp-coach" aria-labelledby="coach">
        <div className="lp-text">
          <h2 id="coach">Ask the coach. It answers from your data and changes the plan only when you say so.</h2>
          <p>The coach reads your plan, your logged sessions, your body data and your nutrition. It can move, shorten or swap sessions, but every change to the plan is a proposal until you accept it.</p>
        </div>
        <div className="lp-chat" aria-label="Example conversation with the coach">
          <div className="lp-msg lp-you">Move Thursday&apos;s ride to after work.</div>
          <div className="lp-msg lp-them">Thursday&apos;s ride is now at 18:00. It was 06:30. Nothing else changed.</div>
          <div className="lp-msg lp-you">Was last week too light?</div>
          <div className="lp-msg lp-them">3.0 h done of 6.7 h planned. Longest ride 1:10 against 2:15 planned. The run sessions were complete.</div>
          <div className="lp-proposal">
            <div className="lp-prop-head">Proposed change</div>
            <b>Long rides restart at 1:30 on Saturday, then 15 minutes more each week.</b>
            <p>Reason: the longest ride in the last 30 days is 1:10. The plan had 2:15 this week.</p>
            <div className="lp-prop-actions"><span className="btn small">Accept</span><span className="btn small ghost">Decline</span></div>
          </div>
        </div>
      </section>

      <section className="lp-devices" aria-labelledby="devices">
        <h2 id="devices">Devices</h2>
        {GARMIN_ON ? (
          <p>Garmin connects in one step and every activity arrives on its own, with the route and heart rate. Anything else is logged by hand in under a minute, or imported from a spreadsheet.</p>
        ) : (
          <p>Garmin sync is being set up. Until it is on, activities are logged by hand in under a minute or imported from a spreadsheet.</p>
        )}
        <p className="lp-muted">Apple Watch, COROS, Polar, Suunto, WHOOP and Wahoo are next. Tell us which one you use from inside the app.</p>
      </section>

      <section className="lp-end">
        <h2>Start with the race.</h2>
        <div className="lp-cta">
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
          {ACCOUNTS_ON && <Link href="/login" className="lp-link">Sign in</Link>}
        </div>
      </section>

      <footer className="lp-foot">
        <span className="wordmark">{BRAND.name}</span>
        <span>Only you can see your data. Your activities are never used to train models.</span>
      </footer>
    </main>
  );
}
