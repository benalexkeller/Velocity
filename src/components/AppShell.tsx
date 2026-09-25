"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { BRAND, ATHLETE } from "@/lib/config";
import { todayLabel } from "@/lib/format";

const NAV: { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/plan", label: "Plan", icon: "calendar" },
  { href: "/activities", label: "Activities", icon: "bars" },
  { href: "/analysis", label: "Analysis", icon: "trend" },
  { href: "/nutrition", label: "Nutrition", icon: "fork" },
  { href: "/store", label: "Store", icon: "store" },
  { href: "/calculator", label: "Calculator", icon: "calc" },
];

const CRUMB: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/plan": "Plan",
  "/activities": "Activities",
  "/analysis": "Analysis",
  "/nutrition": "Nutrition",
  "/store": "Store",
  "/calculator": "Calculator",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="shell">
      <header className="topbar">
        <span className="wordmark">{BRAND.name}</span>
        <span className="crumb">{CRUMB[path] ?? ""}</span>
        <span className="greet">
          {greet}, {ATHLETE.firstName}.
        </span>
        <span className="meta">
          {todayLabel()} · {ATHLETE.weather}
          <span style={{ width: 18, height: 18, display: "inline-flex" }}>
            <Icon name="sun" />
          </span>
        </span>
      </header>
      <nav className="nav" aria-label="Primary">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={path === n.href ? "active" : ""}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
