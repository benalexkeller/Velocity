// One product page: /product/train, /product/nutrition, /product/coach. Content comes from lib/public/product.ts;
// the sections are the same ones the top-bar menus list. Public: proxy.ts lets anyone open /product.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { PRODUCT, productBySlug, type Shot } from "@/lib/public/product";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { CalendarMock } from "@/components/public/CalendarMock";
import { START } from "@/components/public/start";
import "../../landing.css";
import "../product.css";

const firstSentence = (s: string) => s.split(". ")[0].replace(/\.$/, "") + ".";
export function generateStaticParams() { return PRODUCT.map((p) => ({ slug: p.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = productBySlug((await params).slug);
  return page ? { title: `${page.title} - ${BRAND.name}`, description: page.lead } : {};
}

/** A screenshot: full pages get the frame; a card cut out of the app already has its border, so only a shadow. */
function Figure({ shot, small, hero }: { shot: Shot; small?: boolean; hero?: boolean }) {
  const cls = shot.card ? "pp-card" : "lp-shot";
  return (
    <figure className={`${cls}${hero ? " pp-hero" : ""}${small ? " pp-small" : shot.w < shot.h ? " pp-portrait" : ""}`}>
      <img src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} loading={hero ? undefined : "lazy"} />
    </figure>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = productBySlug((await params).slug);
  if (!page) notFound();
  const others = PRODUCT.filter((p) => p.slug !== page.slug);
  return (
    <main className="lp pp">
      <PublicNav tone="light" start={START} accountsOn={ACCOUNTS_ON} />
      <header className="pp-head">
        <div className="lp-eyebrow">Product</div>
        <h1>{page.title}</h1>
        <p className="pp-lead">{page.lead}</p>
      </header>
      <Figure shot={page.hero} hero />
      {/* the sections, spread evenly across the page: each link with its one-line summary */}
      <nav className="pp-toc" aria-label="On this page" style={{ gridTemplateColumns: `repeat(${page.sections.length}, minmax(0, 1fr))` }}>
        {page.sections.map((s) => <a key={s.id} href={`#${s.id}`}><b>{s.title}</b><span>{s.short}</span></a>)}
      </nav>

      {page.sections.map((s, i) => {
        const facts = s.facts && <ul className="lp-facts">{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>;
        const chips = s.chips && <ul className="pp-chips" aria-label="Models">{s.chips.map((c) => <li key={c.name} className={/backup/.test(c.role) ? "" : "on"}><b>{c.name}</b><em>{c.role}</em></li>)}</ul>;
        const shot = s.mock === "calendar" ? <div className="pp-mock"><CalendarMock animate={false} /></div> : s.shot ? <Figure shot={s.shot} small={s.small} /> : null;
        // a section without a picture puts its facts (or chips) beside the text instead, so the page stays balanced
        const visual = shot ?? ((facts || chips) && <div className="pp-side">{chips}{facts}</div>);
        return (
          <section key={s.id} id={s.id} className={`pp-sec${i % 2 ? " pp-flip" : ""}`} aria-labelledby={`${s.id}-h`}>
            <div className="pp-sec-text">
              <h2 id={`${s.id}-h`}>{s.title}</h2>
              {s.body.map((t, j) => <p key={j}>{t}</p>)}
              {shot && facts}
            </div>
            {visual}
          </section>
        );
      })}

      <section className="pp-more" aria-label="Other product pages">
        {others.map((o) => <Link key={o.slug} href={`/product/${o.slug}`} className="pp-more-card"><span className="lp-eyebrow">Product</span><b>{o.title}</b><span>{firstSentence(o.lead)}</span></Link>)}
      </section>

      <section className="pp-cta">
        <h2><span>Create a plan</span><span>Strategize nutrition</span><span>Become the expert</span></h2>
        <Link href={START.href} className="btn lp-big">{START.label}</Link>
      </section>
      <PublicFooter />
    </main>
  );
}
