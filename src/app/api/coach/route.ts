// POST /api/coach — the coach answers one question. The browser sends today's conversation and the athlete's
// data (see src/lib/coach/context.ts); this route adds the instructions, calls the model through OpenRouter
// and returns the answer plus any proposed plan change. The model key never reaches the browser.
//
// Env (Vercel → Environment Variables): OPENROUTER_API_KEY (required), COACH_MODEL (default
// deepseek/deepseek-v4.1-flash), COACH_DAILY_CAP (messages per athlete per day, default 40).
import { NextResponse, type NextRequest } from "next/server";
import { ACCOUNTS_ON } from "@/lib/supabase/env";
import { supabaseServer } from "@/lib/supabase/server";
import { SYSTEM_PROMPT, TOOLS, contextMessage } from "@/lib/coach/prompt";
import type { CoachContext, CoachReply, CoachRequest, PlanChange, Proposal } from "@/lib/coach/types";

export const runtime = "nodejs";
const MODEL = process.env.COACH_MODEL || "deepseek/deepseek-v4.1-flash";
const CAP = Number(process.env.COACH_DAILY_CAP || 40);
const KEY = process.env.OPENROUTER_API_KEY || "";
const BASE = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: "coach_off" }, { status: 503 });
  let body: CoachRequest;
  try { body = (await req.json()) as CoachRequest; } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!body?.context || !Array.isArray(body.messages) || !body.messages.length) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // who is asking: a signed-in athlete (accounts mode) — or anyone, in local development
  let uid: string | null = null;
  if (ACCOUNTS_ON) {
    const sb = await supabaseServer();
    const { data } = await sb!.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "signed_out" }, { status: 401 });
    uid = data.user.id;
    // daily cap: the athlete's own questions since midnight UTC
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await sb!.from("coach_messages").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("who", "You").gte("created_at", since.toISOString());
    if ((count ?? 0) >= CAP) return NextResponse.json({ text: `Daily limit reached (${CAP} questions). The coach answers again tomorrow.`, capped: true } satisfies CoachReply);
  }

  const ctx = body.context;
  const history = body.messages.slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextMessage(trimContext(ctx)) },
    ...history,
  ];

  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://velocity-smoky-three.vercel.app", "X-Title": "Velocity coach" },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto", max_tokens: 700, temperature: 0.3 }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e) {
    console.error("[coach] fetch", e);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
  if (!res.ok) {
    console.error("[coach] openrouter", res.status, (await res.text()).slice(0, 500));
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[] };
  const msg = data.choices?.[0]?.message;
  let text = (msg?.content ?? "").trim();
  let proposal: Proposal | undefined;
  for (const call of msg?.tool_calls ?? []) {
    if (call.function?.name !== "propose_plan_change") continue;
    try { proposal = validateProposal(JSON.parse(call.function.arguments || "{}"), ctx); } catch { proposal = undefined; }
    if (proposal) break;
  }
  if (!text) text = proposal ? proposal.summary : "No answer. Ask again in other words.";
  return NextResponse.json({ text, proposal, model: MODEL } satisfies CoachReply);
}

/** Keeps the request small whatever the browser sends. */
function trimContext(c: CoachContext): CoachContext {
  return { ...c, sessions: c.sessions.slice(0, 40), activities: c.activities.slice(-40), weeks: c.weeks.slice(-6) };
}

/** Drops changes that refer to unknown, locked or finished sessions; returns undefined when nothing is left. */
function validateProposal(raw: unknown, ctx: CoachContext): Proposal | undefined {
  const r = raw as Partial<Proposal>;
  if (!r || typeof r.summary !== "string" || !Array.isArray(r.changes)) return undefined;
  const byId = new Map(ctx.sessions.map((s) => [s.id, s]));
  const changes: PlanChange[] = [];
  for (const c of r.changes as PlanChange[]) {
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
  return { summary: r.summary.slice(0, 300), reason: typeof r.reason === "string" ? r.reason.slice(0, 300) : undefined, changes };
}
