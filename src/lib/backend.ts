"use client";
// Where an athlete's data lives. Two homes, one shape:
//  - LocalBackend: no accounts. PR's seed plan + activities, with every change saved in this browser.
//  - SupabaseBackend: accounts on. Each user's rows in the database, nothing shared between users.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Intake } from "./plan/intake";
import type { Availability } from "./data";
import { ACTIVITIES as SEED_ACTIVITIES, PLAN_SEED, SPORT_LABEL, type Activity, type PlanWeekJson, type Sport } from "./data";
import { BODY_SEED, type BodyDay } from "./analysis";
import type { Profile, Race } from "./athlete";
import { supabase } from "./supabase/client";

export interface SessionPatch { date?: string; start?: string; min?: number; intensity?: string; text?: string; sport?: Sport; deleted?: boolean; locked?: boolean }
export interface AddedSession { id: string; date: string; start?: string; min: number; sport: Sport; intensity: string; text: string }
export interface ThreadMsg { who: "You" | "Coach" | "action"; at: string; text: string }
export interface PlanStateJson { patches: Record<string, SessionPatch>; added: AddedSession[]; undone: boolean; calendar: boolean }
export interface UserData { profile: Profile | null; race: Race | null; plan: PlanWeekJson[]; intake: Intake | null; state: PlanStateJson; activities: Activity[]; body: BodyDay[]; thread: ThreadMsg[]; availability?: Availability | null }

export const EMPTY_STATE: PlanStateJson = { patches: {}, added: [], undone: false, calendar: true };
export const EMPTY_DATA: UserData = { profile: null, race: null, plan: [], intake: null, state: EMPTY_STATE, activities: [], body: [], thread: [] };

export interface Backend {
  kind: "local" | "supabase";
  load(): Promise<UserData>;
  saveState(state: PlanStateJson): Promise<void>;
  upsertActivity(a: Activity): Promise<void>;
  deleteActivity(id: string): Promise<void>;
  setExcluded(id: string, excluded: boolean): Promise<void>;
  appendThread(msgs: ThreadMsg[]): Promise<void>;
  saveProfile(p: Partial<Profile>): Promise<void>;
  saveRace(r: Race | null): Promise<void>;
  savePlan(weeks: PlanWeekJson[], intake?: Intake | null): Promise<void>;
  saveBody(rows: BodyDay[]): Promise<void>;
  replaceActivities(rows: Activity[]): Promise<void>;
  reset(): Promise<void>;
  signOut(): Promise<void>;
}

// ====================================================================================
// Local (browser) — the format the app has used so far, kept so PR's changes survive
// ====================================================================================
const KEY = "velocity.store.v1";
export interface LocalState extends PlanStateJson { manual: Activity[]; hidden: string[]; excluded: string[]; thread: ThreadMsg[]; plan?: PlanWeekJson[] | null; intake?: Intake | null; race?: Race | null; availability?: Availability | null; profile?: Partial<Profile> | null }
const EMPTY_LOCAL: LocalState = { ...EMPTY_STATE, manual: [], hidden: [], excluded: [], thread: [] };

export function readLocal(): LocalState {
  try {
    const raw = localStorage.getItem(KEY);
    const s: LocalState = raw ? { ...EMPTY_LOCAL, ...JSON.parse(raw) } : { ...EMPTY_LOCAL };
    const legacy = JSON.parse(localStorage.getItem("velocity.manualActivities") || "[]") as Activity[];
    for (const a of legacy) if (!s.manual.some((m) => m.id === a.id)) s.manual.push(a);
    return s;
  } catch { return { ...EMPTY_LOCAL }; }
}
function writeLocal(s: LocalState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

/** Seed activities + browser changes, as one list (deleted ones gone, excluded ones flagged). */
export function localActivities(s: LocalState): Activity[] {
  const hidden = new Set(s.hidden), excluded = new Set(s.excluded);
  return [...SEED_ACTIVITIES, ...s.manual].filter((a) => !hidden.has(a.id)).map((a) => ({ ...a, excluded: excluded.has(a.id) || undefined }));
}

export class LocalBackend implements Backend {
  kind = "local" as const;
  private s: LocalState = { ...EMPTY_LOCAL };
  async load(): Promise<UserData> {
    this.s = readLocal();
    // development only: `localStorage.setItem("velocity.demo","empty")` shows the app as a brand-new account sees it
    let demo = "";
    try { demo = localStorage.getItem("velocity.demo") ?? ""; } catch { /* ignore */ }
    if (demo === "empty") {
      const created = new Date().toISOString();
      const profile: Profile = { id: "demo", email: "new@example.com", username: "newathlete", name: "New Athlete", avatar_url: null, units: "imperial", timezone: "America/Los_Angeles", city: null, availability: null, zones: null, is_admin: false, setup_done: true, created_at: created };
      return { profile: { ...profile, ...(this.s.profile ?? {}), availability: this.s.availability ?? null }, race: this.s.race ?? null, plan: this.s.plan ?? [], intake: this.s.intake ?? null, state: { patches: this.s.patches, added: this.s.added, undone: false, calendar: true }, activities: this.s.manual, body: [], thread: this.s.thread };
    }
    // a plan built or imported in this browser replaces the seed plan (and its race) until "clear local changes"
    // a profile saved in this browser (set-up screen) replaces the seed athlete's name, units and city
    const saved = this.s.profile && Object.keys(this.s.profile).length ? { id: "local", email: null, username: "", name: "", avatar_url: null, units: "imperial" as const, timezone: "America/Los_Angeles", city: null, availability: this.s.availability ?? null, zones: null, is_admin: false, setup_done: true, created_at: new Date().toISOString(), ...this.s.profile } as Profile : null;
    return { profile: saved, race: this.s.race ?? null, plan: this.s.plan ?? PLAN_SEED, intake: this.s.intake ?? null, state: { patches: this.s.patches, added: this.s.added, undone: this.s.undone, calendar: this.s.calendar }, activities: localActivities(this.s), body: BODY_SEED, thread: this.s.thread, availability: this.s.availability ?? null };
  }
  private put(next: Partial<LocalState>) { this.s = { ...this.s, ...next }; writeLocal(this.s); }
  async saveState(state: PlanStateJson) { this.put(state); }
  async upsertActivity(a: Activity) { this.put({ manual: [...this.s.manual.filter((m) => m.id !== a.id), a] }); }
  async deleteActivity(id: string) {
    const isManual = this.s.manual.some((m) => m.id === id);
    this.put({ manual: this.s.manual.filter((m) => m.id !== id), hidden: isManual || this.s.hidden.includes(id) ? this.s.hidden : [...this.s.hidden, id], excluded: this.s.excluded.filter((x) => x !== id) });
  }
  async setExcluded(id: string, excluded: boolean) { this.put({ excluded: excluded ? [...new Set([...this.s.excluded, id])] : this.s.excluded.filter((x) => x !== id) }); }
  async appendThread(msgs: ThreadMsg[]) { this.put({ thread: [...this.s.thread, ...msgs] }); }
  async saveProfile(p: Partial<Profile>) {
    const { availability, ...rest } = p;
    this.put({ ...(availability !== undefined ? { availability } : {}), ...(Object.keys(rest).length ? { profile: { ...(this.s.profile ?? {}), ...rest } } : {}) });
  }
  async saveRace(r: Race | null) { this.put({ race: r }); }
  async savePlan(weeks: PlanWeekJson[], intake?: Intake | null) { this.put({ plan: weeks, ...(intake !== undefined ? { intake } : {}) }); }
  async saveBody() { /* seed only */ }
  async replaceActivities() { /* seed only */ }
  async reset() { this.s = { ...EMPTY_LOCAL }; writeLocal(this.s); }
  async signOut() { /* nothing to sign out of */ }
}

// ====================================================================================
// Supabase — one user's rows
// ====================================================================================
type Row = Record<string, unknown>;
function rowToActivity(r: Row): Activity {
  const num = (k: string) => (r[k] == null ? undefined : Number(r[k]));
  return {
    id: String(r.id), date: String(r.date), start: (r.start as string) || undefined, sport: r.sport as Sport, name: String(r.name ?? SPORT_LABEL[r.sport as Sport] ?? "Session"), min: Number(r.min),
    mi: num("mi"), yd: num("yd"), pace_s: num("pace_s"), mph: num("mph"), p100_s: num("p100_s"), hr: num("hr"), elev_ft: num("elev_ft"),
    route: (r.route as [number, number][]) ?? undefined, source: (r.source as Activity["source"]) ?? "manual", note: (r.note as string) ?? undefined, exertion: num("exertion"),
    coachNote: (r.coach_note as string) ?? undefined, excluded: r.excluded ? true : undefined,
  };
}
function activityToRow(userId: string, a: Activity): Row {
  return {
    user_id: userId, id: a.id, date: a.date, start: a.start ?? null, sport: a.sport, name: a.name, min: a.min,
    mi: a.mi ?? null, yd: a.yd ?? null, pace_s: a.pace_s ?? null, mph: a.mph ?? null, p100_s: a.p100_s ?? null, hr: a.hr ?? null, elev_ft: a.elev_ft ?? null,
    route: a.route ?? null, source: a.source, note: a.note ?? null, exertion: a.exertion ?? null, coach_note: a.coachNote ?? null, excluded: !!a.excluded,
  };
}

export class SupabaseBackend implements Backend {
  kind = "supabase" as const;
  private sb: SupabaseClient;
  private uid = "";
  constructor(client: SupabaseClient) { this.sb = client; }
  private async user() { if (this.uid) return this.uid; const { data } = await this.sb.auth.getUser(); this.uid = data.user?.id ?? ""; return this.uid; }
  async load(): Promise<UserData> {
    const uid = await this.user();
    if (!uid) return EMPTY_DATA;
    const [profile, race, plan, state, acts, body, thread] = await Promise.all([
      this.sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      this.sb.from("races").select("*").eq("user_id", uid).maybeSingle(),
      this.sb.from("plans").select("weeks, intake").eq("user_id", uid).maybeSingle(),
      this.sb.from("plan_state").select("*").eq("user_id", uid).maybeSingle(),
      this.sb.from("activities").select("*").eq("user_id", uid).order("date").order("start"),
      this.sb.from("body_metrics").select("*").eq("user_id", uid).order("date"),
      this.sb.from("coach_messages").select("who, at, text").eq("user_id", uid).order("id"),
    ]);
    void this.sb.rpc("touch_profile");
    const st = state.data as Row | null;
    return {
      profile: (profile.data as Profile | null) ?? null,
      race: (race.data as Race | null) ?? null,
      plan: ((plan.data as { weeks?: PlanWeekJson[] } | null)?.weeks ?? []) as PlanWeekJson[],
      intake: ((plan.data as { intake?: Intake | null } | null)?.intake ?? null),
      state: st ? { patches: (st.patches as PlanStateJson["patches"]) ?? {}, added: (st.added as AddedSession[]) ?? [], undone: !!st.undone, calendar: st.calendar !== false } : EMPTY_STATE,
      activities: ((acts.data as Row[]) ?? []).map(rowToActivity),
      body: ((body.data as Row[]) ?? []).map((b) => ({ date: String(b.date), rhr: b.rhr as number, hrv: b.hrv as number, sleep_h: b.sleep_h == null ? undefined : Number(b.sleep_h), sleep_score: b.sleep_score as number, stress: b.stress as number, vo2: b.vo2 == null ? undefined : Number(b.vo2) })),
      thread: ((thread.data as Row[]) ?? []).map((m) => ({ who: m.who as ThreadMsg["who"], at: String(m.at ?? ""), text: String(m.text) })),
    };
  }
  private fail(where: string, error: { message: string } | null) { if (error) console.error(`[velocity] ${where}: ${error.message}`); }
  async saveState(state: PlanStateJson) { const uid = await this.user(); const { error } = await this.sb.from("plan_state").upsert({ user_id: uid, ...state, updated_at: new Date().toISOString() }); this.fail("saveState", error); }
  async upsertActivity(a: Activity) { const uid = await this.user(); const { error } = await this.sb.from("activities").upsert(activityToRow(uid, a)); this.fail("upsertActivity", error); }
  async deleteActivity(id: string) { const uid = await this.user(); const { error } = await this.sb.from("activities").delete().eq("user_id", uid).eq("id", id); this.fail("deleteActivity", error); }
  async setExcluded(id: string, excluded: boolean) { const uid = await this.user(); const { error } = await this.sb.from("activities").update({ excluded }).eq("user_id", uid).eq("id", id); this.fail("setExcluded", error); }
  async appendThread(msgs: ThreadMsg[]) { const uid = await this.user(); const { error } = await this.sb.from("coach_messages").insert(msgs.map((m) => ({ user_id: uid, ...m }))); this.fail("appendThread", error); }
  async saveProfile(p: Partial<Profile>) { const uid = await this.user(); const { data: u } = await this.sb.auth.getUser(); const { error } = await this.sb.from("profiles").upsert({ id: uid, email: u.user?.email ?? null, ...p }); this.fail("saveProfile", error); if (error) throw error; }
  async saveRace(r: Race | null) {
    const uid = await this.user();
    const { error } = r ? await this.sb.from("races").upsert({ user_id: uid, ...r, updated_at: new Date().toISOString() }) : await this.sb.from("races").delete().eq("user_id", uid);
    this.fail("saveRace", error); if (error) throw error;
  }
  async savePlan(weeks: PlanWeekJson[], intake?: Intake | null) {
    const uid = await this.user();
    const row: Row = { user_id: uid, weeks, updated_at: new Date().toISOString() };
    let { error } = await this.sb.from("plans").upsert(intake !== undefined ? { ...row, intake } : row);
    // until the `intake` column exists in the database, save the weeks alone rather than nothing
    if (error && intake !== undefined && /intake/i.test(error.message)) { console.warn("[velocity] plans.intake column missing — run supabase/schema.sql; saving weeks only"); ({ error } = await this.sb.from("plans").upsert(row)); }
    this.fail("savePlan", error); if (error) throw error;
  }
  async saveBody(rows: BodyDay[]) { const uid = await this.user(); if (!rows.length) return; const { error } = await this.sb.from("body_metrics").upsert(rows.map((b) => ({ user_id: uid, ...b }))); this.fail("saveBody", error); if (error) throw error; }
  async replaceActivities(rows: Activity[]) {
    const uid = await this.user();
    const del = await this.sb.from("activities").delete().eq("user_id", uid); this.fail("replaceActivities/delete", del.error);
    for (let i = 0; i < rows.length; i += 50) { const { error } = await this.sb.from("activities").upsert(rows.slice(i, i + 50).map((a) => activityToRow(uid, a))); this.fail("replaceActivities", error); if (error) throw error; }
  }
  async reset() {
    const uid = await this.user();
    await Promise.all([this.sb.from("plan_state").delete().eq("user_id", uid), this.sb.from("coach_messages").delete().eq("user_id", uid)]);
  }
  async signOut() { await this.sb.auth.signOut(); }
}

export function makeBackend(): Backend {
  const sb = supabase();
  return sb ? new SupabaseBackend(sb) : new LocalBackend();
}
