"use client";
// Beta feedback: what the athlete says about the app, with the page it was said on. Rows go to Supabase
// (table `feedback`, own rows only; the admin reads everything through `admin_feedback`). In local mode they
// stay in this browser.
import { supabase } from "./supabase/client";

export const FEEDBACK_TABS: { k: string; label: string }[] = [
  { k: "general", label: "General" }, { k: "dashboard", label: "Dashboard" }, { k: "plan", label: "Plan" }, { k: "activities", label: "Activities" },
  { k: "analysis", label: "Analysis" }, { k: "nutrition", label: "Nutrition" }, { k: "store", label: "Store" }, { k: "calculator", label: "Calculator" }, { k: "account", label: "Account / sign-in" },
];
export const FEEDBACK_KINDS: { k: string; label: string; hint: string }[] = [
  { k: "bug", label: "Something is broken", hint: "What you did, what happened, what you expected." },
  { k: "confusing", label: "Something is confusing", hint: "What you were trying to do and where it lost you." },
  { k: "idea", label: "Idea or request", hint: "What should it do, and when would you use it?" },
  { k: "data", label: "A number looks wrong", hint: "Which number, where, and what it should be." },
  { k: "other", label: "Other", hint: "" },
];

export interface FeedbackEntry { id: number; user_id: string | null; email: string | null; username: string | null; tab: string; kind: string; message: string; page: string | null; ua: string | null; viewport: string | null; status: "open" | "done"; created_at: string }
export type NewFeedback = Pick<FeedbackEntry, "tab" | "kind" | "message" | "page"> & { email?: string | null; username?: string | null };

const KEY = "velocity.feedback.v1";
const readLocal = (): FeedbackEntry[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const writeLocal = (rows: FeedbackEntry[]) => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* ignore */ } };

export function tabForPath(path: string) { const seg = path.split("/")[1] || "general"; return FEEDBACK_TABS.some((t) => t.k === seg) ? seg : seg === "profile" || seg === "login" || seg === "setup" ? "account" : "general"; }

/** Save one entry. Resolves when it is stored; throws with a plain message if not. */
export async function submitFeedback(f: NewFeedback): Promise<void> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null;
  const viewport = typeof window !== "undefined" ? `${window.innerWidth}×${window.innerHeight}` : null;
  const sb = supabase();
  if (!sb) {
    const rows = readLocal();
    rows.unshift({ id: Date.now(), user_id: null, email: f.email ?? null, username: f.username ?? null, tab: f.tab, kind: f.kind, message: f.message, page: f.page, ua, viewport, status: "open", created_at: new Date().toISOString() });
    writeLocal(rows);
    return;
  }
  const { data: u } = await sb.auth.getUser();
  const { error } = await sb.from("feedback").insert({ user_id: u.user?.id ?? null, email: f.email ?? u.user?.email ?? null, username: f.username ?? null, tab: f.tab, kind: f.kind, message: f.message, page: f.page, ua, viewport });
  if (error) throw new Error(/relation .* does not exist/i.test(error.message) ? "The feedback table is not set up yet (run the schema SQL)." : error.message);
}

/** Admin: every entry, newest first. Local mode: this browser's entries. */
export async function listFeedback(): Promise<FeedbackEntry[]> {
  const sb = supabase();
  if (!sb) return readLocal();
  const { data, error } = await sb.rpc("admin_feedback");
  if (error) throw new Error(error.message);
  return (data as FeedbackEntry[]) ?? [];
}
export async function setFeedbackStatus(id: number, status: "open" | "done"): Promise<void> {
  const sb = supabase();
  if (!sb) { writeLocal(readLocal().map((r) => (r.id === id ? { ...r, status } : r))); return; }
  const { error } = await sb.rpc("admin_feedback_status", { fid: id, s: status });
  if (error) throw new Error(error.message);
}
