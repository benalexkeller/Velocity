"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CoachNote } from "./CoachNote";
import { usePlan } from "@/lib/store";
import { today, ymd } from "@/lib/format";

export interface CoachMsg { who: "You" | "Coach" | "action"; at?: string; text: string }

// Coach panel: today's messages only (older ones stay saved for the coach service), an input, and a close button.
// Docked on the Plan page; a drawer everywhere else (see CoachDock).
export function CoachRail({ onClose, drawer = false }: { onClose: () => void; drawer?: boolean }) {
  const plan = usePlan();
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const day = ymd(today());
  const msgs = plan.thread.filter((m) => m.day === day && m.who !== "action");
  useEffect(() => { const box = endRef.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; }, [msgs.length]);
  function send() {
    const t = draft.trim();
    if (!t) return;
    plan.post(t);
    setDraft("");
  }
  return (
    <aside className={`coach${drawer ? " drawer" : ""}`} aria-label="Coach">
      <div className="head">
        <span className="eyebrow">Coach · today</span>
        <span className="coach-tools">
          {!plan.accounts && (
            <span style={{ position: "relative" }}>
              <button type="button" className="coach-ic" aria-label="Coach options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="kebab" /></button>
              {menu && (
                <div className="menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { plan.reset(); setMenu(false); }}>Clear changes saved on this device ({plan.changes})</button>
                </div>
              )}
            </span>
          )}
          <button type="button" className="coach-ic" aria-label="Close coach" title="Close" onClick={onClose}><Icon name="close" /></button>
        </span>
      </div>
      <div className="msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}>
            <span className="who">{m.who} {m.at && <span style={{ marginLeft: 6 }}>{m.at}</span>}</span>
            {m.who === "Coach" ? <CoachNote text={m.text} /> : m.text}
          </div>
        ))}
        {msgs.length === 0 && <p className="muted small">Ask about today&apos;s session, this week, moving a session or the race.</p>}
        <div ref={endRef} />
      </div>
      <form className="input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="coach-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your coach…" aria-label="Message your coach" />
        <button className="send" type="submit" aria-label="Send"><span style={{ width: 18, height: 18, display: "inline-flex" }}><Icon name="arrow" /></span></button>
      </form>
    </aside>
  );
}
