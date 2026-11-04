"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CoachText } from "./CoachNote";
import { usePlan } from "@/lib/store";
import { useCoachDock } from "./CoachDock";
import { today, ymd, dateLabel } from "@/lib/format";
import { SPORT_LABEL } from "@/lib/data";
import type { PlanChange } from "@/lib/coach/types";
import { mealPhoto } from "@/lib/nutrition/meals";

const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", other: "Other" } as const;

export interface CoachMsg { who: "You" | "Coach" | "action"; at?: string; text: string }

const SUGGEST = ["What's today?", "How was last week against the plan?", "Move tomorrow's session to after work", "Am I ramping too fast?"];

function fromLabel(from: string) {
  const [sport, date, start] = from.split(" · ");
  return `${SPORT_LABEL[sport as keyof typeof SPORT_LABEL] ?? sport} ${date ? dateLabel(date) : ""}${start ? ` ${start}` : ""}`.trim();
}
function changeLine(c: PlanChange, name: (id?: string) => string) {
  const who = c.kind === "add" ? `${c.sport ? SPORT_LABEL[c.sport] : "Session"}${c.min ? ` ${c.min} min` : ""}` : c.from ? fromLabel(c.from) : name(c.sessionId);
  if (c.kind === "delete") return `Remove ${who}`;
  if (c.kind === "add") return `Add ${who} on ${c.date ? dateLabel(c.date) : "?"}${c.start ? ` at ${c.start}` : ""}`;
  if (c.kind === "move") return `${who} → ${c.date ? dateLabel(c.date) : "same day"}${c.start ? ` ${c.start}` : ""}`;
  const bits = [c.min ? `${c.min} min` : null, c.intensity, c.text].filter(Boolean).join(", ");
  return `${who} → ${bits || "edited"}`;
}

// Coach panel: today's messages only (older ones stay saved), an input, and a close button.
// Docked on the Plan page; a drawer everywhere else (see CoachDock).
export function CoachRail({ onClose, drawer = false }: { onClose: () => void; drawer?: boolean }) {
  const plan = usePlan();
  const dock = useCoachDock();
  const [draft, setDraft] = useState(() => dock.seed);
  useEffect(() => { if (dock.seed) dock.takeSeed(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the box takes the keyboard the moment the panel appears, so typing that started in the bar carries on here
  useLayoutEffect(() => { const el = document.getElementById("coach-input") as HTMLInputElement | null; if (el && dock.seed) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // floating (every tab but Plan): where it sits and how big, moved by its header and sized by its corner grip
  const FKEY = "velocity.coach.float.v1";
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!drawer) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = 360, h = Math.max(360, vh - 88);
    let b = { x: vw - w - 16, y: 72, w, h };
    try { const v = JSON.parse(localStorage.getItem(FKEY) || "null"); if (v && v.w) b = v; } catch { /* storage off */ }
    const fit = (q: typeof b) => ({ w: Math.min(Math.max(300, q.w), vw - 16), h: Math.min(Math.max(320, q.h), vh - 16), x: Math.min(Math.max(8, q.x), vw - Math.min(Math.max(300, q.w), vw - 16) - 8), y: Math.min(Math.max(64, q.y), vh - 120) });
    setBox(fit(b));
    setTimeout(() => { const el = document.getElementById("coach-input") as HTMLInputElement | null; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 30);
  }, [drawer]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (b: { x: number; y: number; w: number; h: number }) => { try { localStorage.setItem(FKEY, JSON.stringify(b)); } catch { /* storage off */ } };
  const drag = (mode: "move" | "size") => (e: React.PointerEvent) => {
    if (!box || e.button !== 0 || (mode === "move" && (e.target as HTMLElement).closest("button, .menu"))) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, start = box, vw = window.innerWidth, vh = window.innerHeight;
    let last = start;
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      last = mode === "move"
        ? { ...start, x: Math.min(Math.max(8, start.x + dx), vw - start.w - 8), y: Math.min(Math.max(64, start.y + dy), vh - 120) }
        : { ...start, w: Math.min(Math.max(300, start.w + dx), vw - start.x - 8), h: Math.min(Math.max(320, start.h + dy), vh - start.y - 8) };
      setBox(last);
    };
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); document.body.classList.remove("coach-moving"); save(last); };
    document.body.classList.add("coach-moving");
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  };
  const [menu, setMenu] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const day = ymd(today());
  const msgs = plan.thread.filter((m) => m.day === day && m.who !== "action");
  useEffect(() => { const box = endRef.current?.parentElement; if (box) box.scrollTop = box.scrollHeight; }, [msgs.length, plan.busy]);
  function send(text = draft) {
    const t = text.trim();
    if (!t || plan.busy) return;
    void plan.post(t);
    setDraft("");
  }
  const name = (id?: string) => { const f = plan.findSession(id ?? null); return f ? `${f.s.title} ${dateLabel(f.s.date)}${f.s.start ? ` ${f.s.start}` : ""}` : "session"; };
  return (
    <aside className={`coach${drawer ? " drawer float" : ""}`} aria-label="Coach" style={drawer && box ? { left: box.x, top: box.y, width: box.w, height: box.h } : undefined}>
      <div className="head" onPointerDown={drawer ? drag("move") : undefined} title={drawer ? "Drag to move" : undefined}>
        <span className="eyebrow">Coach<span className="at">today</span></span>
        <span className="coach-tools">
          {plan.coachOn && plan.hasPlan && <button type="button" className="coach-ic wide" title="The whole remaining plan checked against your recent training; comes back as one proposal" disabled={plan.busy} onClick={() => void plan.reviewPlan()}>Review my plan</button>}
          {!plan.accounts && (
            <span style={{ position: "relative" }}>
              <button type="button" className="coach-ic" aria-label="Coach options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="kebab" /></button>
              {menu && (
                <div className="menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { plan.reset(); setMenu(false); }}>Erase changes saved on this device ({plan.changes})</button>
                </div>
              )}
            </span>
          )}
          <button type="button" className="coach-ic" aria-label="Close coach" title="Close" onClick={onClose}><Icon name="close" /></button>
        </span>
      </div>
      <div className="msgs" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={m.id ?? i} className={`msg ${m.who === "You" ? "user" : "coach-msg"}`}>
            <span className="who">{m.who} {m.at && <span style={{ marginLeft: 6 }}>{m.at}</span>}</span>
            {m.who === "Coach" ? <CoachText text={m.text} /> : m.text}
            {m.proposal && m.proposal.kind === "review" && (
              <div className={`proposal review ${m.status ?? "open"}`}>
                <div className="p-head">{m.status === "accepted" ? "Full plan review run" : m.status === "declined" ? "Review not run" : "Pitch: full plan review"}</div>
                <p>{m.proposal.summary}</p>
                {m.proposal.reason && <p className="muted small">{m.proposal.reason}</p>}
                {m.status === "open" && m.id && (
                  <div className="p-actions">
                    <button type="button" className="btn small" disabled={plan.busy} onClick={() => void plan.decideProposal(m.id!, "accepted")}>Run the full review</button>
                    <button type="button" className="btn small ghost" disabled={plan.busy} onClick={() => void plan.decideProposal(m.id!, "declined")}>Not now</button>
                  </div>
                )}
              </div>
            )}
            {m.proposal?.kind === "meals" && m.proposal.meals?.map((f, j) => (
              <div key={j} className="coach-meal">
                {f.library_id ? <img src={mealPhoto(f.library_id)} width={44} height={44} alt="" /> : <span className="coach-meal-ic"><Icon name="fork" /></span>}
                <div><b>{f.name}</b><span>{MEAL_LABEL[f.meal]}, {f.date === day ? "today" : dateLabel(f.date)}{f.servings && f.servings !== 1 ? `, ${f.servings} servings` : ""}</span><span>{f.kcal} kcal, {f.carbs_g} g carbs, {f.protein_g} g protein</span></div>
                <em>Logged</em>
              </div>
            ))}
            {m.proposal && m.proposal.kind !== "review" && m.proposal.kind !== "meals" && (
              <div className={`proposal ${m.status ?? "open"}`}>
                <div className="p-head">{m.status === "accepted" ? "Applied to the plan" : m.status === "declined" ? "Declined" : m.tier === "strong" || m.proposal.changes.length > 6 ? "Full plan review, proposed changes" : "Proposed change"}</div>
                <b>{m.proposal.summary}</b>
                <ul>{m.proposal.changes.map((c, j) => <li key={j}>{changeLine(c, name)}</li>)}</ul>
                {m.proposal.reason && <p className="muted small">{m.proposal.reason}</p>}
                {m.status === "open" && m.id && (
                  <div className="p-actions">
                    <button type="button" className="btn small" onClick={() => void plan.decideProposal(m.id!, "accepted")}>Accept</button>
                    <button type="button" className="btn small ghost" onClick={() => void plan.decideProposal(m.id!, "declined")}>Decline</button>
                  </div>
                )}
              </div>
            )}
            {m.sources && m.sources.length > 0 && (
              <ol className="sources">{m.sources.map((c) => <li key={c.n} value={c.n}>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> : c.title}<span className="muted">, {c.source}</span></li>)}</ol>
            )}
          </div>
        ))}
        {plan.busy && <div className="msg coach-msg thinking" aria-label="The coach is answering"><span /><span /><span />{plan.reviewing && <em>Reading the whole plan, up to a minute</em>}</div>}
        {msgs.length === 0 && !plan.busy && (
          <div className="coach-empty">
            <p className="muted small">{plan.coachOn ? "Answers come from your plan, your activities and your body data. Plan changes are proposed; you accept or decline." : "Ask about today's session, this week, moving a session or the race."}</p>
            <div className="chips">{SUGGEST.map((q) => <button key={q} type="button" className="chip" onClick={() => send(q)}>{q}</button>)}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input id="coach-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask your coach…" aria-label="Message your coach" disabled={plan.busy} />
        <button className="send" type="submit" aria-label="Send" disabled={plan.busy}><span style={{ width: 18, height: 18, display: "inline-flex" }}><Icon name="arrow" /></span></button>
      </form>
      {drawer && <span className="coach-grip" onPointerDown={drag("size")} aria-label="Resize the coach" role="separator" title="Drag to resize" />}
    </aside>
  );
}
