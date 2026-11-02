"use client";
// Small pieces shared by the Admin tabs: number and date formats, tiles, a one-series bar chart, the funnel.
import type { ReactNode } from "react";
import { MEMBERSHIP, type Membership } from "@/lib/admin/api";

export const when = (s: string | null | undefined) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");
export const day = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-");
/** "today", "3 days ago", "5 weeks ago" */
export function ago(s: string | null | undefined) {
  if (!s) return "never";
  const d = (Date.now() - new Date(s).getTime()) / 86_400_000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${Math.floor(d)} days ago`;
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}
/** Dollars: whole above $100, cents above $1, more places below so a small cost does not read $0.00 */
export function money(v: number) {
  if (!v) return "$0";
  if (v >= 100) return `$${Math.round(v).toLocaleString()}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(4)}`;
}
export const int = (v: number) => Math.round(v).toLocaleString();
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "-");

export function MembershipPill({ m }: { m: Membership }) {
  return <span className={`mship ${m}`}>{MEMBERSHIP[m]}</span>;
}

export function Tile({ k, v, u }: { k: string; v: ReactNode; u?: ReactNode }) {
  return <div className="adm-tile"><span className="k">{k}</span><span className="v">{v}</span>{u && <span className="u">{u}</span>}</div>;
}

/** One series of bars over time. Hovering or focusing a bar shows its label and value. */
export function Bars({ data, fmt = int, height = 120, name }: { data: { label: string; v: number }[]; fmt?: (v: number) => string; height?: number; name: string }) {
  const max = Math.max(0, ...data.map((d) => d.v));
  const total = data.reduce((s, d) => s + d.v, 0);
  const mid = data[Math.floor((data.length - 1) / 2)];
  return (
    <div className="ab" role="img" aria-label={`${name}: ${data.length} bars, highest ${fmt(max)}, total ${fmt(total)}`}>
      <div className="ab-y" style={{ height }}><span>{fmt(max)}</span><span>0</span></div>
      <div className="ab-plot" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className={`ab-col${d.v ? "" : " zero"}`} tabIndex={0} data-tip={`${d.label}: ${fmt(d.v)}`}>
            <i style={{ height: max ? `${(d.v / max) * 100}%` : 0 }} />
          </div>
        ))}
      </div>
      {data.length > 0 && <div className="ab-x"><span>{data[0].label}</span>{data.length > 4 && <span>{mid.label}</span>}<span>{data[data.length - 1].label}</span></div>}
    </div>
  );
}

/** Each step as a share of the first one. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const base = steps[0]?.n ?? 0;
  return (
    <div className="funnel">
      {steps.map((s) => (
        <div className="row" key={s.label}>
          <span>{s.label}</span>
          <span className="bar"><i style={{ width: base ? `${Math.min(100, (s.n / base) * 100)}%` : 0 }} /></span>
          <span className="n">{int(s.n)}<small>{pct(s.n, base)}</small></span>
        </div>
      ))}
    </div>
  );
}
