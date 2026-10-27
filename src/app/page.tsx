// The public front page at "/". Signed-in athletes never see it: proxy.ts sends them to /dashboard.
// In local mode (no accounts) the buttons open the app directly.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { GARMIN_ON } from "@/lib/integrations/config";
import "./landing.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — a training plan that reacts to the training you did`,
  description: "A week-by-week plan for your race, every session from your watch, nutrition targets per day, and a coach that reviews the week against the plan.",
};

const STEPS = [
  { t: "Set the race", d: "Event, date, goal time, hours per week." },
  { t: "Get the plan", d: "Built in 30 seconds. Every session has a zone, a pace and the steps." },
  { t: "Train", d: "Sessions arrive from your watch or get logged by hand." },
  { t: "Review weekly", d: "The coach proposes changes. You accept or decline." },
];

const SHOT = { width: 1440, height: 940 };

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
        <p className="lp-lead">A week-by-week plan for your race. Every session from your watch. A weekly review against the plan. No readiness score, no streaks.</p>
        <div className="lp-cta">
          <Link href={start.href} className="btn lp-big">{start.label}</Link>
          <span className="lp-note">Run, bike, triathlon. 5K to full-distance Ironman.</span>
        </div>
        <figure className="lp-shot lp-shot-hero">
          <img src="/landing/dashboard.webp" {...SHOT} alt="The dashboard: today's session, the next two days, this week's totals and the last activity with its route." />
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
          <h2 id="plan">A calendar you can move things in.</h2>
          <ul className="lp-facts">
            <li>Drag a session to another day or time.</li>
            <li>Lock the ones that can&apos;t move.</li>
            <li>Each session: zone, target pace, load, steps in order.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/plan.webp" {...SHOT} loading="lazy" alt="The Plan page: a week grid with sessions at their times and a session panel with duration, zone, target pace and numbered steps." />
        </figure>
      </section>

      <section className="lp-feature lp-flip" aria-labelledby="nutrition">
        <div className="lp-text">
          <h2 id="nutrition">Food planned around the session.</h2>
          <ul className="lp-facts">
            <li>Calories, carbs, protein, fat and fluid targets from your weight and the day&apos;s training.</li>
            <li>Carbs timed before, during and after each session.</li>
            <li>Weight targets per training phase.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/nutrition.webp" {...SHOT} loading="lazy" alt="The Nutrition page: daily targets, the timeline with the session and meals, and carbohydrate timing around the session." />
        </figure>
      </section>

      <section className="lp-feature" aria-labelledby="analysis">
        <div className="lp-text">
          <h2 id="analysis">The numbers a coach looks at.</h2>
          <ul className="lp-facts">
            <li>Pace per sport over time, volume against the plan, load, compliance.</li>
            <li>Zones from your own threshold tests.</li>
            <li>Every number explains how it is measured.</li>
          </ul>
        </div>
        <figure className="lp-shot">
          <img src="/landing/analysis.webp" {...SHOT} loading="lazy" alt="The Analysis page: key figures, pace trends per sport, weekly volume and zone tables." />
        </figure>
      </section>

      <section className="lp-coach" aria-labelledby="coach">
        <div className="lp-text">
          <h2 id="coach">A coach that answers from your data.</h2>
          <p>It reads your plan, your sessions and your body data. Changes to the plan are proposals until you accept them.</p>
        </div>
        <div className="lp-chat" aria-label="Example conversation with the coach">
          <div className="lp-msg lp-you">Move Thursday&apos;s ride to after work.</div>
          <div className="lp-msg lp-them">Thursday&apos;s ride is now at 18:00. It was 06:30.</div>
          <div className="lp-msg lp-you">Was last week too light?</div>
          <div className="lp-msg lp-them">3.0 h done of 6.7 h planned. Longest ride 1:10 against 2:15. Runs complete.</div>
          <div className="lp-proposal">
            <div className="lp-prop-head">Proposed change</div>
            <b>Long rides restart at 1:30, then 15 min more each week.</b>
            <p>Longest ride in 30 days: 1:10. The plan had 2:15.</p>
            <div className="lp-prop-actions"><span className="btn small">Accept</span><span className="btn small ghost">Decline</span></div>
          </div>
        </div>
      </section>

      <section className="lp-devices" aria-labelledby="devices">
        <h2 id="devices">Devices</h2>
        <p>{GARMIN_ON ? "Garmin connects in one step; activities arrive with route and heart rate." : "Garmin sync is being set up."} Anything else is logged by hand in under a minute or imported from a spreadsheet.</p>
        <p className="lp-muted">Apple Watch, COROS, Polar, Suunto, WHOOP, Wahoo: next.</p>
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
        <span>Only you can see your data. It is never used to train models.</span>
      </footer>
    </main>
  );
}
