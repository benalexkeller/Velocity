// Terms of service (public). Plain-language draft matching how the app works today; not reviewed by a lawyer yet.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = { title: `Terms - ${BRAND.name}`, description: "The terms for using Velocity: what it is, what it is not, and what we each agree to." };

export default function Terms() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of service" updated="29 October 2026" lead="The terms for using Velocity. By creating an account or using the app you agree to them.">
      <h2>What Velocity is</h2>
      <p>{BRAND.name} builds a training plan for your race, imports your workouts, sets daily nutrition targets and gives you an AI coach that reads your data. It is a tool to help you train; how you train is your decision.</p>

      <h2>Not medical advice</h2>
      <p>Training plans, nutrition targets and coach answers are general guidance for healthy adults. They are not medical advice, diagnosis or treatment, and they do not replace a doctor, a dietitian or a qualified coach who knows you. See a doctor before you start a new training programme, and stop and get medical help if you have chest pain, faint, feel dizzy or breathless at rest, or have pain that is sharp or getting worse. Endurance training carries a risk of injury; you take part at your own risk.</p>

      <h2>The AI coach</h2>
      <p>The coach is a language model. It answers from your data and a library of referenced passages, and it can be wrong. Check anything important before you act on it. It changes your plan only through proposals you accept, and it can log food you tell it about, which you can remove on the Nutrition page. It is limited to a number of messages a day per account.</p>

      <h2>Your account</h2>
      <ul>
        <li>You must be 16 or older and give a real email address.</li>
        <li>Keep your sign-in to yourself; you are responsible for what happens under your account.</li>
        <li>You can stop using Velocity at any time and ask us to delete your account through the <Link href="/help">Help page</Link>.</li>
      </ul>

      <h2>Your data</h2>
      <p>Your data stays yours. You give us permission to store and process it only to run the app for you, as described in the <Link href="/privacy">Privacy policy</Link>.</p>

      <h2>Fair use</h2>
      <p>Do not misuse the service: no attempts to break or overload it, to reach other people&apos;s data, to scrape it, or to use the coach for anything unrelated to your training. We may suspend accounts that do.</p>

      <h2>Connected services</h2>
      <p>Watches and other services you connect (such as Garmin) have their own terms. We are not responsible for their availability or for the data they send.</p>

      <h2>Price</h2>
      <p>Velocity is free while it is in beta. If paid plans are introduced, the price is shown before you pay and nothing is charged without your agreement.</p>

      <h2>Availability and changes</h2>
      <p>We work to keep Velocity running and your data safe, but the service is provided as it is, without a guarantee that it will always be available or free of errors. We may change or end features; if we close the service we will tell you in advance and give you a way to export your data.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect losses, or for injury, illness or race results that follow from training or eating according to the app. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>Changes to these terms</h2>
      <p>When these terms change, the date at the top changes with them. Significant changes are announced in the app before they apply; using Velocity after that means you accept them.</p>

      <h2>Contact</h2>
      <p>Questions about these terms go through the <Link href="/help">Help page</Link>.</p>
    </LegalPage>
  );
}
