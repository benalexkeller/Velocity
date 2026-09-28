"use client";
import { usePlan } from "@/lib/store";
import type { Session } from "@/lib/data";
import { DAYS, addDays, fromYmd, today, ymd } from "@/lib/format";
import { SportIcon } from "../SportIcon";

export function MonthGrid({ year, month, onPick, selectedId }: { year: number; month: number; onPick?: (s: Session) => void; selectedId?: string | null }) {
  const plan = usePlan();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const nDays = new Date(year, month + 1, 0).getDate();
  const t = today();
  const cells: Date[] = [];
  for (let i = lead; i > 0; i--) cells.push(addDays(first, -i));
  for (let d = 1; d <= nDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(addDays(cells[cells.length - 1], 1));
  const sessionsOn = (date: string) => plan.weeks.flatMap((w) => w.sessions).filter((s) => s.date === date);

  return (
    <div className="mg">
      {DAYS.map((d) => <div key={d} className="mg-h">{d.toUpperCase()}</div>)}
      {cells.map((d) => {
        const ds = ymd(d), dim = d.getMonth() !== month, isT = d.getTime() === t.getTime();
        const acts = plan.activitiesOn(ds), sessions = sessionsOn(ds);
        const done = acts.length > 0;
        return (
          <div key={ds} className={`mg-c${dim ? " dim" : ""}${isT ? " today" : ""}${done ? " done" : ""}`}>
            <span className="n">{d.getDate()}</span>
            {(done ? acts : sessions).slice(0, 3).map((s, i) => (
              <div key={i} className={`mg-s ${s.sport}${"title" in s && s.id === selectedId ? " sel" : ""}`} onClick={() => { if ("title" in s) onPick?.(s); else { const ss = sessions[0]; if (ss) onPick?.(ss); } }} role={onPick ? "button" : undefined}>
                <SportIcon sport={s.sport} size={12} />
                <span>{"title" in s ? s.title : s.name}</span>
                {"min" in s && s.min ? <em>{s.min}m</em> : null}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
