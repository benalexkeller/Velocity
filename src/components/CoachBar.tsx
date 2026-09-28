"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { CoachNote } from "./CoachNote";
import { usePlan } from "@/lib/store";

// The coach input, pinned to the bottom of the screen on every page. Sending saves the message and
// shows the coach's answer above the bar; the full thread lives in the Plan page's coach panel.
export function CoachBar({ id = "coach-input" }: { id?: string }) {
  const plan = usePlan();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const last = plan.thread.slice(-2);
  function send() { const t = draft.trim(); if (!t) return; plan.post(t); setDraft(""); setOpen(true); }
  return (
    <div className="coachbar-wrap">
      {open && last.length > 0 && (
        <div className="card coachbar-reply">
          <button type="button" className="close" aria-label="Hide" onClick={() => setOpen(false)}><Icon name="close" /></button>
          {last.map((m, i) => <div key={i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}><span className="who">{m.who} · {m.at}</span>{m.who === "Coach" ? <CoachNote text={m.text} /> : m.text}</div>)}
        </div>
      )}
      <form className="card coachbar" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <span className="spark"><Icon name="spark" /></span>
        <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your coach anything…" aria-label="Ask your coach" />
        <button className="send" type="submit" aria-label="Send"><Icon name="arrow" /></button>
      </form>
    </div>
  );
}
