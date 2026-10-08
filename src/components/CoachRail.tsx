"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CoachNote } from "./CoachNote";
import { usePlan } from "@/lib/store";

export interface CoachMsg { who: "You" | "Coach" | "action"; at?: string; text: string }

// Coach side panel. The seed thread (owner's local copy only) is the example conversation; new messages go to
// the store and get a data answer until the coach service is connected. No fake plan changes are shown.
export function CoachRail({ thread, placeholder = "Ask your coach or log how it went…", summary }: { thread: CoachMsg[]; placeholder?: string; summary?: string }) {
  const plan = usePlan();
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs: CoachMsg[] = [...thread.filter((m) => m.who !== "action"), ...plan.thread];
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
              {!plan.accounts && <button type="button" role="menuitem" onClick={() => { plan.reset(); setMenu(false); }}>Clear changes saved on this device ({plan.changes})</button>}
              <div className="muted small">Coach replies: limited to today, tomorrow, this week, moving a session and the race. Weekly review: not yet available.</div>
            </div>
          )}
        </span>
      </div>
      {summary && <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>{summary}</div>}
      <div className="msgs">
        {msgs.map((m, i) =>
          m.who === "action" ? (
            <div key={i} className="msg action"><b>{m.text}</b></div>
          ) : (
            <div key={i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}>
              <span className="who">{m.who} {m.at && <span style={{ marginLeft: 6 }}>{m.at}</span>}</span>
              {m.who === "Coach" ? <CoachNote text={m.text} /> : m.text}
            </div>
          )
        )}
        {msgs.length === 0 && <p className="muted small">No messages yet. Ask about today&apos;s session, this week or the race.</p>}
        <div ref={endRef} />
      </div>
      <form className="input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="coach-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label="Message your coach" />
        <button className="send" type="submit" aria-label="Send"><span style={{ width: 18, height: 18, display: "inline-flex" }}><Icon name="arrow" /></span></button>
      </form>
    </aside>
  );
}
