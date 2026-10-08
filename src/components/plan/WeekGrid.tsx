"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import { SPORT_LABEL, STATUS_LABEL, type Session, type Week } from "@/lib/data";
import { usePlan } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { DAYS, addDays, fromYmd, hoursToClock, rangeLabel, today, ymd } from "@/lib/format";

const H0 = 4, H1 = 23, ROW = 20; // the grid covers 04:00–23:00; the box shows 16 hours and scrolls for the rest
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
    <WeekList week={week} selectedId={selectedId} onPick={onPick} />
    <div className={`wg${drag ? " dragging" : ""}`}>
      <div className="wg-head">
        <div />
        {DAYS.map((d, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          return (
            <div key={d} className={`wg-day${isT ? " today" : ""}${drag && drag.day === i ? " target" : ""}`}>
              <span>{d.toUpperCase()}</span>
              <b>{date.getDate()}</b>
            </div>
          );
        })}
      </div>
      <div className="wg-scroll" ref={box} style={{ height: VIEW_H * ROW }}>
      <div className="wg-body" style={{ height }} ref={body}>
        <div className="wg-hours">
          {Array.from({ length: Math.floor((H1 - H0 - 1) / 2) + 1 }, (_, k) => H0 + 1 + k * 2).map((h) => (
            <span key={h} style={{ top: y(h) }}>{String(h).padStart(2, "0")}:00</span>
          ))}
        </div>
        {DAYS.map((_, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          const sessions = week.sessions.filter((s) => s.dayIndex === i);
          return (
            <div key={i} className={`wg-col${isT ? " today" : ""}${drag && drag.day === i ? " target" : ""}`}>
              {sessions.map((s) => <Block key={s.id} s={s} y={y} selected={s.id === selectedId} drag={drag?.id === s.id ? drag : null} onDown={onDown(s)} onMove={onMove(s)} onUp={onUp(s)} onLock={() => plan.toggleLock(s.id)} onPick={onPick} />)}
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
function WeekList({ week, selectedId, onPick }: { week: Week; selectedId?: string | null; onPick?: (s: Session) => void }) {
  const start = fromYmd(week.start);
  const t = today();
  return (
    <ol className="wl" aria-label={`Week ${week.week}`}>
      {DAYS.map((d, i) => {
        const date = addDays(start, i);
        const isT = date.getTime() === t.getTime();
        const ss = week.sessions.filter((s) => s.dayIndex === i);
        return (
          <li key={d} className={isT ? "today" : ""}>
            <span className="wl-d"><span>{d}</span><b>{date.getDate()}</b></span>
            <div className="wl-ss">
              {ss.length === 0 || ss.every((s) => s.sport === "rest") ? <span className="wl-rest">Rest</span> : ss.filter((s) => s.sport !== "rest").map((s) => {
                const a = s.status === "done" || s.status === "partial" ? s.actual : undefined;
                return (
                  <button key={s.id} type="button" className={`wl-s ${a?.sport ?? s.sport} ${s.status}${s.id === selectedId ? " sel" : ""}`} onClick={() => onPick?.(s)}>
                    <SportIcon sport={a?.sport ?? s.sport} size={20} />
                    <span className="t"><b>{a ? SPORT_LABEL[a.sport] : s.title}{s.start ? ` · ${a?.start ?? s.start}` : ""}</b><small>{a ? `${a.min} min done` : `${s.intensity} · ${s.min} min`}</small></span>
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

function Block({ s, y, selected, drag, onDown, onMove, onUp, onLock, onPick }: { s: Session; y: (h: number) => number; selected?: boolean; drag: Drag | null; onDown: (e: React.PointerEvent) => void; onMove: (e: React.PointerEvent) => void; onUp: (e: React.PointerEvent) => void; onLock: () => void; onPick?: (s: Session) => void }) {
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
  const cls = `wg-ev ${sport}${done ? " done" : ""}${s.status === "partial" ? " partial" : ""}${s.status === "substituted" ? " substituted" : ""}${selected ? " sel" : ""}${s.locked ? " locked" : ""}${drag ? " drag" : ""}`;
  const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };
  const lock = !done && <button type="button" className="lk" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onLock(); }} aria-label={s.locked ? "Unlock session" : "Lock session"} title={s.locked ? "Locked · click to unlock" : "Lock in place"}><Icon name={s.locked ? "lock" : "unlock"} /></button>;
  if (s.sport === "rest") {
    return (
      <div className={cls} style={{ top: y(VIEW0) + 6, ...style }} {...handlers} role="button" tabIndex={0} aria-label={`Rest day, ${DAYS[s.dayIndex]}`} onKeyDown={onKey}>
        <SportIcon sport="rest" size={20} />
        <div className="txt"><b>Rest day{done && <span className="ck"><Icon name="check" /></span>}</b><small>No session</small></div>
        {lock}
      </div>
    );
  }
  const h1 = h0 + min / 60;
  const startLabel = drag ? clock(drag.h) : a?.start ?? s.start;
  return (
    <div className={cls} style={{ top: y(h0) + 2, height: Math.max(44, (h1 - h0) * ROW - 4), ...style }} title={a ? `${a.name} · ${a.min} min${differs ? ` · planned ${s.title} ${s.min} min` : ""}` : s.text} {...handlers} role="button" tabIndex={0} aria-label={`${s.title}, ${DAYS[s.dayIndex]} ${s.start ?? ""}, ${s.intensity}, ${s.min} minutes, ${s.status}`} onKeyDown={onKey}>
      <SportIcon sport={sport} size={20} />
      <div className="txt">
        <b>{a ? SPORT_LABEL[a.sport] : s.title}{done && <span className="ck"><Icon name="check" /></span>}<span className="dot">·</span>{startLabel}</b>
        <small>{a ? `${a.name} · ${a.min} min${differs ? ` · planned ${s.min}` : ""}` : `${s.intensity} · ${s.min} min`}</small>
      </div>
      {lock}
    </div>
  );
}

export function weekTitle(w: Week) { return `Week ${w.week} · ${weekRange(w)}`; }
/** Date range of a week without the week number, e.g. "5 – 11 Oct". */
export function weekRange(w: Week) { return rangeLabel(w.start, ymd(addDays(fromYmd(w.start), 6))); }
export const isoToday = () => ymd(today());
