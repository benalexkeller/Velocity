"use client";
// Shared chart helpers: round axis ticks, and charts drawn at their real pixel width so axis text is
// the same size everywhere (12 px) instead of being scaled with the card.
import { useEffect, useRef, useState } from "react";

export type TickKind = "number" | "pace" | "hours" | "percent";

const STEPS: Record<TickKind, number[]> = {
  number: [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000],
  pace: [5, 10, 15, 20, 30, 60, 120, 300], // seconds
  hours: [0.25, 0.5, 1, 2, 5, 10, 20],
  percent: [5, 10, 20, 25, 50],
};

/**
 * Round ticks covering [lo, hi] with about n intervals. Returns the ticks and the domain extended to the
 * first and last tick, so the axis starts and ends on a labelled value.
 */
export function niceTicks(lo: number, hi: number, n = 4, kind: TickKind = "number"): { ticks: number[]; lo: number; hi: number } {
  if (!isFinite(lo) || !isFinite(hi)) return { ticks: [0, 1], lo: 0, hi: 1 };
  if (hi - lo < 1e-9) { hi = lo + (kind === "pace" ? 30 : 1); }
  const raw = (hi - lo) / Math.max(1, n);
  const scale = kind === "number" ? Math.pow(10, Math.floor(Math.log10(raw)) - 1) : 1;
  const steps = kind === "number" ? STEPS.number.map((s) => s * scale) : STEPS[kind];
  const step = steps.find((s) => s >= raw) ?? steps[steps.length - 1] * Math.ceil(raw / steps[steps.length - 1]);
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { ticks, lo: a, hi: b };
}

/** Width of an element in CSS pixels, kept current with a ResizeObserver; `fallback` until it is measured. */
export function useWidth<T extends Element = SVGSVGElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { const cw = Math.round(entries[0].contentRect.width); if (cw > 40) setW(cw); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
