// One product page: /product/train, /product/nutrition, /product/coach. Content comes from lib/public/product.ts;
// the sections are the same ones the top-bar menus list. Public: proxy.ts lets anyone open /product.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/config";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { PRODUCT, productBySlug } from "@/lib/public/product";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { START } from "@/components/public/start";
import "../../landing.css";
import "../product.css";

const firstSentence = (s: string) => s.split(". ")[0].replace(/\.$/, "") + ".";
export function generateStaticParams() { return PRODUCT.map((p) => ({ slug: p.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = productBySlug((await params).slug);
  return page ? { title: `${page.title} — ${BRAND.name}`, description: page.lead } : {};
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
        <Link href={START.href} className="btn lp-big">{START.label}</Link>
      </header>
      <figure className="lp-shot pp-hero"><img src={page.hero.src} width={page.hero.w} height={page.hero.h} alt={page.hero.alt} /></figure>
      <nav className="pp-toc" aria-label="On this page">
        {page.sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        <a href="#looks">How it looks</a>
      </nav>

      {page.sections.map((s, i) => (
        <section key={s.id} id={s.id} className={`pp-sec${s.shot ? "" : " pp-sec-text-only"}${i % 2 ? " pp-flip" : ""}`} aria-labelledby={`${s.id}-h`}>
          <div className="pp-sec-text">
            <h2 id={`${s.id}-h`}>{s.title}</h2>
            {s.body.map((t, j) => <p key={j}>{t}</p>)}
            {s.facts && <ul className="lp-facts">{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>}
          </div>
          {s.shot && <figure className={`lp-shot${s.shot.w < s.shot.h ? " pp-portrait" : ""}`}><img src={s.shot.src} width={s.shot.w} height={s.shot.h} alt={s.shot.alt} loading="lazy" /></figure>}
        </section>
      ))}

      {page.notYet && (
        <section className="pp-notyet" aria-labelledby="notyet-h">
          <h2 id="notyet-h">Not in the app yet</h2>
          <ul>{page.notYet.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      <section className="pp-gallery" id="looks" aria-labelledby="looks-h">
        <h2 id="looks-h">How it looks</h2>
        <div className="pp-gallery-grid">
          {page.gallery.map((g) => (
            <figure key={g.src + g.caption} className="pp-frame">
              <div className="lp-laptop"><div className="lp-screen"><img src={g.src} width={g.w} height={g.h} alt={g.alt} loading="lazy" /></div><div className="lp-laptop-base" /></div>
              {g.caption && <figcaption>{g.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>

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
