"use client";
// The public site's top bar: wordmark, one menu per product area (Train, Nutrition, Coach) listing that page's
// sections, then Sign in and the account button. Menus open on hover and on click, close on Escape and outside
// clicks; on narrow screens the three menus collapse into one stacked list behind a Menu button.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/config";
import { PRODUCT } from "@/lib/public/product";
import "./public-nav.css";

export function PublicNav({ tone = "light", start, accountsOn }: { tone?: "light" | "dark"; start: { href: string; label: string }; accountsOn: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setMobile(false); } };
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(null); setMobile(false); } };
    window.addEventListener("keydown", key); window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", click); };
  }, []);
  const enter = (slug: string) => { if (timer.current) window.clearTimeout(timer.current); setOpen(slug); };
  const leave = () => { timer.current = window.setTimeout(() => setOpen(null), 140); };
  return (
    <header ref={ref} className={`pn pn-${tone}${mobile ? " pn-open" : ""}`}>
      <Link href="/" className="wordmark pn-mark">{BRAND.name}</Link>
      <nav className="pn-menus" aria-label="Product">
        {PRODUCT.map((p) => (
          <div key={p.slug} className={`pn-item${open === p.slug ? " on" : ""}`} onMouseEnter={() => enter(p.slug)} onMouseLeave={leave}>
            <button type="button" aria-expanded={open === p.slug} aria-controls={`pn-${p.slug}`} onClick={() => setOpen(open === p.slug ? null : p.slug)}>
              {p.nav}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
            </button>
            <div id={`pn-${p.slug}`} className="pn-panel" role="group" aria-label={p.nav}>
              <Link href={`/product/${p.slug}`} className="pn-overview" onClick={() => { setOpen(null); setMobile(false); }}><b>{p.title}</b><span>{p.lead.split(". ")[0].replace(/\.$/, "")}.</span></Link>
              <div className="pn-links">
                {p.sections.map((s) => <Link key={s.id} href={`/product/${p.slug}#${s.id}`} onClick={() => { setOpen(null); setMobile(false); }}><b>{s.title}</b><span>{s.short}</span></Link>)}
              </div>
            </div>
          </div>
        ))}
      </nav>
      <div className="pn-actions">
        {accountsOn && <Link href="/login" className="pn-signin">Sign in</Link>}
        <Link href={start.href} className="btn">{start.label}</Link>
        <button type="button" className="pn-burger" aria-expanded={mobile} aria-label="Menu" onClick={() => { setMobile(!mobile); setOpen(null); }}>
          <svg viewBox="0 0 20 20" aria-hidden="true">{mobile ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
        </button>
      </div>
    </header>
  );
}
