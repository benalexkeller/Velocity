// Privacy policy (public). Written to match what the app actually does; change it whenever a service is added.
// It is a plain-language draft, not reviewed by a lawyer yet.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: `Privacy - ${BRAND.name}`, description: "What Velocity stores about you, why, who processes it, and how to get it deleted." };

export default function Privacy() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="30 October 2026" lead="What Velocity stores about you, why, which services handle it, and how to have it deleted. Only you can see your data, and we do not sell it.">
      <h2>Who we are</h2>
      <p>{BRAND.name} is a training app for endurance athletes at velocityathletes.com. In this policy &quot;we&quot; means the team that runs it. Questions about your data go through the <Link href="/help">Help page</Link>.</p>

      <h2>What we store</h2>
      <table className="lg-table">
        <tbody>
          <tr><th>Account</th><td>Email address, username, and the sign-in details our sign-in provider needs.</td></tr>
          <tr><th>Profile and race</th><td>Name, units, birth year, sex, height, the race you train for, your training availability and your heart-rate, pace and power zones.</td></tr>
          <tr><th>Training plan</th><td>Every planned session, the changes you make to them, and the plan settings.</td></tr>
          <tr><th>Activities</th><td>Workouts from a connected watch or logged by hand: date, sport, duration, distance, pace or speed, heart rate, elevation, effort, notes and, when recorded, the GPS route.</td></tr>
          <tr><th>Body data</th><td>From a connected watch: resting heart rate, heart-rate variability, sleep and VO2max. Body weight you log on the Nutrition page.</td></tr>
          <tr><th>Nutrition</th><td>Foods and meals you log, drinks, supplements, and your nutrition settings (goal weight and stages).</td></tr>
          <tr><th>Coach</th><td>The messages you send the coach and its answers, and the plan changes you accept or decline.</td></tr>
          <tr><th>Calendar</th><td>If you connect Google Calendar: the email address of that Google account, an encrypted key that lets Velocity update its own calendar, and which sessions are in it. If you create a calendar link: the secret part of the link and the sessions it shows.</td></tr>
          <tr><th>Feedback</th><td>Feedback and contact messages you send us, with the page you were on, your browser and screen size.</td></tr>
        </tbody>
      </table>
      <p>Heart rate, sleep, HRV, weight and similar measures are health data. We process them only because you add them or connect a device that sends them, and only to run the app for you.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To build and adjust your training plan, set daily nutrition targets, and show your progress.</li>
        <li>To answer your questions to the coach, which reads a compact copy of your data each time you ask.</li>
        <li>To keep the app working: fixing errors, preventing abuse, and answering the messages you send us.</li>
      </ul>
      <p>We do not sell your data, we do not show you ads, and we do not use your data to train AI models.</p>

      <h2>Services that handle your data</h2>
      <table className="lg-table">
        <tbody>
          <tr><th>Supabase</th><td>Database and sign-in. Stores everything listed above.</td></tr>
          <tr><th>Vercel</th><td>Hosts the website and runs the app&apos;s server code.</td></tr>
          <tr><th>OpenRouter</th><td>Passes each coach question, with the compact copy of your data, to the AI model that answers it: DeepSeek or Google Gemini for everyday questions, Anthropic Claude, OpenAI GPT or Google Gemini for whole-plan reviews. It is used to answer that question only, and every request is set to go only to AI providers that do not store it or train on it.</td></tr>
          <tr><th>Junction</th><td>Connects your watch (Garmin today) and sends your activities and body data to Velocity once you connect it. You can disconnect it at any time under Connect wearable; activities already imported stay until you delete them.</td></tr>
          <tr><th>Google</th><td>Sign-in with Google gives us your email address, name and profile picture. If you connect Google Calendar, Velocity creates one calendar in your Google account, called Velocity training, and keeps your planned sessions in it (time, length and steps). Velocity can only change that calendar. Only if you also turn on Show my other events, Velocity reads the list of your calendars and the title, time and calendar of your other events, to show them on your Plan page; it reads them from Google each time you open the page, does not store them, and never changes them. Disconnecting withdraws the access at Google, and you choose whether the Velocity training calendar is deleted.</td></tr>
          <tr><th>USDA FoodData Central</th><td>Receives the words you type into food search, nothing else about you.</td></tr>
          <tr><th>CARTO</th><td>Serves the map tiles behind a route, so it sees which map area is shown.</td></tr>
        </tbody>
      </table>

      <h2>Data from Google</h2>
      <p>Velocity&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. We use it only to sign you in, to keep your Velocity training calendar up to date and, if you turn it on, to show your other events on your Plan page. We do not sell it, use it for advertising, or use it to train AI models, and no person reads it unless you ask us to help with a problem.</p>

      <h2>Your browser</h2>
      <p>We use the cookies needed to keep you signed in, and your browser&apos;s local storage for settings on this device. No advertising or tracking cookies.</p>

      <h2>How long we keep it</h2>
      <p>For as long as you have an account. Profile, Delete my account deletes your account and everything in it straight away, removes your Velocity training calendar from Google and ends your watch connection. If you ask us to delete it instead, we do it within 30 days. Backups held by our database provider roll over within their own retention period.</p>

      <h2>Your rights</h2>
      <p>You can see and change your data in the app at any time, and delete your account under Profile. You can ask us for a copy of it, to correct it, to delete it, or to stop processing it, and you can withdraw consent for health data by deleting it or disconnecting your device. Send the request through the <Link href="/help">Help page</Link> from the email address on your account. If you are in the EU or UK you can also complain to your data protection authority.</p>

      <h2>Age</h2>
      <p>Velocity is for people aged 16 and over.</p>

      <h2>Changes</h2>
      <p>When this policy changes, the date at the top changes with it. Significant changes are announced in the app before they apply.</p>
    </LegalPage>
  );
}
