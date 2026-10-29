// POST /api/coach — the coach answers one question. The browser sends today's conversation and the athlete's
// data (see src/lib/coach/context.ts); this route runs the fixed safety check, finds the relevant library
// passages, adds the instructions, calls the model through OpenRouter and returns the answer, its sources and
// any proposed plan change. The model key never reaches the browser.
//
// The coach works across several models (src/lib/coach/models.ts): everyday questions go to the fast list
// (DeepSeek first), a whole-plan review (mode "restructure", run only after the athlete accepts a pitch card) to
// the strong list (newest Claude, then GPT, then Gemini). OpenRouter tries each list in order, so a model that is
// down never stops the coach. COACH_DAILY_CAP: questions per athlete per day (default 40).
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { LOG_MEAL_TOOL, RESTRUCTURE_PROMPT, RESTRUCTURE_TOOL, SYSTEM_PROMPT, TOOLS, contextMessage } from "@/lib/coach/prompt";
import { MEAL_LIBRARY, mealMacros } from "@/lib/nutrition/meals";
import { coachModels } from "@/lib/coach/models";
import { PASSAGES } from "@/lib/coach/library-data";
import { referenceBlock, searchLibrary, usedCitations, type Passage } from "@/lib/coach/library";
import { RED_FLAG_REPLY, redFlag } from "@/lib/coach/safety";
import type { CoachContext, CoachReply, CoachRequest, MealLogItem, PlanChange, Proposal } from "@/lib/coach/types";

export const runtime = "nodejs";
// a whole-plan review sends the full remaining plan to the model and can take well over the 10 s default; Vercel allows 60 s here
export const maxDuration = 60;
const CAP = Number(process.env.COACH_DAILY_CAP || 40);
const KEY = process.env.OPENROUTER_API_KEY || "";
const BASE = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
/** Plan actions need no library passages. */
const ACTION = /\b(move|swap|reschedule|shift|delete|remove|lock|unlock|undo|add a|log)\b/i;

type Msg = { role: string; content: string };
type ModelOut = { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] };

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "coach_off" }, { status: 503 });
  let body: CoachRequest;
  try { body = (await req.json()) as CoachRequest; } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!body?.context || !Array.isArray(body.messages) || !body.messages.length) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const question = String(body.messages[body.messages.length - 1]?.content ?? "");

  // 1. fixed safety check: no model involved
  const flag = redFlag(question);
  if (flag) return NextResponse.json({ text: RED_FLAG_REPLY[flag], tier: "none" } satisfies CoachReply);

  // 2. who is asking: a signed-in athlete (accounts mode) — or anyone, in local development
  let uid: string | null = null;
  let extra: Passage[] = [];
  if (ACCOUNTS_ON) {
    const sb = await supabaseServer();
    const { data } = await sb!.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
    uid = data.user.id;
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await sb!.from("coach_messages").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("who", "You").gte("created_at", since.toISOString());
    if ((count ?? 0) >= CAP) return NextResponse.json({ text: `Daily limit reached (${CAP} questions). The coach answers again tomorrow.`, capped: true, tier: "none" } satisfies CoachReply);
    // passages the admin added or changed in the database (same shape as the bundled ones; a row overrides its bundled id)
    const { data: rows } = await sb!.from("library").select("id, title, topic, grade, tags, body, source, url").eq("published", true);
    extra = ((rows as Passage[] | null) ?? []);
  }
  const passages = [...PASSAGES.filter((p) => !extra.some((e) => e.id === p.id)), ...extra];

  const ctx = body.context;
  const restructure = body.mode === "restructure";
  const history = body.messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  // 3. the library: the passages this question needs (none for plain plan actions)
  const sport = /\b(swim|bike|run)\b/i.exec(question)?.[1]?.toLowerCase() ?? null;
  const found = restructure ? searchLibrary("long ride long run progression missed week 10 percent step recovery week taper", passages, 4) : ACTION.test(question) && question.length < 80 ? [] : searchLibrary(question, passages, 4, { sport });
  const refs = referenceBlock(found);

  const messages: Msg[] = restructure
    ? [{ role: "system", content: RESTRUCTURE_PROMPT }, { role: "system", content: contextMessage(trimContext(ctx, true)) }, ...(refs.text ? [{ role: "system", content: `Reference passages:\n${refs.text}` }] : []), ...history]
    : [{ role: "system", content: SYSTEM_PROMPT }, { role: "system", content: contextMessage(trimContext(ctx, false)) }, ...(refs.text ? [{ role: "system", content: `Reference passages:\n${refs.text}` }] : []), ...history];

  const models = restructure ? coachModels().strong : coachModels().fast;
  const res = await callModel(models, messages, restructure ? TOOLS : [...TOOLS, RESTRUCTURE_TOOL, LOG_MEAL_TOOL], restructure ? 1800 : 700, restructure ? 55_000 : 30_000);
  if (!res) return NextResponse.json({ error: "upstream" }, { status: 502 });
  const { out, model } = res;

  let text = (out.content ?? "").trim();
  let proposal: Proposal | undefined;
  const meals: MealLogItem[] = [];
  for (const call of out.tool_calls ?? []) {
    if (call.function?.name === "log_meal" && !restructure) {
      try { meals.push(...validateMeals(JSON.parse(call.function.arguments || "{}"), ctx.today)); } catch { /* nothing logged */ }
      continue;
    }
    if (call.function?.name === "request_restructure" && !restructure) {
      let pitch = "", reason = "";
      try { const a = JSON.parse(call.function.arguments || "{}") as { pitch?: string; reason?: string }; pitch = String(a.pitch ?? ""); reason = String(a.reason ?? ""); } catch { /* no pitch */ }
      // a pitch card: no changes yet; Accept runs the full review
      const review: Proposal = { kind: "review", summary: (pitch || text || "The whole remaining plan needs a review.").slice(0, 600), reason: reason.slice(0, 300), changes: [] };
      return NextResponse.json({ text: text || "More than the next two weeks need to change.", proposal: review, needs: "restructure", tier: "fast", model } satisfies CoachReply);
    }
    if (call.function?.name !== "propose_plan_change" || proposal) continue; // one proposal per answer
    try { proposal = validateProposal(JSON.parse(call.function.arguments || "{}"), ctx, restructure); } catch { proposal = undefined; }
  }
  if (!text) text = proposal ? proposal.summary : meals.length ? `Logged ${meals.map((m) => m.name.toLowerCase()).join(" and ")}.` : "No answer. Ask again in other words.";
  const sources = usedCitations(text, refs.citations);
  return NextResponse.json({ text, proposal, meals: meals.length ? meals : undefined, sources: sources.length ? sources : undefined, model, tier: restructure ? "strong" : "fast" } satisfies CoachReply);
}

/** One request to OpenRouter with the whole model list: the first answers, the rest stand in when it fails.
 *  If OpenRouter rejects the list itself (an unknown id in an override), the first model is tried alone.
 *  Returns the answer and the model that actually gave it. */
async function callModel(models: string[], messages: Msg[], tools: unknown[], maxTokens: number, timeoutMs: number): Promise<{ out: ModelOut; model: string } | null> {
  const send = async (list: string[]) => {
    try {
      return await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://velocityathletes.com", "X-Title": "Velocity coach" },
        body: JSON.stringify({ model: list[0], ...(list.length > 1 ? { models: list } : {}), messages, tools, tool_choice: "auto", max_tokens: maxTokens, temperature: 0.3 }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) { console.error("[coach] fetch", e); return null; }
  };
  let res = await send(models);
  if (res && res.status === 400 && models.length > 1) { console.error("[coach] openrouter rejected the model list", (await res.text()).slice(0, 300)); res = await send(models.slice(0, 1)); }
  if (!res) return null;
  if (!res.ok) { console.error("[coach] openrouter", models[0], res.status, (await res.text()).slice(0, 500)); return null; }
  const data = (await res.json()) as { model?: string; choices?: { message?: ModelOut }[] };
  const out = data.choices?.[0]?.message;
  return out ? { out, model: data.model ?? models[0] } : null;
}

/** Keeps the request small whatever the browser sends; the whole plan goes only in restructure mode. */
function trimContext(c: CoachContext, whole: boolean): CoachContext {
  const base = { ...c, sessions: c.sessions.slice(0, 40), activities: c.activities.slice(-40), weeks: c.weeks.slice(-6) };
  if (!whole) { delete base.plan_all; return base; }
  return { ...base, plan_all: (c.plan_all ?? []).slice(0, 40) };
}

/** Food the model logged: library meals get the library's own name and macros, the rest are kept within sane bounds.
 *  Dates more than a week from today are dropped. */
function validateMeals(raw: unknown, todayYmd: string): MealLogItem[] {
  const items = (raw as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) return [];
  const t = Date.parse(todayYmd);
  const num = (x: unknown, max: number) => { const n = Number(x); return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0; };
  const out: MealLogItem[] = [];
  for (const it of items.slice(0, 8) as Record<string, unknown>[]) {
    const date = typeof it?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : todayYmd;
    if (Math.abs(Date.parse(date) - t) > 7 * 86400000) continue;
    const meal = (["breakfast", "lunch", "dinner", "other"] as const).find((m) => m === it.meal) ?? "other";
    const lib = typeof it.library_id === "string" ? MEAL_LIBRARY.find((m) => m.id === it.library_id) : undefined;
    if (lib) {
      const servings = Math.min(4, Math.max(0.5, Math.round((Number(it.servings) || 1) * 2) / 2));
      const x = mealMacros(lib);
      out.push({ date, meal, name: lib.name, library_id: lib.id, servings, kcal: Math.round(x.kcal * servings), carbs_g: Math.round(x.carbs * servings), protein_g: Math.round(x.protein * servings), fat_g: Math.round(x.fat * servings) });
      continue;
    }
    const name = typeof it.name === "string" ? it.name.trim().slice(0, 80) : "";
    const kcal = num(it.kcal, 3000);
    if (!name || !kcal) continue;
    out.push({ date, meal, name: name[0].toUpperCase() + name.slice(1), kcal, carbs_g: num(it.carbs_g, 400), protein_g: num(it.protein_g, 200), fat_g: num(it.fat_g, 200) });
  }
  return out;
}

/** Drops changes that refer to unknown, locked or finished sessions; returns undefined when nothing is left. */
function validateProposal(raw: unknown, ctx: CoachContext, whole: boolean): Proposal | undefined {
  const r = raw as Partial<Proposal>;
  if (!r || typeof r.summary !== "string" || !Array.isArray(r.changes)) return undefined;
  const known = whole ? [...ctx.sessions, ...(ctx.plan_all ?? []).flatMap((w) => w.sessions)] : ctx.sessions;
  const byId = new Map(known.map((s) => [s.id, s]));
  const changes: PlanChange[] = [];
  for (const c of (r.changes as PlanChange[]).slice(0, whole ? 60 : 10)) {
    if (!c || !["move", "edit", "delete", "add"].includes(c.kind)) continue;
    let from: string | undefined;
    if (c.kind !== "add") {
      const s = c.sessionId ? byId.get(c.sessionId) : undefined;
      if (!s || s.locked || s.status === "done") continue;
      from = `${s.sport} · ${s.date}${s.start ? ` · ${s.start}` : ""}`;
    } else if (!c.date || !c.min || !c.sport) continue;
    if (c.date && !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) continue;
    if (c.start && !/^\d{2}:\d{2}$/.test(c.start)) continue;
    changes.push({ kind: c.kind, sessionId: c.sessionId, from, date: c.date, start: c.start, min: c.min, intensity: c.intensity, sport: c.sport, text: c.text });
  }
  if (!changes.length) return undefined;
  return { summary: r.summary.slice(0, 400), reason: typeof r.reason === "string" ? r.reason.slice(0, 400) : undefined, changes };
}
