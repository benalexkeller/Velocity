"use client";
// Sections slide up into view as the page scrolls: a class is added the first time each one enters the viewport.
import { useEffect, useRef } from "react";

export function Reveal({ children, className, id, as: Tag = "section", ...rest }: { children: React.ReactNode; className?: string; id?: string; as?: "section" | "div" } & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("in"); return; }
    const io = new IntersectionObserver((entries) => { for (const e of entries) if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as React.Ref<HTMLDivElement>} id={id} className={`reveal${className ? ` ${className}` : ""}`} {...rest}>{children}</Tag>;
}
