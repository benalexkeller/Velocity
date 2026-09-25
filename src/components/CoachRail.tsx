"use client";
import { useState } from "react";
import { Icon } from "./icons";

export interface CoachMsg { who: "You" | "Coach" | "action"; at?: string; text: string }

export function CoachRail({ thread, placeholder = "Ask your coach or log how it went…", summary }: { thread: CoachMsg[]; placeholder?: string; summary?: string }) {
  const [msgs, setMsgs] = useState(thread);
  const [draft, setDraft] = useState("");
  function send() {
    const t = draft.trim();
    if (!t) return;
    setMsgs((m) => [...m, { who: "You", at: now(), text: t }, { who: "Coach", at: now(), text: "Got it — I'll have an answer for you once the coach service is connected." }]);
    setDraft("");
  }
  return (
    <aside className="coach" aria-label="Coach">
      <div className="head">
        <span className="eyebrow">Coach</span>
        <span style={{ width: 20, height: 20, color: "var(--muted)" }}><Icon name="more" /></span>
      </div>
      {summary && <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{summary}</div>}
      <div className="msgs">
        {msgs.map((m, i) =>
          m.who === "action" ? (
            <div key={i} className="msg action"><span className="ok">✓</span><b>{m.text}</b><button type="button">Undo</button></div>
          ) : (
            <div key={i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}>
              <span className="who">{m.who} {m.at && <span style={{ marginLeft: 6 }}>{m.at}</span>}</span>
              {m.text}
            </div>
          )
        )}
      </div>
      <form className="input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="coach-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label="Message your coach" />
        <button className="send" type="submit" aria-label="Send"><span style={{ width: 18, height: 18, display: "inline-flex" }}><Icon name="arrow" /></span></button>
      </form>
    </aside>
  );
}
function now() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
