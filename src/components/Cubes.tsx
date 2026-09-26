"use client";
import type { ReactNode } from "react";
import { Icon } from "./icons";

// A grid of "cubes". Click one and it opens all the way at the top of the grid; the grid stays below.
export interface Cube {
  id: string;
  title: string;
  tag?: string; // small label above the title
  summary: string; // one line on the closed cube
  render: () => ReactNode; // the full content when open
}

export function Cubes({ items, openId, onOpen, columns = 4 }: { items: Cube[]; openId: string | null; onOpen: (id: string | null) => void; columns?: number }) {
  const open = items.find((c) => c.id === openId) ?? null;
  return (
    <>
      {open && (
        <section className="card cube-open" aria-label={open.title}>
          <button className="close" type="button" onClick={() => onOpen(null)} aria-label="Close"><Icon name="close" /></button>
          {open.tag && <div className="eyebrow muted">{open.tag}</div>}
          <h2>{open.title}</h2>
          <div className="body">{open.render()}</div>
        </section>
      )}
      <div className="cubes" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((c) => (
          <button key={c.id} type="button" className={`card cube${c.id === openId ? " on" : ""}`} onClick={() => onOpen(c.id === openId ? null : c.id)} aria-expanded={c.id === openId}>
            <span className="top">{c.tag && <span className="eyebrow muted">{c.tag}</span>}<span className="t">{c.title}</span></span>
            <span className="s">{c.summary}</span>
            <span className="go"><Icon name="chevron" /></span>
          </button>
        ))}
      </div>
    </>
  );
}
