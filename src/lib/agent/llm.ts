import { generateText, APICallError, type LanguageModelV1 } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Emit } from "./events";

/**
 * Provider-agnostic LLM access. Groq (Qwen) first, Gemini as fallback, none = demo mode.
 * Free tiers have tight tokens-per-minute limits, so we handle 429s ourselves and
 * tell the user we're waiting instead of failing.
 */

export function getModel(): { model: LanguageModelV1; name: string } | null {
  if (process.env.GROQ_API_KEY) {
    const id = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
    return { model: createGroq({ apiKey: process.env.GROQ_API_KEY, fetch: groqFetch })(id), name: `Groq · ${id}` };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const id = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    return { model: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(id), name: `Gemini · ${id}` };
  }
  return null;
}

/**
 * gpt-oss models reason before answering; on a free tier (8k tokens/min) that budget matters.
 * The AI SDK's Groq provider has no reasoning_effort option, so inject it into the request.
 */
const groqFetch: typeof fetch = (input, init) => {
  if (init?.body && typeof init.body === "string" && init.body.includes('"openai/gpt-oss')) {
    const body = JSON.parse(init.body);
    body.reasoning_effort = process.env.GROQ_REASONING_EFFORT || "low";
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(input, init);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryAfterMs(err: APICallError): number {
  const h = err.responseHeaders ?? {};
  const ra = h["retry-after"] ?? h["Retry-After"];
  if (ra && !Number.isNaN(Number(ra))) return Math.min(65_000, Number(ra) * 1000 + 500);
  const m = /try again in ([\d.]+)s/i.exec(err.message);
  if (m) return Math.min(65_000, Number(m[1]) * 1000 + 500);
  return 20_000;
}

/** Ask for JSON, strip any <think> block, parse leniently. */
export async function askJSON(
  model: LanguageModelV1,
  system: string,
  prompt: string,
  emit: Emit,
  maxTokens = 2500,
): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { text } = await generateText({
        model,
        system,
        // "/no_think" disables Qwen3's thinking mode; other models ignore it.
        prompt: `${prompt}\n\nReturn only one JSON object. /no_think`,
        temperature: 0.2,
        maxTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(45_000),
      });
      if (process.env.AGENT_DEBUG) {
        const fs = await import("node:fs");
        fs.mkdirSync(".cache/debug", { recursive: true });
        fs.writeFileSync(`.cache/debug/${Date.now()}.txt`, `${system}\n---\n${prompt}\n=== OUTPUT ===\n${text}`);
      }
      return parseJSON(text);
    } catch (err) {
      if (APICallError.isInstance(err) && err.statusCode === 429 && attempt < 3) {
        const wait = retryAfterMs(err);
        emit({ type: "log", message: `Free-tier rate limit hit — waiting ${Math.round(wait / 1000)}s, then continuing.` });
        await sleep(wait);
        continue;
      }
      if (err instanceof Error && /abort|timeout/i.test(err.name + err.message) && attempt < 2) {
        emit({ type: "log", message: "Model call took over 45s — retrying." });
        continue;
      }
      if (err instanceof SyntaxError && attempt < 1) {
        emit({ type: "log", message: "Model returned malformed JSON — retrying once." });
        continue;
      }
      throw err;
    }
  }
  throw new Error("LLM retries exhausted");
}

export function parseJSON(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  if (start < 0) throw new SyntaxError("No JSON object in model output");
  const end = cleaned.lastIndexOf("}");
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return repairTruncated(cleaned.slice(start));
  }
}

/**
 * Output cut off at the token limit: keep every complete element, drop the partial one,
 * and close the open brackets. Tries cut points at commas, newest first.
 */
export function repairTruncated(s: string): unknown {
  const cuts: { at: number; closers: string }[] = [];
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
    else if (c === ",") cuts.push({ at: i, closers: [...stack].reverse().join("") });
  }
  for (const cut of cuts.reverse().slice(0, 300)) {
    try {
      return JSON.parse(s.slice(0, cut.at) + cut.closers);
    } catch {}
  }
  throw new SyntaxError("Model output was truncated and could not be repaired");
}
