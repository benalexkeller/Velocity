"use client";
import "./dashboard.css";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { SportIcon } from "@/components/SportIcon";
import { MapModal, RouteMap } from "@/components/RouteMap";
import { Watch } from "@/components/Watch";
import { CoachBar } from "@/components/CoachBar";
import { LogActivity } from "@/components/dashboard/LogActivity";
import { useEffect, useState } from "react";
import { PaceChart, VolumeChart } from "@/components/dashboard/Charts";
import { rollingCompliance, weekLoad, type Session } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { DAYS, MONTHS, addDays, dateLabel, fmtDur, fmtHMS, fromYmd, today, ymd } from "@/lib/format";
import { fmtDist, fmtSpeed, runPace, swimDist, swimPace } from "@/lib/units";
import { fmtPace } from "@/lib/format";

function heroSub(s: Session) {
  if (s.sport === "rest") return "Recovery day";
  const t = s.text.toLowerCase();
  if (/drill|technique/.test(t)) return "Technique";
  if (/long ride|long run/.test(t)) return "Long endurance";
  if (/tempo|threshold/.test(t)) return "Tempo";
  if (/strides/.test(t)) return "Aerobic + strides";
  return "Aerobic endurance";
}
function target(s: Session, z: Record<string, Record<string, string>>) {
  if (s.sport === "run") return { k: "Target pace", v: z.run[s.intensity] ?? z.run["Zone 2"], u: `per ${runPace(0).u.replace("/", "")}` };
  if (s.sport === "bike" || s.sport === "brick") return { k: "Target speed", v: z.bike[s.intensity] ?? z.bike["Zone 2"], u: "" };
  if (s.sport === "swim") return { k: "Target pace", v: z.swim[s.intensity] ?? z.swim["Aerobic"], u: `per 100 ${swimDist(0).u}` };
  return null;
}

export default function Dashboard() {
  const plan = usePlan();
  const t = today();
  const ds = ymd(t);
  const cur = plan.currentWeek();
  const ws = { ...plan.weekStatus(cur), load: weekLoad(cur, plan.counted) };
  const comp = rollingCompliance(28, plan.weeks);
  const todayS = plan.sessionOn(ds);
  const next = [1, 2].map((n) => ({ off: n, s: plan.sessionOn(ymd(addDays(t, n))) }));
  const last = plan.counted[plan.counted.length - 1];
  const garmin = plan.activities.some((a) => a.source === "garmin"); // until the Garmin connection exists, "connected" = Garmin data present
  const done = todayS?.status === "done";
  const tgt = todayS ? target(todayS, plan.athlete.zones) : null;
  const PHASES = plan.phases, WEEKS = plan.weeks;
  const phase = PHASES.find((p) => cur.week >= p.from && cur.week <= p.to);
  const stops = ["Base", "Build", "Peak", "Race"];
  const stopAt = (k: string) => { const p = PHASES.find((x) => x.short.startsWith(k)); return p ? (p.from - 1) / Math.max(1, WEEKS.length - 1) : 1; };
  const pos = (cur.week - 1) / Math.max(1, WEEKS.length - 1);
  const [logging, setLogging] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  return (
    <main className="main">
      <div className="dash">
        <div className="dash-top">
          <div className="dash-left">
          <div className="dash-row1">
          <Link href={todayS ? `/plan?session=${todayS.id}` : "/plan"} className={`hero${done ? " done" : ""}`} aria-label="Today's session — open in plan">
            <div className="top"><span>Today&apos;s session{done ? <span className="donetag">✓ Completed</span> : null}</span><span>{DAYS[(t.getDay() + 6) % 7]} {t.getDate()} {MONTHS[t.getMonth()]}</span></div>
            <div>
              <div className="title">{todayS ? todayS.title : plan.hasPlan ? "Rest" : "No session"}</div>
              <div className="sub">{todayS ? heroSub(todayS) : plan.hasPlan ? "No plan for today" : "No plan yet · build one in Plan"}</div>
            </div>
            <div className="stats">
              {todayS && todayS.sport !== "rest" ? (
                <>
                  <div className="stat"><div className="k">Duration</div><div className="v">{todayS.min} min</div></div>
                  <div className="stat"><div className="k">Intensity</div><div className="v">{todayS.intensity}</div></div>
                  {tgt && <div className="stat"><div className="k">{tgt.k}</div><div className="v">{tgt.v}</div><div className="u">{tgt.u}</div></div>}
                </>
              ) : (
                <>
                  <div className="stat"><div className="k">Duration</div><div className="v">0 min</div></div>
                  <div className="stat"><div className="k">Intensity</div><div className="v">{plan.hasPlan || todayS ? "Rest" : "—"}</div></div>
                  <div className="stat"><div className="k">Next session</div><div className="v">{next[0].s ? `${next[0].s.title} ${next[0].s.min} min` : "—"}</div><div className="u">{next[0].s ? `${DAYS[(addDays(t, 1).getDay() + 6) % 7]}${next[0].s.start ? ` · ${next[0].s.start}` : ""}` : ""}</div></div>
                </>
              )}
              <div className="stat gm">{garmin && <div className="garmin" aria-hidden="true"><Watch width={116} /></div>}<div className="k">Garmin</div><div className="v">{garmin ? <><i className="led" />Connected</> : <span className="dim">Not connected</span>}</div></div>
            </div>
          </Link>

          <section className="card logcard" aria-label="Log activity">
            <button type="button" className="plus" aria-label="Log activity" aria-expanded={logging} onClick={() => setLogging((o) => !o)}><Icon name="plus" /></button>
            <b>Add manually</b>
            <small>Log a swim, bike, run or anything else</small>
          </section>
          <LogActivity open={logging} onClose={() => setLogging(false)} onSaved={(a) => { plan.logActivity(a); setLogging(false); setToast(`Saved · ${a.name} · ${fmtHMS(a.min)}`); }} />
          </div>
          <div className="dash-row2">
          {next.map(({ off, s }) => {
            const d = addDays(t, off);
            return (
              <Link key={off} href={s ? `/plan?session=${s.id}` : "/plan"} className="card next" aria-label={off === 1 ? "Tomorrow" : DAYS[(d.getDay() + 6) % 7]}>
                <div>
                  <div className="eyebrow">{off === 1 ? "Tomorrow" : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(d.getDay() + 6) % 7]}</div>
                  <div className="date">{dateLabel(ymd(d))}</div>
                </div>
                <div className="row">
                  <SportIcon sport={s?.sport ?? "rest"} size={48} />
                  <div>
                    <div className="t">{s ? (s.sport === "rest" ? "Rest day" : `${s.title} ${heroSub(s).toLowerCase()}`) : "Nothing planned"}</div>
                    <div className="d">{s ? (s.sport === "rest" ? "No session planned" : fmtDur(s.min)) : ""}</div>
                  </div>
                  <span className="chev"><Icon name="chevron" /></span>
                </div>
              </Link>
            );
          })}
          </div>
          </div>

          <div className="dash-right">
          <Link href="/analysis" className="card tw" aria-label="This week — open analysis">
            <div className="head"><span className="eyebrow">This week</span><small>{comp.pct == null ? "No sessions planned yet" : `Completed sessions · 28 days · ${comp.pct}% (${Math.round(comp.done * 2) / 2} of ${comp.planned})`}</small></div>
            <div className="cols">
              <div className="col"><div className="k">Sessions</div><div className="v">{ws.done}<span className="dim">/{ws.total}</span></div><div className="progress"><i style={{ width: `${ws.total ? Math.min(100, (ws.done / ws.total) * 100) : 0}%` }} /></div></div>
              <div className="col"><div className="k">Volume</div><div className="v">{ws.actualH.toFixed(1)}<span className="dim">/{Math.round(ws.plannedH)} h</span></div><div className="progress"><i style={{ width: `${Math.min(100, (ws.actualH / ws.plannedH) * 100)}%` }} /></div></div>
              <div className="col"><div className="k">Load</div><div className="v">{ws.load.actual}<span className="dim">/{ws.load.planned}</span></div><div className="progress"><i style={{ width: `${Math.min(100, (ws.load.actual / Math.max(1, ws.load.planned)) * 100)}%` }} /></div></div>
            </div>
          </Link>

          <section className="card la lastact" aria-label="Last activity">
            <div className="head"><span className="eyebrow">Last activity</span><Link href={last ? `/activities?a=${last.id}` : "/activities"}>View all activities →</Link></div>
            {last ? (
              <>
                <Link href={`/activities?a=${last.id}`} className="name">{last.name}</Link>
                <div className="date">{dateLabel(last.date)}{last.start ? ` · ${last.start}` : ""}</div>
                <div className="stats">
                  <div><div className="k">{last.sport === "swim" ? "Distance" : "Distance"}</div><div className="v">{last.sport === "swim" ? `${swimDist(last.yd ?? 0).v} ${swimDist(0).u}` : fmtDist(last.mi)}</div></div>
                  <div><div className="k">Time</div><div className="v">{fmtHMS(last.min)}</div></div>
                  <div>
                    <div className="k">{last.sport === "bike" ? "Avg speed" : last.hr ? "Avg HR" : "Pace"}</div>
                    <div className="v">{last.sport === "bike" ? fmtSpeed(last.mph) : last.hr ? `${Math.round(last.hr)} bpm` : last.pace_s ? fmtPace(runPace(last.pace_s).s) : last.p100_s ? fmtPace(swimPace(last.p100_s).s) : "—"}</div>
                  </div>
                </div>
                <div className="map">
                  <RouteMap route={last.route} height={140} />
                  {last.route && <button className="exp" type="button" onClick={() => setMapOpen(true)} aria-label="Expand map" title="Whole route, zoom and drag"><Icon name="expand" /></button>}
                  {last.route && plan.athlete.city && <span className="loc">{plan.athlete.city}</span>}
                  {mapOpen && last.route && <MapModal route={last.route} title={last.name} sub={`${dateLabel(last.date)}${last.start ? ` · ${last.start}` : ""} · ${fmtHMS(last.min)}`} onClose={() => setMapOpen(false)} />}
                </div>
              </>
            ) : <div className="muted">No activities yet.</div>}
          </section>
          </div>
        </div>

        <section className="card phase" aria-label="Training phase">
          <div><div className="eyebrow">Training phase</div><div className="pos">{plan.hasPlan ? `${phase?.short ?? cur.phaseShort} · Week ${cur.week} of ${WEEKS.length}` : "No plan yet"}</div></div>
          {plan.hasPlan && <div className="track">
            <div className="line" /><div className="fill" style={{ width: `${pos * 100}%` }} />
            {stops.map((k) => { const f = stopAt(k); return (<span key={k}><span className="lbl" style={{ left: `${f * 100}%` }}>{k}</span><span className={`stop${pos >= f ? " on" : ""}`} style={{ left: `${f * 100}%` }} /></span>); })}
            <span className="stop on" style={{ left: `${pos * 100}%`, width: 18, height: 18, top: 18, boxShadow: "0 0 0 3px var(--surface)" }} />
          </div>}
        </section>


        <div className="dash-charts">
          <PaceChart />
          <VolumeChart />
        </div>

        {toast && <div className="toast" role="status">✓ {toast} <span className="muted">· saved on this device until accounts exist</span></div>}
        <CoachBar id="dash-coach" />
      </div>
    </main>
  );
}
