// The frame for the public text pages (Privacy, Terms, Help): the top bar, a title with the date it was last
// changed, the text in one readable column, the footer. Public: proxy.ts lets anyone open these paths.
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";
import { START } from "./start";
import "@/app/landing.css";
import "./legal.css";

export function LegalPage({ eyebrow, title, updated, lead, children }: { eyebrow: string; title: string; updated?: string; lead?: string; children: React.ReactNode }) {
  return (
    <main className="lp lg">
      <PublicNav tone="light" start={START} accountsOn={ACCOUNTS_ON} />
      <header className="lg-head">
        <div className="lp-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {lead && <p className="lg-lead">{lead}</p>}
        {updated && <p className="lg-updated">Last updated {updated}</p>}
      </header>
      <article className="lg-body">{children}</article>
      <PublicFooter />
    </main>
  );
}
