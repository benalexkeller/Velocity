"use client";
import Link from "next/link";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { RouteMap } from "../RouteMap";
import { WEEKS, activitiesOn, activityLoad, plannedLoad, type Session } from "@/lib/data";
import { ATHLETE } from "@/lib/config";
import { dateLabel, fmtHMS, fmtPace } from "@/lib/format";
import { elev, fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";

export function findSession(id: string | null) {
  if (!id) return null;
  for (const w of WEEKS) { const s = w.sessions.find((x) => x.id === id); if (s) return { s, w }; }
  return null;
}

function targetOf(s: Session) {
  const sp = s.sport === "brick" ? "bike" : s.sport;
  const z = ATHLETE.zones[sp]?.[s.intensity];
  if (!z) return null;
  return { k: sp === "bike" ? "Target speed" : "Target pace", v: z, u: sp === "bike" ? "" : sp === "swim" ? "per 100 yd" : "per mile" };
}

// Large session view on the Plan page: opened from the dashboard cards or by clicking a block in the week.
export function SessionPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const hit = findSession(id);
  if (!hit) return null;
  const { s, w } = hit;
  const tgt = targetOf(s);
  const acts = activitiesOn(s.date);
  const status = s.status === "done" ? "Completed" : s.status === "missed" ? "Missed" : "Planned";
  return (
    <section className={`card session-panel ${s.status}`} aria-label="Session detail">
      <button className="close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      <div className="sp-head">
        <SportIcon sport={s.sport} size={56} />
        <div>
          <div className="eyebrow">{dateLabel(s.date)}{s.start ? ` · ${s.start}` : ""} · Week {w.week} · {w.phaseShort}</div>
          <h2>{s.title}{s.sport !== "rest" && <span className="dim"> · {s.intensity}</span>}</h2>
          <span className={`status ${s.status}`}>{s.status === "done" && "✓ "}{status}</span>
        </div>
      </div>
      {s.sport !== "rest" && (
        <div className="sp-stats">
          <div className="stat"><div className="k">Duration</div><div className="v">{s.min} min</div></div>
          <div className="stat"><div className="k">Intensity</div><div className="v">{s.intensity}</div></div>
          {tgt && <div className="stat"><div className="k">{tgt.k}</div><div className="v">{tgt.v}</div>{tgt.u && <div className="u">{tgt.u}</div>}</div>}
          <div className="stat"><div className="k">Planned load</div><div className="v">{plannedLoad(s)}</div></div>
        </div>
      )}
      <div className="sp-body">
        <div>
          <div className="eyebrow muted">Session</div>
          <p className="txt">{s.text}</p>
          <p className="why">{s.why}</p>
          <div className="eyebrow muted" style={{ marginTop: 14 }}>This week</div>
          <p className="why">{w.focus}</p>
        </div>
        <div>
          <div className="eyebrow muted">{acts.length ? "Logged that day" : "Actions"}</div>
          {acts.length ? (
            <div className="sp-acts">
              {acts.map((a) => (
                <Link key={a.id} href="/activities" className="sp-act">
                  <SportIcon sport={a.sport} size={26} />
                  <div className="t"><b>{a.name}</b><small>{a.start ? `${a.start} · ` : ""}{fmtHMS(a.min)}{a.sport === "swim" && a.yd ? ` · ${swimDist(a.yd).v.toLocaleString()} ${swimDist(0).u}` : a.mi ? ` · ${fmtDist(a.mi)}` : ""}{a.sport === "run" && a.pace_s ? ` · ${fmtPace(runPace(a.pace_s).s)}${runPace(0).u}` : a.sport === "bike" && a.mph ? ` · ${fmtSpeed(a.mph)}` : a.sport === "swim" && a.p100_s ? ` · ${fmtPace(swimPace(a.p100_s).s)}${swimPace(0).u}` : ""}{a.hr ? ` · ${a.hr} bpm` : ""}{a.elev_ft ? ` · ${elev(a.elev_ft).v} ${elev(0).u}` : ""} · load {activityLoad(a)}</small></div>
                  {a.route && <div className="thumb"><RouteMap route={a.route} height={44} bg="var(--surface-2)" pad={0.1} /></div>}
                </Link>
              ))}
            </div>
          ) : (
            <div className="sp-actions">
              <button type="button" className="btn"><Icon name="plus" />Log activity</button>
              <button type="button" className="btn ghost">Move</button>
              <button type="button" className="btn ghost">Edit</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
