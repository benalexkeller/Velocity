"use client";
import "./store.css";
import { useState } from "react";
import { CoachBar } from "@/components/CoachBar";
import { Icon } from "@/components/icons";
import { CATEGORIES, PRODUCTS, type Category } from "@/lib/content/store";

export default function StorePage() {
  const [cat, setCat] = useState<Category | "All">("All");
  const list = PRODUCTS.filter((p) => cat === "All" || p.category === cat);
  return (
    <main className="main">
      <div className="page" style={{ display: "grid", gap: 16, paddingTop: 10 }}>
        <div className="page-head">
          <div>
            <h1>Store</h1>
          </div>
          <span className="grow" />
          <div className="tabs store-tabs" role="tablist">
            {(["All", ...CATEGORIES] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={cat === k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>{k}</button>)}
          </div>
        </div>
        <div className="products">
          {list.map((p) => (
            <a key={p.id} className="card product" href={p.url} target="_blank" rel="noopener noreferrer">
              <span className="top"><span className="eyebrow muted">{p.category} · {p.brand}</span><span className="t">{p.name}</span></span>
              <span className="s">{p.what}</span>
              <span className="foot">{p.plan ? <span className="use">{p.plan}</span> : <span />}<span className="buy">Buy at {p.brand} <Icon name="arrow" /></span></span>
            </a>
          ))}
        </div>
        <CoachBar id="store-coach" />
      </div>
    </main>
  );
}
