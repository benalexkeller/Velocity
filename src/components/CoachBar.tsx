"use client";
import { Icon } from "./icons";
import { useCoachDock } from "./CoachDock";

// "Talk to the coach" bar, pinned to the bottom of the page. Clicking it opens the coach panel on the right.
// Hidden while the panel is open.
export function CoachBar({ id = "coach-open" }: { id?: string }) {
  const dock = useCoachDock();
  if (dock.open) return null;
  return (
    <div className="coachbar-wrap">
      <button type="button" id={id} className="card coachbar" onClick={() => dock.setOpen(true)} aria-label="Talk to the coach">
        <span className="spark"><Icon name="spark" /></span>
        <span className="ph">Ask your coach…</span>
        <span className="send" aria-hidden><Icon name="arrow" /></span>
      </button>
    </div>
  );
}
