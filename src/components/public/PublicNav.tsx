"use client";
// The public site's top bar: wordmark, one menu per product area (Train, Nutrition, Coach) listing that page's
// sections, then Sign in and the account button. Menus open on hover and on click, close on Escape and outside
// clicks; on narrow screens the three menus collapse into one stacked list behind a Menu button.
//
// On the front page the bar is fixed over the photo (`sticky`). As the white page scrolls up under it, the text
// turns black exactly where it meets the white: a non-interactive white-text copy sits on top, clipped to the part
// still over the photo; the real, black-text bar underneath is clipped to the part over white. Once the photo is
// fully gone the bar gets a white background.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/config";
import { PRODUCT } from "@/lib/public/product";
import "./public-nav.css";

type Props = { tone?: "light" | "dark"; start: { href: string; label: string }; accountsOn: boolean; sticky?: boolean };

function Bar({ tone, start, accountsOn, clone, open, mobile, setOpen, setMobile, enter, leave, innerRef, style }: Props & {
  clone?: boolean; open: string | null; mobile: boolean; setOpen: (v: string | null) => void; setMobile: (v: boolean) => void;
  enter: (slug: string) => void; leave: () => void; innerRef?: React.Ref<HTMLElement>; style?: React.CSSProperties;
}) {
  const close = () => { setOpen(null); setMobile(false); };
  return (
    <header ref={innerRef} className={`pn pn-${tone}${mobile ? " pn-open" : ""}${clone ? " pn-clone" : ""}`} aria-hidden={clone || undefined} style={style}>
      <Link href="/" className="wordmark pn-mark" tabIndex={clone ? -1 : undefined}>{BRAND.name}</Link>
      <nav className="pn-menus" aria-label={clone ? undefined : "Product"}>
        {PRODUCT.map((p) => (
          <div key={p.slug} className={`pn-item${!clone && open === p.slug ? " on" : ""}`} onMouseEnter={clone ? undefined : () => enter(p.slug)} onMouseLeave={clone ? undefined : leave}>
            <button type="button" tabIndex={clone ? -1 : undefined} aria-expanded={clone ? undefined : open === p.slug} aria-controls={clone ? undefined : `pn-${p.slug}`} onClick={clone ? undefined : () => setOpen(open === p.slug ? null : p.slug)}>
              {p.nav}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
            </button>
            {!clone && (
              <div id={`pn-${p.slug}`} className="pn-panel" role="group" aria-label={p.nav}>
                <Link href={`/product/${p.slug}`} className="pn-overview" onClick={close}><b>{p.title}</b><span>{p.lead.split(". ")[0].replace(/\.$/, "")}.</span></Link>
                <div className="pn-links">
                  {p.sections.map((s) => <Link key={s.id} href={`/product/${p.slug}#${s.id}`} onClick={close}><b>{s.title}</b><span>{s.short}</span></Link>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="pn-actions">
        {accountsOn && <Link href="/login" className="pn-signin" tabIndex={clone ? -1 : undefined}>Sign in</Link>}
        <Link href={start.href} className="btn" tabIndex={clone ? -1 : undefined}>{start.label}</Link>
        <button type="button" className="pn-burger" tabIndex={clone ? -1 : undefined} aria-expanded={clone ? undefined : mobile} aria-label="Menu" onClick={clone ? undefined : () => { setMobile(!mobile); setOpen(null); }}>
          <svg viewBox="0 0 20 20" aria-hidden="true">{mobile ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}</svg>
        </button>
      </div>
    </header>
  );
}

export function PublicNav({ tone = "light", start, accountsOn, sticky = false }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  // how far the photo still reaches down the screen, in px: the top edge of the white page (.lp-body) that slides
  // up over the sticky hero, or the hero's own bottom edge when there is no such page; only used when sticky
  const [edge, setEdge] = useState(9999);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setMobile(false); } };
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(null); setMobile(false); } };
    window.addEventListener("keydown", key); window.addEventListener("mousedown", click);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", click); };
  }, []);
  useEffect(() => {
    if (!sticky) return;
    const body = document.querySelector(".lp-body"), hero = document.querySelector(".lp-hero");
    const target = body ?? hero;
    if (!target) return;
    let raf = 0;
    const measure = () => { raf = 0; const r = target.getBoundingClientRect(); setEdge(Math.round(body ? r.top : r.bottom)); };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) window.cancelAnimationFrame(raf); };
  }, [sticky]);
  const enter = (slug: string) => { if (timer.current) window.clearTimeout(timer.current); setOpen(slug); };
  const leave = () => { timer.current = window.setTimeout(() => setOpen(null), 140); };
  const shared = { start, accountsOn, open, mobile, setOpen, setMobile, enter, leave };

  if (!sticky) return <div ref={ref}><Bar tone={tone} {...shared} /></div>;

  const h = 80; // the bar's height
  const over = Math.max(0, Math.min(h, edge)); // px of the bar still over the photo
  const solid = edge <= 0;
  return (
    <div ref={ref} className={`pn-fixed${solid ? " solid" : ""}${mobile || open ? " active" : ""}`}>
      {/* the real bar: black text, interactive; shown only where the page is white */}
      <Bar tone="light" {...shared} style={{ clipPath: mobile || open ? "none" : `inset(${over}px 0 0 0)` }} />
      {/* the white-text copy over the photo, not interactive */}
      {over > 0 && !mobile && !open && <Bar tone="dark" clone {...shared} style={{ clipPath: `inset(0 0 ${h - over}px 0)` }} />}
    </div>
  );
}
