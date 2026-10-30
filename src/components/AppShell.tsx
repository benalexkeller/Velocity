"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { BRAND } from "@/lib/config";
import { usePlan } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { todayLabel } from "@/lib/format";
import { FeedbackModal } from "./Feedback";
import { CoachDockProvider } from "./CoachDock";
import { CalendarSync } from "./CalendarSync";
import "@/app/account.css";

const NAV: { href: string; label: string; short?: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: "home" },
  { href: "/plan", label: "Plan", icon: "calendar" },
  { href: "/activities", label: "Activities", short: "Activity", icon: "bars" },
  { href: "/analysis", label: "Analysis", icon: "trend" },
  { href: "/nutrition", label: "Nutrition", icon: "fork" },
  { href: "/store", label: "Store", icon: "store" },
  { href: "/calculator", label: "Calculator", short: "Tools", icon: "calc" },
];

// Avatar button top right: profile, feedback, admin (if admin), sign out.
function AccountMenu() {
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const a = plan.athlete;
  const initials = a.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "A";
  return (
    <div className="acct-menu" ref={ref}>
      <button type="button" aria-label="Account" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{a.avatarUrl ? <img src={a.avatarUrl} alt="" /> : initials}</button>
      {open && (
        <div className="menu" role="menu">
          <div className="who"><b>{a.name}</b>{a.username ? `@${a.username}` : a.email ?? "saved on this device"}</div>
          <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}>Profile</Link>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setFeedback(true); }}>Send feedback</button>
          {plan.accounts && a.isAdmin && <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>Admin</Link>}
          {plan.accounts ? <button type="button" role="menuitem" onClick={() => { setOpen(false); void plan.signOut(); }}>Sign out</button> : <div className="who" style={{ border: 0, margin: 0 }}>No account, saved in this browser</div>}
        </div>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const plan = usePlan();
  const ATHLETE = plan.athlete;
  const hour = useNow().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (path === "/" || path === "/login" || path.startsWith("/auth") || path.startsWith("/product") || path === "/help" || path === "/privacy" || path === "/terms" || path === "/setup") return <>{children}</>;
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">{BRAND.name}</span>
        <span className="greet">
          {greet}, {ATHLETE.firstName}.
        </span>
        <span className="meta">
          {todayLabel()}
        </span>
        <AccountMenu />
      </header>
      <nav className="nav" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""} aria-current={path === n.href ? "page" : undefined}>
            <Icon name={n.icon} />
            <span className="lbl">{n.label}</span>{n.short && <span className="lbl-short">{n.short}</span>}
          </Link>
        ))}
      </nav>
      <CoachDockProvider>{children}</CoachDockProvider>
      {plan.accounts && <CalendarSync />}
    </div>
  );
}
