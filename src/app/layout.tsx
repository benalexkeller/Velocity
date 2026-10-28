import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PlanProvider } from "@/lib/store";

const inter = localFont({ src: "./fonts/inter-latin-wght.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://velocityathletes.com"),
  title: "Velocity",
  description: "A plan for your race, nutrition timed to each session, and a coach that reads all of it.",
  // the icons (favicon.ico, icon.svg, apple-icon.png) and the link-preview card (opengraph-image.png, twitter-image.png)
  // are the files next to this layout; Next.js wires them in by name
  openGraph: { siteName: "Velocity", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <PlanProvider><AppShell>{children}</AppShell></PlanProvider>
      </body>
    </html>
  );
}
