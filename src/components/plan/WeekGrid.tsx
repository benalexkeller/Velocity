"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { SPORT_LABEL, STATUS_LABEL, type Session, type Week } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { DAYS, addDays, fromYmd, hoursToClock, rangeLabel, today, ymd } from "@/lib/format";
import { useOtherEvents } from "@/lib/calendar/client";
import type { OtherEvent } from "@/lib/calendar/events";

const H0 = 0, H1 = 24, ROW = 20; // the grid covers the whole day, 00:00–24:00; the box shows 16 hours and scrolls for the rest
const VIEW0 = 5, VIEW_H = 16; // opens at 05:00 showing 05:00–21:00, like before
const HOURS_COL = 52; // width of the hour labels column (matches plan.css)
const SNAP = 0.25; // drag snaps to 15 minutes

function toH(hhmm?: string) { if (!hhmm) return H0; const [h, m] = hhmm.split(":").map(Number); return h + m / 60; }
const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

interface Drag { id: string; day: number; h: number; colW: number } // where the block is right now while dragging

export function WeekGrid({ week, selectedId, onPick }: { week: Week; selectedId?: string | null; onPick?: (s: Session) => void }) {
  const plan = usePlan();
  const start = fromYmd(week.start);
  const t = today();
  const nowD = useNow();
  const nowH = nowD.getHours() + nowD.getMinutes() / 60;
  const height = (H1 - H0) * ROW;
  const y = (h: number) => (h - H0) * ROW;
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // the athlete's other Google Calendar events, shown read-only behind and beside the sessions
  const other = useOtherEvents(week.start);
  useEffect(() => { if (box.current) box.current.scrollTop = y(VIEW0) - 8; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // pointer position → day column and snapped start hour (the pointer keeps its hold on the block, so subtract the grab offset)
  const place = (s: Session, clientX: number, clientY: number) => {
    const r = body.current!.getBoundingClientRect();
    const colW = (r.width - HOURS_COL) / 7;
    const day = Math.min(6, Math.max(0, Math.floor((clientX - r.left - HOURS_COL) / colW)));
    if (s.sport === "rest") return { day, h: toH(s.start), colW };
    const raw = H0 + (clientY - r.top) / ROW;
    const h = Math.min(H1 - s.min / 60, Math.max(H0, Math.round(raw / SNAP) * SNAP));
    return { day, h, colW };
  };
  const grab = useRef<{ id: string; x: number; y: number; offPx: number; moved: boolean; last?: { day: number; h: number } } | null>(null);
  const onDown = (s: Session) => (e: React.PointerEvent) => {
    if (e.button !== 0 || s.locked || s.status === "done" || s.status === "partial") return;
    const r = body.current!.getBoundingClientRect();
    grab.current = { id: s.id, x: e.clientX, y: e.clientY, offPx: e.clientY - r.top - y(toH(s.start)), moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (s: Session) => (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== s.id) return;
    if (!g.moved && Math.abs(e.clientX - g.x) < 4 && Math.abs(e.clientY - g.y) < 4) return;
    g.moved = true;
    const p = place(s, e.clientX, e.clientY - g.offPx);
    g.last = p;
    setDrag({ id: s.id, ...p });
    // auto-scroll when the pointer is near the top or bottom edge of the box
    const b = box.current!, br = b.getBoundingClientRect();
    if (e.clientY < br.top + 24) b.scrollTop -= 6; else if (e.clientY > br.bottom - 24) b.scrollTop += 6;
  };
  const onUp = (s: Session) => (e: React.PointerEvent) => {
    const g = grab.current;
    if (!g || g.id !== s.id) { if (!g) onPick?.(s); return; } // done or locked blocks: a plain click still opens the session
    grab.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (g.moved && g.last) {
      const date = ymd(addDays(start, g.last.day));
      const startHM = s.sport === "rest" ? undefined : clock(g.last.h);
      if (date !== s.date || (startHM && startHM !== s.start)) plan.moveSession(s.id, { date, start: startHM });
      setDrag(null);
      return;
    }
    setDrag(null);
    onPick?.(s);
  };

  return (
    <>
    <WeekList week={week} selectedId={selectedId} onPick={onPick} other={other.list} />
    <div className={`wg${drag ? " dragging" : ""}`}>
      <div className="wg-head">
        <div />
        {DAYS.map((d, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          const allDay = other.list.filter((e) => e.allDay && e.date === ymd(date));
          return (
            <div key={d} className={`wg-day${isT ? " today" : ""}${drag && drag.day === i ? " target" : ""}`}>
              <span>{d.toUpperCase()}</span>
              <b>{date.getDate()}</b>
              {allDay.slice(0, 2).map((e) => <i key={e.id} className="wg-allday" title={`${e.title}, all day, ${e.cal} (Google Calendar, read-only)`}>{e.title}</i>)}
              {allDay.length > 2 && <i className="wg-allday more" title={allDay.slice(2).map((e) => e.title).join(", ")}>{allDay.length - 2} more</i>}
            </div>
          );
        })}
      </div>
      {other.error && <div className="wg-note">{other.error}</div>}
      <div className="wg-scroll" ref={box} style={{ height: VIEW_H * ROW }}>
      <div className="wg-body" style={{ height }} ref={body}>
        <div className="wg-hours">
          {Array.from({ length: (H1 - H0) / 2 + 1 }, (_, k) => H0 + k * 2).map((h) => (
            <span key={h} className={h === H0 ? "first" : h === H1 ? "last" : undefined} style={{ top: y(h) }}>{String(h).padStart(2, "0")}:00</span>
          ))}
        </div>
        {DAYS.map((_, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          const sessions = week.sessions.filter((s) => s.dayIndex === i);
          // blocks that would overlap on screen (a ride and the run straight after it, a short session under a
          // tall minimum block) are nudged down so each stays full width and readable
          const tops = topsOf(sessions, y);
          // other events: where one meets a session, the session keeps the left side and the event takes the right
          const ext = layoutOther(other.list.filter((e) => !e.allDay && e.date === ymd(date)), sessions, tops, y);
          return (
            <div key={i} className={`wg-col${isT ? " today" : ""}${drag && drag.day === i ? " target" : ""}`}>
              {ext.items.map((o) => <OtherBlock key={o.e.id} o={o} y={y} />)}
              {sessions.map((s) => <Block key={s.id} s={s} y={y} top={tops.get(s.id)} narrow={ext.narrow.has(s.id) && drag?.id !== s.id} selected={s.id === selectedId} drag={drag?.id === s.id ? drag : null} onDown={onDown(s)} onMove={onMove(s)} onUp={onUp(s)} onLock={() => plan.toggleLock(s.id)} onPick={onPick} />)}
              {isT && nowH >= H0 && nowH <= H1 && (
                <div className="wg-now" style={{ top: y(nowH) }}>
                  <span><b className="now-w">NOW </b>{hoursToClock(nowH)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
    </>
  );
}

// Phones: the week as a list, one row per day. The time grid needs more width than a phone has.
function WeekList({ week, selectedId, onPick, other }: { week: Week; selectedId?: string | null; onPick?: (s: Session) => void; other: OtherEvent[] }) {
  const start = fromYmd(week.start);
  const t = today();
  return (
    <ol className="wl" aria-label={`Week ${week.week}`}>
      {DAYS.map((d, i) => {
        const date = addDays(start, i);
        const isT = date.getTime() === t.getTime();
        const ss = week.sessions.filter((s) => s.dayIndex === i);
        const oe = other.filter((e) => e.date === ymd(date));
        return (
          <li key={d} className={isT ? "today" : ""}>
            <span className="wl-d"><span>{d}</span><b>{date.getDate()}</b></span>
            <div className="wl-ss">
              {oe.length > 0 && <div className="wl-oe">{oe.map((e) => <span key={e.id} title={`${e.cal} (Google Calendar, read-only)`}><b>{e.allDay ? "All day" : `${e.start}-${e.end}`}</b>{e.title}</span>)}</div>}
              {ss.length === 0 || ss.every((s) => s.sport === "rest") ? <span className="wl-rest">Rest</span> : ss.filter((s) => s.sport !== "rest").map((s) => {
                const a = s.status === "done" || s.status === "partial" ? s.actual : undefined;
                return (
                  <button key={s.id} type="button" className={`wl-s ${a?.sport ?? s.sport} ${s.status}${s.id === selectedId ? " sel" : ""}`} onClick={() => onPick?.(s)}>
                    <SportIcon sport={a?.sport ?? s.sport} size={20} />
                    <span className="t"><b>{a ? SPORT_LABEL[a.sport] : s.title}{s.start && <span className="at">{a?.start ?? s.start}</span>}</b><small>{a ? `${a.min} min done` : <>{s.intensity}<span className="at">{s.min} min</span></>}</small></span>
                    {s.status !== "planned" && <span className={`wl-st ${s.status}`}>{s.status === "done" ? "✓" : STATUS_LABEL[s.status]}</span>}
                    {s.locked && s.status !== "done" && <span className="wl-lk" aria-label="Locked"><Icon name="lock" /></span>}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Screen box of a block: where it starts and how tall it is drawn (the minimum keeps short sessions readable). */
function boxOf(s: Session, y: (h: number) => number) {
  const a = s.status === "done" || s.status === "partial" ? s.actual : undefined;
  const h0 = toH(a?.start ?? s.start), min = a?.min ?? s.min;
  const top = s.sport === "rest" ? y(VIEW0) + 6 : y(h0) + 2;
  return { top, bottom: top + Math.max(44, (min / 60) * ROW - 4) };
}
/** The top of each block on screen: its true time, or just under the previous block when they would overlap. */
function topsOf(sessions: Session[], y: (h: number) => number) {
  const out = new Map<string, number>();
  const sorted = [...sessions].filter((s) => s.sport !== "rest").map((s) => ({ s, ...boxOf(s, y) })).sort((a, b) => a.top - b.top);
  let floor = -Infinity;
  for (const o of sorted) {
    const top = Math.max(o.top, floor);
    out.set(o.s.id, top);
    floor = top + (o.bottom - o.top) + 3;
  }
  return out;
}

/** Other events of one day: their lane (side by side when they overlap each other), whether they sit to the right
 *  of a session, and which sessions give up the right side for them. */
interface OtherPlaced { e: OtherEvent; h0: number; h1: number; left: number; width: number }
function layoutOther(list: OtherEvent[], sessions: Session[], tops: Map<string, number>, y: (h: number) => number) {
  const narrow = new Set<string>();
  const sBoxes = sessions.filter((s) => s.sport !== "rest").map((s) => { const b = boxOf(s, y); const top = tops.get(s.id) ?? b.top; return { id: s.id, top, bottom: top + (b.bottom - b.top) }; });
  const evs = list.map((e) => ({ e, h0: toH(e.start), h1: Math.max(toH(e.start) + 0.25, toH(e.end)) })).sort((a, b) => a.h0 - b.h0 || b.h1 - a.h1);
  // clusters of events that overlap each other share their area in lanes
  const items: OtherPlaced[] = [];
  let cluster: { o: (typeof evs)[number]; lane: number }[] = [], ends: number[] = [], clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ends.length);
    // the whole cluster moves to the right when any of its events meets a session
    let hit = false;
    for (const c of cluster) {
      const top = y(c.o.h0), bottom = y(c.o.h1);
      for (const b of sBoxes) if (b.top < bottom && b.bottom > top) { narrow.add(b.id); hit = true; }
    }
    const [x0, x1] = hit ? [64, 100] : [0, 100];
    const w = (x1 - x0) / lanes;
    for (const c of cluster) items.push({ e: c.o.e, h0: c.o.h0, h1: c.o.h1, left: x0 + c.lane * w, width: w });
    cluster = []; ends = [];
  };
  for (const o of evs) {
    if (o.h0 >= clusterEnd) flush();
    let lane = ends.findIndex((end) => end <= o.h0);
    if (lane < 0) { lane = ends.length; ends.push(o.h1); } else ends[lane] = o.h1;
    cluster.push({ o, lane });
    clusterEnd = Math.max(clusterEnd, o.h1);
  }
  flush();
  return { items, narrow };
}

function OtherBlock({ o, y }: { o: OtherPlaced; y: (h: number) => number }) {
  const h = Math.max(16, (o.h1 - o.h0) * ROW - 2);
  return (
    <div className="wg-oe" style={{ top: y(o.h0) + 1, height: h, left: `calc(${o.left}% + 3px)`, width: `calc(${o.width}% - 6px)` }}
      title={`${o.e.title}, ${o.e.start}-${o.e.end}, ${o.e.cal}. From Google Calendar, change it there.`}>
      <b>{o.e.title}</b>{h >= 30 && <small>{o.e.start}-{o.e.end}</small>}
    </div>
  );
}

function Block({ s, y, top, narrow, selected, drag, onDown, onMove, onUp, onLock, onPick }: { s: Session; y: (h: number) => number; top?: number; narrow?: boolean; selected?: boolean; drag: Drag | null; onDown: (e: React.PointerEvent) => void; onMove: (e: React.PointerEvent) => void; onUp: (e: React.PointerEvent) => void; onLock: () => void; onPick?: (s: Session) => void }) {
  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick?.(s); } };
  const done = s.status === "done" || s.status === "partial";
  const a = done ? s.actual : undefined;
  // what was actually done replaces the plan on the block: sport, name and length from the logged activity
  const sport = a?.sport ?? s.sport;
  const min = a?.min ?? s.min;
  const differs = !!a && (a.sport !== s.sport || Math.abs(a.min - s.min) >= 5);
  const h0 = toH(a?.start ?? s.start); // a done block sits where the activity actually started
  const dx = drag ? (drag.day - s.dayIndex) * drag.colW : 0;
  const dy = drag && s.sport !== "rest" ? (drag.h - h0) * ROW : 0;
  const style: React.CSSProperties = drag ? { transform: `translate(${dx}px, ${dy}px)` } : {};
  const cls = `wg-ev ${sport}${done ? " done" : ""}${s.status === "partial" ? " partial" : ""}${s.status === "substituted" ? " substituted" : ""}${selected ? " sel" : ""}${s.locked ? " locked" : ""}${drag ? " drag" : ""}${narrow ? " nar" : ""}`;
  const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };
  const lock = !done && <button type="button" className="lk" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onLock(); }} aria-label={s.locked ? "Unlock session" : "Lock session"} title={s.locked ? "Locked, click to unlock" : "Lock in place"}><Icon name={s.locked ? "lock" : "unlock"} /></button>;
  if (s.sport === "rest") {
    return (
      <div className={cls} style={{ top: y(VIEW0) + 6, ...style }} {...handlers} role="button" tabIndex={0} aria-label={`Rest day, ${DAYS[s.dayIndex]}`} onKeyDown={onKey}>
        <SportIcon sport="rest" size={20} />
        <div className="txt"><b><span className="t">Rest day</span>{done && <span className="ck"><Icon name="check" /></span>}</b><small><span className="t">No session</span></small></div>
        {lock}
      </div>
    );
  }
  const h1 = h0 + min / 60;
  const startLabel = drag ? clock(drag.h) : a?.start ?? s.start;
  return (
    <div className={cls} style={{ top: top ?? y(h0) + 2, height: Math.max(44, (h1 - h0) * ROW - 4), ...style }} title={a ? `${a.name}, ${a.min} min${differs ? `, planned ${s.title} ${s.min} min` : ""}` : s.text} {...handlers} role="button" tabIndex={0} aria-label={`${s.title}, ${DAYS[s.dayIndex]} ${s.start ?? ""}, ${s.intensity}, ${s.min} minutes, ${s.status}`} onKeyDown={onKey}>
      <SportIcon sport={sport} size={20} />
      <div className="txt">
        {/* each line: the main fact, then a second one that shows only when it fits (it wraps below and is clipped) */}
        <b><span className="t">{a ? SPORT_LABEL[a.sport] : s.title}</span>{done && <span className="ck"><Icon name="check" /></span>}<span className="at">{startLabel}</span></b>
        <small><span className="t">{a ? a.name : s.intensity}</span><span className="at">{a ? `${a.min} min${differs ? `, planned ${s.min}` : ""}` : `${s.min} min`}</span></small>
      </div>
      {lock}
    </div>
  );
}

export function weekTitle(w: Week) { return `Week ${w.week}, ${weekRange(w)}`; }
/** Date range of a week without the week number, e.g. "5 – 11 Oct". */
export function weekRange(w: Week) { return rangeLabel(w.start, ymd(addDays(fromYmd(w.start), 6))); }
export const isoToday = () => ymd(today());
