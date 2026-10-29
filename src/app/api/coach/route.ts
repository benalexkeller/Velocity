// POST /api/coach — the coach answers one question. The browser sends today's conversation and the athlete's
// data (see src/lib/coach/context.ts); this route runs the fixed safety check, finds the relevant library
// passages, adds the instructions, calls the model through OpenRouter and returns the answer, its sources and
// any proposed plan change. The model key never reaches the browser.
//
// One model (COACH_MODEL, default deepseek/deepseek-v4.1-flash) answers questions. A whole-plan review (mode
// "restructure") runs only after the athlete accepts a pitch card, and uses COACH_MODEL_STRONG when set (default:
// the same model). COACH_DAILY_CAP: questions per athlete per day (default 40).
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { RESTRUCTURE_PROMPT, RESTRUCTURE_TOOL, SYSTEM_PROMPT, TOOLS, contextMessage } from "@/lib/coach/prompt";
import { PASSAGES } from "@/lib/coach/library-data";
import { referenceBlock, searchLibrary, usedCitations, type Passage } from "@/lib/coach/library";
import { RED_FLAG_REPLY, redFlag } from "@/lib/coach/safety";
import type { CoachContext, CoachReply, CoachRequest, PlanChange, Proposal } from "@/lib/coach/types";

export const runtime = "nodejs";
// a whole-plan review sends the full remaining plan to the model and can take well over the 10 s default; Vercel allows 60 s here
export const maxDuration = 60;
const MODEL = process.env.COACH_MODEL || "deepseek/deepseek-v4.1-flash";
const MODEL_STRONG = process.env.COACH_MODEL_STRONG || MODEL; // a stronger model for the whole-plan review is one setting away
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

  const model = restructure ? MODEL_STRONG : MODEL;
  const out = await callModel(model, messages, restructure ? TOOLS : [...TOOLS, RESTRUCTURE_TOOL], restructure ? 1800 : 700);
  if (!out) return NextResponse.json({ error: "upstream" }, { status: 502 });

  let text = (out.content ?? "").trim();
  let proposal: Proposal | undefined;
  for (const call of out.tool_calls ?? []) {
    if (call.function?.name === "request_restructure" && !restructure) {
      let pitch = "", reason = "";
      try { const a = JSON.parse(call.function.arguments || "{}") as { pitch?: string; reason?: string }; pitch = String(a.pitch ?? ""); reason = String(a.reason ?? ""); } catch { /* no pitch */ }
      // a pitch card: no changes yet; Accept runs the full review
      const review: Proposal = { kind: "review", summary: (pitch || text || "The whole remaining plan needs a review.").slice(0, 600), reason: reason.slice(0, 300), changes: [] };
      return NextResponse.json({ text: text || "More than the next two weeks need to change.", proposal: review, needs: "restructure", tier: "fast", model } satisfies CoachReply);
    }
    if (call.function?.name !== "propose_plan_change") continue;
    try { proposal = validateProposal(JSON.parse(call.function.arguments || "{}"), ctx, restructure); } catch { proposal = undefined; }
    if (proposal) break;
  }
  if (!text) text = proposal ? proposal.summary : "No answer. Ask again in other words.";
  const sources = usedCitations(text, refs.citations);
  return NextResponse.json({ text, proposal, sources: sources.length ? sources : undefined, model, tier: restructure ? "strong" : "fast" } satisfies CoachReply);
}

async function callModel(model: string, messages: Msg[], tools: unknown[], maxTokens: number): Promise<ModelOut | null> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://velocity-smoky-three.vercel.app", "X-Title": "Velocity coach" },
      body: JSON.stringify({ model, messages, tools, tool_choice: "auto", max_tokens: maxTokens, temperature: 0.3 }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) { console.error("[coach] fetch", e); return null; }
  if (!res.ok) { console.error("[coach] openrouter", model, res.status, (await res.text()).slice(0, 500)); return null; }
  const data = (await res.json()) as { choices?: { message?: ModelOut }[] };
  return data.choices?.[0]?.message ?? null;
}

/** Keeps the request small whatever the browser sends; the whole plan goes only in restructure mode. */
function trimContext(c: CoachContext, whole: boolean): CoachContext {
  const base = { ...c, sessions: c.sessions.slice(0, 40), activities: c.activities.slice(-40), weeks: c.weeks.slice(-6) };
  if (!whole) { delete base.plan_all; return base; }
  return { ...base, plan_all: (c.plan_all ?? []).slice(0, 40) };
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
