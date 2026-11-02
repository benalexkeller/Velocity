// The Admin page's data: database functions in supabase/schema-admin.sql (each refuses anyone but the admin) and one
// server route for deleting an account. Account facts and counts only, never an athlete's own data.
import { supabase } from "@/lib/supabase/client";

/** Membership: what an athlete has. "plan" is the training plan, so the word for this is membership. */
export type Membership = "free" | "trial" | "pro" | "free_pro" | "ended";
export const MEMBERSHIP: Record<Membership, string> = { free: "Free", trial: "Trial", pro: "Pro", free_pro: "Free Pro", ended: "Ended" };
export const MEMBERSHIP_NOTE: Record<Membership, string> = {
  free: "No membership.",
  trial: "Free trial with an end date.",
  pro: "Pays through Stripe.",
  free_pro: "Pro given for free by the admin.",
  ended: "A trial or Free Pro that has run out.",
};

export interface AdminUser {
  id: string; email: string | null; username: string | null; name: string | null;
  created_at: string; last_seen: string | null; setup_done: boolean;
  race: string | null; race_date: string | null; activities: number; plan_weeks: number | null;
  signin: string; watch: string | null; calendar: boolean; coach_30: number;
  /** "Google", "Outlook", "Apple": connected calendars */
  calendars: string[];
  access: Membership; access_kind: "trial" | "comp" | "paid" | null; access_ends: string | null; access_note: string | null;
  disabled: boolean; is_admin: boolean;
}
export interface Overview {
  users: number; new_7: number; new_30: number; active_1: number; active_7: number; active_30: number;
  setup_done: number; has_plan: number; has_activity: number; watch: number; calendar: number; coach_users_30: number;
  /** athletes with Outlook, with Apple Calendar (0 until schema-calendar-accounts.sql has been run) */
  outlook: number; apple: number;
  google_signin: number; disabled: number; trial: number; pro: number; free_pro: number;
  deleted_30: number; deleted_all: number; coach_cost_30: number; signups: { week: string; n: number }[];
}
export interface CoachUsage {
  since: string;
  daily: { day: string; questions: number; athletes: number; cost: number }[];
  models: { model: string; tier: string; requests: number; tokens_in: number; tokens_out: number; cost: number }[];
  athletes: { id: string; who: string; questions: number; cost: number; capped_days: number }[];
  failed: number; capped: number; logged_from: string | null;
}
export interface AuditEntry { id: number; created_at: string; admin: string | null; user_id: string | null; athlete: string | null; action: string; detail: string | null }

const SETUP = "Run supabase/schema-admin.sql in Supabase (SQL Editor) to turn this on.";
function plain(msg: string) {
  if (/schema cache|does not exist|Could not find the function/i.test(msg)) return SETUP;
  if (/not allowed/i.test(msg)) return "Only the admin account can do this.";
  return msg;
}
async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const sb = supabase();
  if (!sb) throw new Error("Accounts are not on for this site.");
  const { data, error } = await sb.rpc(name, args);
  if (error) throw new Error(plain(error.message));
  return data as T;
}
/** Outlook and Apple connections per athlete; empty until supabase/schema-calendar-accounts.sql has been run. */
async function otherCalendars(): Promise<Map<string, string[]>> {
  try { return new Map(((await rpc<{ user_id: string; providers: string[] }[]>("admin_calendar_providers")) ?? []).map((r) => [r.user_id, r.providers ?? []])); }
  catch { return new Map(); }
}
/** numeric columns arrive as strings from some Postgres types; make them numbers */
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

export const adminApi = {
  async overview() {
    const [r, other] = await Promise.all([rpc<Overview | null>("admin_overview"), otherCalendars()]);
    if (!r) throw new Error("Only the admin account can see this.");
    const count = (p: string) => [...other.values()].filter((l) => l.includes(p)).length;
    return { ...r, coach_cost_30: num(r.coach_cost_30), signups: r.signups ?? [], outlook: count("outlook"), apple: count("apple") };
  },
  async users() {
    const [r, other] = await Promise.all([rpc<Omit<AdminUser, "calendars">[]>("admin_users"), otherCalendars()]);
    return (r ?? []).map((u) => ({ ...u, calendars: [...(u.calendar ? ["Google"] : []), ...(other.get(u.id) ?? []).map((p) => (p === "outlook" ? "Outlook" : "Apple"))] }));
  },
  /** kind: "free" removes the membership; "trial" and "comp" (Free Pro) need no end date */
  setAccess: (user: string, kind: "free" | "trial" | "comp", ends: string | null, note: string) =>
    rpc<void>("admin_set_access", { p_user: user, p_kind: kind, p_ends: ends, p_note: note }),
  setDisabled: (user: string, disabled: boolean) => rpc<void>("admin_set_disabled", { p_user: user, p_disabled: disabled }),
  audit: (n = 200) => rpc<AuditEntry[]>("admin_audit_log", { n }).then((r) => r ?? []),
  async coach(days: number) {
    const r = await rpc<CoachUsage | null>("admin_coach_usage", { days });
    if (!r) throw new Error("Only the admin account can see this.");
    return {
      ...r,
      daily: (r.daily ?? []).map((d) => ({ ...d, questions: num(d.questions), athletes: num(d.athletes), cost: num(d.cost) })),
      models: (r.models ?? []).map((m) => ({ ...m, requests: num(m.requests), tokens_in: num(m.tokens_in), tokens_out: num(m.tokens_out), cost: num(m.cost) })),
      athletes: (r.athletes ?? []).map((a) => ({ ...a, questions: num(a.questions), cost: num(a.cost), capped_days: num(a.capped_days) })),
      failed: num(r.failed), capped: num(r.capped),
    };
  },
  /** Same clean-up as Delete my account (calendars, Garmin), then the account with everything in it. */
  async deleteUser(user: string, reason: string) {
    const res = await fetch("/api/admin/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, reason }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "The account was not deleted.");
  },
  /** The same email as Forgot password on the sign-in page. */
  async sendReset(email: string) {
    const sb = supabase();
    if (!sb) throw new Error("Accounts are not on for this site.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` });
    if (error) throw new Error(/not authorized/i.test(error.message) ? "Supabase's built-in email only reaches the project team's addresses. Reset emails reach athletes once an email sender is set up." : error.message);
  },
};

/** The signed-in athlete's own membership (Profile). Free when there is no row or the table is not there yet. */
export async function myMembership(): Promise<{ status: Membership; ends: string | null }> {
  const sb = supabase();
  if (!sb) return { status: "free", ends: null };
  const { data, error } = await sb.from("access").select("kind, ends_at").maybeSingle();
  if (error || !data) return { status: "free", ends: null };
  const ends = (data.ends_at as string | null) ?? null;
  if (ends && new Date(ends) <= new Date()) return { status: "ended", ends };
  const kind = data.kind as string;
  return { status: kind === "paid" ? "pro" : kind === "comp" ? "free_pro" : "trial", ends };
}
