"use client";
import { Icon } from "./icons";
import { useCoachDock } from "./CoachDock";

// "Ask your coach" bar, pinned to the bottom of the page. Clicking it, or typing in it, opens the coach panel
// (what was typed carries over). Hidden while the panel is open.
export function CoachBar({ id = "coach-open" }: { id?: string }) {
  const dock = useCoachDock();
  if (dock.open) return null;
  return (
    <div className="coachbar-wrap">
      <label className="card coachbar" htmlFor={id} onClick={() => dock.setOpen(true)}>
        <span className="spark"><Icon name="spark" /></span>
        <input id={id} className="ph-in" placeholder="Ask your coach…" aria-label="Ask your coach" autoComplete="off" onChange={(e) => { if (e.target.value) dock.openWith(e.target.value); }} />
        <span className="send" aria-hidden><Icon name="arrow" /></span>
      </label>
    </div>
  );
}
