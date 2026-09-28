import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { PlanProvider } from "@/lib/store";

const inter = localFont({ src: "./fonts/inter-latin-wght.woff2", variable: "--font-inter", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Velocity",
  description: "AI coach for anyone training for an endurance event.",
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
