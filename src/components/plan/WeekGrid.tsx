"use client";
import { Icon } from "../icons";
import { SportIcon } from "../SportIcon";
import type { Session, Week } from "@/lib/data";
import { DAYS, addDays, fromYmd, hoursToClock, today, ymd } from "@/lib/format";

const H0 = 5, H1 = 21, ROW = 20; // 05:00–21:00, 26px per hour (labels every 2h); blocks keep a readable min height

function toH(hhmm?: string) { if (!hhmm) return H0; const [h, m] = hhmm.split(":").map(Number); return h + m / 60; }

export function WeekGrid({ week, selectedId, onPick }: { week: Week; selectedId?: string | null; onPick?: (s: Session) => void }) {
  const start = fromYmd(week.start);
  const t = today();
  const nowD = new Date();
  const nowH = nowD.getHours() + nowD.getMinutes() / 60;
  const height = (H1 - H0) * ROW;
  const y = (h: number) => (h - H0) * ROW;

  return (
    <div className="wg">
      <div className="wg-head">
        <div />
        {DAYS.map((d, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          return (
            <div key={d} className={`wg-day${isT ? " today" : ""}`}>
              <span>{d.toUpperCase()}</span>
              <b>{date.getDate()}</b>
            </div>
          );
        })}
      </div>
      <div className="wg-body" style={{ height }}>
        <div className="wg-hours">
          {Array.from({ length: (H1 - H0) / 2 + 1 }, (_, k) => H0 + k * 2).map((h) => (
            <span key={h} style={{ top: y(h) }}>{String(h).padStart(2, "0")}:00</span>
          ))}
        </div>
        {DAYS.map((_, i) => {
          const date = addDays(start, i);
          const isT = date.getTime() === t.getTime();
          const sessions = week.sessions.filter((s) => s.dayIndex === i);
          return (
            <div key={i} className={`wg-col${isT ? " today" : ""}`}>
              {sessions.map((s) => <Block key={s.id} s={s} y={y} selected={s.id === selectedId} onPick={onPick} />)}
              {isT && nowH >= H0 && nowH <= H1 && (
                <div className="wg-now" style={{ top: y(nowH) }}>
                  <span>NOW {hoursToClock(nowH)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Block({ s, y, selected, onPick }: { s: Session; y: (h: number) => number; selected?: boolean; onPick?: (s: Session) => void }) {
  if (s.sport === "rest") {
    return (
      <div className={`wg-ev rest${s.status === "done" ? " done" : ""}${selected ? " sel" : ""}`} style={{ top: 6 }} onClick={() => onPick?.(s)} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined}>
        <SportIcon sport="rest" size={20} />
        <div className="txt"><b>Rest day{s.status === "done" && <span className="ck"><Icon name="check" /></span>}</b><small>No session</small></div>
      </div>
    );
  }
  const h0 = toH(s.start), h1 = h0 + s.min / 60;
  const done = s.status === "done";
  return (
    <div className={`wg-ev ${s.sport}${done ? " done" : ""}${selected ? " sel" : ""}`} style={{ top: y(h0) + 2, height: Math.max(44, (h1 - h0) * ROW - 4) }} title={s.text} onClick={() => onPick?.(s)} role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined}>
      <SportIcon sport={s.sport} size={20} />
      <div className="txt">
        <b>{s.title}{done && <span className="ck"><Icon name="check" /></span>}<span className="dot">·</span>{s.start}</b>
        <small>{s.intensity} · {s.min} min</small>
      </div>
    </div>
  );
}

export function weekTitle(w: Week) {
  const s = fromYmd(w.start), e = addDays(s, 6);
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const same = s.getMonth() === e.getMonth();
  return `Week ${w.week} · ${M[s.getMonth()]} ${s.getDate()} – ${same ? "" : M[e.getMonth()] + " "}${e.getDate()}`;
}
export const isoToday = () => ymd(today());
