"use client";
import { Icon } from "./icons";

// The coach input, pinned to the bottom of the screen on every page.
export function CoachBar({ id = "coach-input" }: { id?: string }) {
  return (
    <form className="card coachbar" onSubmit={(e) => e.preventDefault()}>
      <span className="spark"><Icon name="spark" /></span>
      <input id={id} placeholder="Ask your coach anything…" aria-label="Ask your coach" />
      <button className="send" type="submit" aria-label="Send"><Icon name="arrow" /></button>
    </form>
  );
}
