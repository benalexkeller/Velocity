"use client";
// Where the coach panel lives. On the Plan page (wide screens) it is docked as the right column and can be
// closed; the choice is remembered. Everywhere else, and on narrow screens, clicking the coach bar opens the
// same panel on the right side as a drawer.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CoachRail } from "./CoachRail";

const KEY = "velocity.coach.v1";
interface Dock { open: boolean; docked: boolean; setOpen: (v: boolean) => void }
const Ctx = createContext<Dock>({ open: false, docked: false, setOpen: () => {} });
export const useCoachDock = () => useContext(Ctx);

function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1101px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function CoachDockProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const wide = useWide();
  const docked = path === "/plan" && wide;
  const [planOpen, setPlanOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); if (v.plan === false) setPlanOpen(false); } catch { /* storage off */ } }, []);
  const open = docked ? planOpen : drawer;
  const setOpen = useCallback((v: boolean) => {
    if (docked) { setPlanOpen(v); try { localStorage.setItem(KEY, JSON.stringify({ plan: v })); } catch { /* storage off */ } }
    else setDrawer(v);
    if (v) setTimeout(() => document.getElementById("coach-input")?.focus(), 60);
  }, [docked]);
  // drawer sits over the page on the right; Esc closes it
  useEffect(() => {
    const on = !docked && drawer;
    document.body.classList.toggle("coach-drawer", on);
    if (!on) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); document.body.classList.remove("coach-drawer"); };
  }, [docked, drawer]);
  return (
    <Ctx.Provider value={{ open, docked, setOpen }}>
      {children}
      {!docked && drawer && <CoachRail drawer onClose={() => setDrawer(false)} />}
    </Ctx.Provider>
  );
}
