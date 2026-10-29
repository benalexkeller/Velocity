// Help (public): a contact form that lands in the admin feedback list, and short answers to the common questions.
import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LegalPage } from "@/components/public/LegalPage";
import { ContactForm } from "@/components/public/ContactForm";

export const metadata: Metadata = { title: `Help - ${BRAND.name}`, description: "Contact the Velocity team, and answers to the common questions." };

export default function Help() {
  return (
    <LegalPage eyebrow="Help" title="Contact us" lead="Questions, problems, ideas or a request about your data: write to us here and we answer by email.">
      <ContactForm />

      <h2>Common questions</h2>
      <p><b>How do I connect my watch?</b> Open the Dashboard or Activities and choose Connect wearable. Garmin connects today; finished activities then arrive on their own.</p>
      <p><b>How do I change my plan?</b> Drag a session on the Plan page, open it to edit it, or ask the coach. Locked sessions never move.</p>
      <p><b>Why does a session show yards and not minutes?</b> Swims are written by distance: warm-up, main set and cool-down each in yards (or metres), with the pace per 100.</p>
      <p><b>How do I delete my account?</b> Send a message from the email address on your account and we delete it and all its data. See the <Link href="/privacy">Privacy policy</Link> for what is stored.</p>
    </LegalPage>
  );
}
