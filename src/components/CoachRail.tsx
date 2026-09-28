"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CoachNote } from "./CoachNote";
import { usePlan } from "@/lib/store";

export interface CoachMsg { who: "You" | "Coach" | "action"; at?: string; text: string }

// Coach side panel. The seed thread is the example conversation; new messages go to the local store
// and get a data answer until the coach service is connected. "Undo" reverts the example plan change.
export function CoachRail({ thread, placeholder = "Ask your coach or log how it went…", summary }: { thread: CoachMsg[]; placeholder?: string; summary?: string }) {
  const plan = usePlan();
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs: CoachMsg[] = [...thread.filter((m) => !(plan.undone && m.who === "action")), ...(plan.undone ? [{ who: "action" as const, at: "", text: "Plan change reverted · ride back to 07:30" }] : []), ...plan.thread];
  useEffect(() => { const box = endRef.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; }, [plan.thread.length]);
  function send() {
    const t = draft.trim();
    if (!t) return;
    plan.post(t);
    setDraft("");
  }
  return (
    <aside className="coach" aria-label="Coach">
      <div className="head">
        <span className="eyebrow">Coach</span>
        <span style={{ position: "relative" }}>
          <button type="button" className="iconlink" aria-label="Coach options" aria-expanded={menu} onClick={() => setMenu((m) => !m)} style={{ width: 24, height: 24, color: "var(--muted)", border: 0, background: "none", padding: 0 }}><Icon name="more" /></button>
          {menu && (
            <div className="menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { plan.reset(); setMenu(false); }}>Clear my local changes ({plan.changes})</button>
              <div className="muted small">Coach service: not connected. Sunday review: not scheduled.</div>
            </div>
          )}
        </span>
      </div>
      {summary && <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{summary}</div>}
      <div className="msgs">
        {msgs.map((m, i) =>
          m.who === "action" ? (
            <div key={i} className="msg action"><span className="ok">✓</span><b>{m.text}</b><button type="button" onClick={() => plan.undoPlanUpdate()}>{plan.undone ? "Redo" : "Undo"}</button></div>
          ) : (
            <div key={i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}>
              <span className="who">{m.who} {m.at && <span style={{ marginLeft: 6 }}>{m.at}</span>}</span>
              {m.who === "Coach" ? <CoachNote text={m.text} /> : m.text}
            </div>
          )
        )}
        <div ref={endRef} />
      </div>
      <form className="input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="coach-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label="Message your coach" />
        <button className="send" type="submit" aria-label="Send"><span style={{ width: 18, height: 18, display: "inline-flex" }}><Icon name="arrow" /></span></button>
      </form>
    </aside>
  );
}
