// Shapes shared by the coach route (server) and the app (browser).
import type { Sport } from "@/lib/data";

/** One change the coach proposes. The athlete accepts or declines the whole proposal. */
export interface PlanChange {
  kind: "move" | "edit" | "delete" | "add";
  /** Required for move / edit / delete: the session's id as listed in the context. */
  sessionId?: string;
  /** Filled in by the server: the session as it was when proposed, in the internal form "run · 2026-10-27 · 06:30" (the rail splits on " · " and never shows the dots). */
  from?: string;
  date?: string; // YYYY-MM-DD
  start?: string; // HH:MM
  min?: number;
  intensity?: string;
  sport?: Sport;
  text?: string;
}
export interface Proposal {
  summary: string;
  reason?: string;
  changes: PlanChange[];
  /** "review": a pitch for a whole-plan review; Accept runs it (no changes yet). Default: concrete changes. */
  kind?: "changes" | "review";
}
export type ProposalStatus = "open" | "accepted" | "declined";

export interface CoachRequest {
  /** The conversation so far, oldest first. Only today's messages are sent. */
  messages: { role: "user" | "assistant"; content: string }[];
  /** The athlete's data, compact. Built by buildCoachContext in the browser. */
  context: CoachContext;
  /** "restructure": review the whole remaining plan with the stronger model (context.plan_all must be filled). */
  mode?: "chat" | "restructure";
  /** The page the question was asked from (biases the library search). */
  page?: string;
}
export interface Citation { n: number; id: string; title: string; source: string; url: string | null }
export interface CoachReply {
  text: string;
  proposal?: Proposal;
  /** Passages the answer cited, in order of first use. */
  sources?: Citation[];
  capped?: boolean;
  model?: string;
  tier?: "fast" | "strong" | "none";
  /** The model thinks the whole plan needs reworking: the app shows a pitch card; Accept re-sends with mode "restructure". */
  needs?: "restructure";
  reason?: string;
}

export interface CoachContext {
  today: string; // YYYY-MM-DD, athlete's local date
  now: string; // HH:MM
  athlete: {
    name: string; units: "imperial" | "metric";
    race: { name: string; date: string; distance: string; goal: string } | null;
    lthr: number | null; ftp: number | null;
    zones: Record<string, Record<string, string>>;
    availability: { days: number[]; weekday_am: string; weekday_pm: string; weekend: string };
  };
  plan: { phase: string; week: number; weeks: number; start: string; end: string } | null;
  /** This week and next week: every session with its id, so changes can refer to them. */
  sessions: { id: string; date: string; start?: string; sport: Sport; intensity: string; min: number; text: string; status: string; locked?: boolean; actual?: string }[];
  /** Restructure mode only: every remaining week of the plan, compact. */
  plan_all?: { week: number; start: string; phase: string; recovery?: boolean; race?: boolean; sessions: { id: string; date: string; start?: string; sport: Sport; intensity: string; min: number; text: string; status: string; locked?: boolean }[] }[];
  /** The last 14 days, oldest first. */
  activities: { date: string; start?: string; sport: Sport; name: string; min: number; dist?: string; pace?: string; hr?: number; exertion?: number; note?: string }[];
  /** The last four weeks: planned vs done hours and sessions. */
  weeks: { week: number; start: string; phase: string; plannedH: number; doneH: number; sessions: string; longest: { bike?: number; run?: number; swim?: number } }[];
  body: { date: string; rhr?: number; hrv?: number; sleep_h?: number; sleep_score?: number; vo2?: number } | null;
}
