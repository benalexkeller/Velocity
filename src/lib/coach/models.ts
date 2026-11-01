// Which AI models the coach uses, in order of preference. Requests go through OpenRouter with the whole list: the
// first model answers, and if it is down or overloaded OpenRouter passes the request to the next one.
// The "~…-latest" ids are OpenRouter aliases that always point at the newest model of that family, so the coach
// moves to stronger models as they are released without a code change.
//
// Env overrides (Vercel): COACH_MODELS / COACH_MODELS_STRONG replace a list (comma-separated ids);
// COACH_MODEL / COACH_MODEL_STRONG (older single settings) put one model in front of the defaults.

/** Everyday questions: fast and cheap. */
// No DeepSeek: its terms let it train on what it receives, which Google's review (1 Nov 2026) does not accept for an
// app that uses Google data. Claude Haiku and Gemini Flash are paid APIs whose terms exclude training on requests.
// Haiku first: on 1 Nov 2026 Claude Haiku 5.5 cost $0.10 / $0.50 per million tokens in / out, Gemini 3.8 Flash $0.75 / $3.75.
export const FAST_MODELS = ["~anthropic/claude-haiku-latest", "~google/gemini-flash-latest"];
/** Whole-plan reviews (and, next, new plans): the strongest models. */
export const STRONG_MODELS = ["~anthropic/claude-sonnet-latest", "~openai/gpt-latest", "~google/gemini-pro-latest"];

const split = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
function pick(list: string | undefined, one: string | undefined, defaults: string[]) {
  if (list) return split(list);
  if (one) return [one, ...defaults.filter((m) => m !== one)];
  return defaults;
}
export function coachModels() {
  return {
    fast: pick(process.env.COACH_MODELS, process.env.COACH_MODEL, FAST_MODELS),
    strong: pick(process.env.COACH_MODELS_STRONG, process.env.COACH_MODEL_STRONG, STRONG_MODELS),
  };
}
