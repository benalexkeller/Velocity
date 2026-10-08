"use client";
import "./activities.css";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { SportIcon } from "@/components/SportIcon";
import { MapModal, RouteMap } from "@/components/RouteMap";
import { CoachNote } from "@/components/CoachNote";
import { activityLoad, type Activity } from "@/lib/data";
import { hrZone } from "@/lib/athlete";
import { usePlan } from "@/lib/store";
import { DAYS, MONTHS, addDays, fmtHMS, fmtPace, fromYmd, today } from "@/lib/format";
import { elev, fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";

type Tab = "all" | "swim" | "bike" | "run";

function groupLabel(date: string) {
  const d = fromYmd(date), t = today();
  if (d.getTime() === t.getTime()) return { key: "today", label: "Today", sub: `${DAYS[(t.getDay() + 6) % 7]}, ${MONTHS[t.getMonth()]} ${t.getDate()}, ${t.getFullYear()}` };
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  if (d >= monday) return { key: "week", label: "This Week", sub: "" };
  return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}`, sub: "" };
}
function when(a: Activity) {
  const d = fromYmd(a.date);
  return { l1: `${DAYS[(d.getDay() + 6) % 7]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, l2: a.start ?? "" };
}
function subtitle(a: Activity) {
  if (a.sport === "swim") return "Pool session";
  if (a.sport === "bike") return a.route ? "Outdoor ride" : "Indoor trainer";
  if (a.sport === "run") return "Run";
  if (a.sport === "hike") return "Hike";
  return "Session";
}
function distance(a: Activity) {
  if (a.sport === "swim") return a.yd ? `${swimDist(a.yd).v.toLocaleString()} ${swimDist(0).u}` : "—";
  return a.mi ? fmtDist(a.mi) : "—";
}
function paceOrPower(a: Activity) {
  if (a.sport === "run" && a.pace_s) return { v: fmtPace(runPace(a.pace_s).s), u: runPace(0).u };
  if (a.sport === "swim" && a.p100_s) return { v: fmtPace(swimPace(a.p100_s).s), u: swimPace(0).u };
  if (a.sport === "bike" && a.mph) return { v: fmtSpeed(a.mph), u: "" };
  return { v: "—", u: "" };
}
function effortLevel(a: Activity, lthr: number | null) {
  if (a.exertion) return Math.min(5, Math.ceil(a.exertion / 2));
  if (a.hr) return hrZone(a.sport, a.hr, lthr);
  return 0;
}
function Effort({ n }: { n: number }) {
  return <span className="effort" aria-label={`Effort ${n} of 5`}>{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "on" : ""} style={{ height: 4 + i * 2.4 }} />)}</span>;
}

export default function ActivitiesPage() {
  return <Suspense fallback={null}><Activities /></Suspense>;
}

function Activities() {
  const params = useSearchParams();
  const plan = usePlan();
  const ACTIVITIES = plan.activities;
  const fromUrl = params.get("a");
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(false);
  const [source, setSource] = useState<"all" | "garmin" | "manual">("all");
  const [gpsOnly, setGpsOnly] = useState(false);
  // the detail panel is always showing one activity: the one from the link, else the most recent; clicking a row swaps it in
  const [sel, setSel] = useState<string | null>(fromUrl ?? ACTIVITIES[ACTIVITIES.length - 1]?.id ?? null);
  useEffect(() => { if (fromUrl) setSel(fromUrl); }, [fromUrl]);
  // everything above the table (title, search, detail panel, tabs) is frozen; the column header row sticks right under it
  const stickyRef = useRef<HTMLDivElement>(null);
  const [stickyH, setStickyH] = useState(0);
  useLayoutEffect(() => {
    const el = stickyRef.current; if (!el) return;
    const measure = () => setStickyH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [sel]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...ACTIVITIES].reverse().filter((a) => (tab === "all" || a.sport === tab) && (source === "all" || a.source === source) && (!gpsOnly || !!a.route) && (!t || a.name.toLowerCase().includes(t) || a.date.includes(t)));
  }, [tab, q, source, gpsOnly, ACTIVITIES]);
  const selected = ACTIVITIES.find((a) => a.id === sel) ?? ACTIVITIES[ACTIVITIES.length - 1] ?? null;

  let lastGroup = "";
  return (
    <main className="main" style={{ padding: 0 }}>
      <div className="acts">
        <div className="acts-main">
          <div className="acts-sticky" ref={stickyRef}>
          <div className="acts-head">
            <div>
              <div className="eyebrow muted">Activity archive</div>
              <h1>Activities</h1>
            </div>
            <span className="grow" />
            <label className="search"><Icon name="search" /><input id="act-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search activities…" aria-label="Search activities" /></label>
            <span style={{ position: "relative" }}>
              <button className={`iconbtn${source !== "all" || gpsOnly ? " on" : ""}`} type="button" aria-label="Filters" aria-expanded={filters} onClick={() => setFilters((f) => !f)}><Icon name="filter" /></button>
              {filters && (
                <div className="menu filters" role="dialog" aria-label="Filters">
                  <div className="k">Source</div>
                  <div className="pill-group small">{(["all", "garmin", "manual"] as const).map((k) => <button key={k} type="button" className={source === k ? "on" : ""} onClick={() => setSource(k)}>{k === "all" ? "All" : k === "garmin" ? "Garmin" : "Manual"}</button>)}</div>
                  <label className="chk"><input type="checkbox" checked={gpsOnly} onChange={(e) => setGpsOnly(e.target.checked)} /> With GPS route only</label>
                  <button type="button" className="btn ghost small" onClick={() => { setSource("all"); setGpsOnly(false); setQ(""); setTab("all"); setFilters(false); }}>Clear filters</button>
                </div>
              )}
            </span>
          </div>
          <div className="tabs" role="tablist">
            {(["all", "swim", "bike", "run"] as Tab[]).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k}</button>)}
          </div>
          </div>
          <table className="tbl acts-tbl" style={{ ["--acts-top" as string]: `${stickyH}px` }}>
            <thead>
              <tr><th>Date</th><th>Activity</th><th>Distance</th><th>Time</th><th className="hide-sm">Pace / speed</th><th className="hide-sm">Elevation</th><th className="hide-sm">Effort</th><th /><th /></tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const g = groupLabel(a.date);
                const showGroup = g.key !== lastGroup;
                lastGroup = g.key;
                const w = when(a), pp = paceOrPower(a);
                return (
                  <FragmentRow key={a.id} showGroup={showGroup} group={g}>
                    <tr className={`row${sel === a.id ? " sel" : ""}${a.excluded ? " excluded" : ""}`} onClick={() => { setSel(a.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <td className="when">{w.l1}<small>{w.l2}</small></td>
                      <td><div className="act"><SportIcon sport={a.sport} size={30} /><div><b>{a.name}{a.excluded && <span className="tag">Excluded</span>}</b><small>{subtitle(a)}</small></div></div></td>
                      <td className="num">{distance(a)}</td>
                      <td className="num">{fmtHMS(a.min)}</td>
                      <td className="num hide-sm">{pp.v}<small>{pp.u}</small></td>
                      <td className="num hide-sm">{a.elev_ft ? `${elev(a.elev_ft).v.toLocaleString()} ${elev(0).u}` : "—"}</td>
                      <td className="hide-sm">{effortLevel(a, plan.athlete.lthr) ? <Effort n={effortLevel(a, plan.athlete.lthr)} /> : "—"}</td>
                      <td>{a.route ? <div className="thumb"><RouteMap route={a.route} height={36} bg="var(--surface-2)" pad={0.1} /></div> : null}</td>
                      <td><span className="chev"><Icon name="chevron" /></span></td>
                    </tr>
                  </FragmentRow>
                );
              })}
              {!list.length && <tr><td colSpan={9} className="muted" style={{ padding: 24 }}>No activities match.</td></tr>}
            </tbody>
          </table>
        </div>
        {selected && <Drawer a={selected} onDeleted={() => setSel(null)} />}
      </div>
    </main>
  );
}

function FragmentRow({ showGroup, group, children }: { showGroup: boolean; group: { label: string; sub: string }; children: React.ReactNode }) {
  return (
    <>
      {showGroup && <tr className="group"><td colSpan={9}>{group.label}{group.sub && <span>{group.sub}</span>}</td></tr>}
      {children}
    </>
  );
}

function Drawer({ a, onDeleted }: { a: Activity; onDeleted: () => void }) {
  const plan = usePlan();
  const w = when(a), pp = paceOrPower(a);
  const [confirm, setConfirm] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => { setConfirm(false); setBig(false); }, [a.id]);
  return (
    <aside className="card drawer" aria-label="Activity detail">
      {big && a.route && <MapModal route={a.route} title={a.name} sub={`${w.l1} · ${distance(a)} · ${fmtHMS(a.min)}`} onClose={() => setBig(false)} />}
      <div className="hd">
        <SportIcon sport={a.sport} size={40} />
        <div><b>{a.name}</b><small>{w.l1}{w.l2 ? ` · ${w.l2}` : ""}</small><small>{subtitle(a)}{a.excluded ? " · excluded from analysis" : ""}</small></div>
      </div>
      <div className="actions">
        <button type="button" className={`btn ghost small${a.excluded ? " on" : ""}`} onClick={() => plan.toggleExcluded(a.id)} aria-pressed={!!a.excluded}>{a.excluded ? "Include in analysis" : "Exclude from analysis"}</button>
        {confirm ? (
          <span className="confirm"><span>Delete this activity?</span><button type="button" className="btn danger small" onClick={() => { plan.deleteActivity(a.id); onDeleted(); }}>Delete</button><button type="button" className="btn ghost small" onClick={() => setConfirm(false)}>Cancel</button></span>
        ) : (
          <button type="button" className="btn ghost small" onClick={() => setConfirm(true)}>Delete</button>
        )}
      </div>
      {a.excluded && <div className="note">Not counted in analysis, weekly volume, load or session status. It stays in this list.</div>}
      <div className="grid">
        <div><div className="v">{distance(a)}</div><div className="k">Distance</div></div>
        <div><div className="v">{fmtHMS(a.min)}</div><div className="k">Time</div></div>
        <div><div className="v">{pp.v}<small>{pp.u}</small></div><div className="k">{a.sport === "bike" ? "Avg speed" : "Pace"}</div></div>
        {a.hr ? <div><div className="v">{Math.round(a.hr)}<small>bpm</small></div><div className="k">Avg heart rate</div></div> : null}
        {a.elev_ft ? <div><div className="v">{elev(a.elev_ft).v.toLocaleString()}<small>{elev(0).u}</small></div><div className="k">Elevation gain</div></div> : null}
        <div><div className="v">{activityLoad(a, plan.athlete.lthr ?? undefined)}</div><div className="k">Load</div></div>
        <div><div className="v"><Effort n={effortLevel(a, plan.athlete.lthr) || 1} /></div><div className="k">Effort</div></div>
      </div>
      <h4>Route</h4>
      <div className="map">
        <RouteMap route={a.route} height={150} />
        {a.route && <button type="button" className="exp" onClick={() => setBig(true)} aria-label="Expand map" title="Whole route, zoom and drag"><Icon name="expand" /></button>}
      </div>
      {a.coachNote && (<><h4>Coach insight</h4><div className="note"><CoachNote text={a.coachNote} /></div></>)}
      {a.note && (<><h4>Your note</h4><div className="note">{a.note}</div></>)}
      <h4>Details</h4>
      <div className="kv">
        <div><span>Activity type</span><span>{a.sport === "bike" ? "Ride" : a.sport[0].toUpperCase() + a.sport.slice(1)}</span></div>
        <div><span>Source</span><span>{a.source === "garmin" ? "Garmin" : "Manual"}</span></div>
        {a.route && plan.athlete.city && <div><span>Location</span><span>{plan.athlete.city}</span></div>}
        <div><span>Start</span><span>{w.l2 || "—"}</span></div>
      </div>
    </aside>
  );
}
