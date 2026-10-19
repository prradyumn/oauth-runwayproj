/**
 * Web research via Tavily. Works with no account: keyless mode (header below) is free and
 * rate-limited; a free API key (no credit card) raises the limits. Returns page text we keep for two jobs:
 *  1. a small, relevant excerpt goes to the LLM (free-tier token limits are tight)
 *  2. the full text is kept so the verifier can check quotes without re-fetching
 */

export class SearchUnavailable extends Error {
  constructor(public status: number, detail: string) {
    super(`Search unavailable (${status}): ${detail}`);
  }
}

export type SearchHit = { url: string; title: string; content: string; raw: string };

export async function search(
  query: string,
  opts: { includeDomains?: string[]; maxResults?: number; raw?: boolean } = {},
): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.TAVILY_API_KEY ? { authorization: `Bearer ${process.env.TAVILY_API_KEY}` } : { "x-tavily-access-mode": "keyless" }),
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: opts.maxResults ?? 5,
      include_raw_content: opts.raw ? "markdown" : false,
      include_domains: opts.includeDomains?.length ? opts.includeDomains : undefined,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new SearchUnavailable(res.status, (await res.text()).slice(0, 200));
  const data = (await res.json()) as { results?: { url: string; title: string; content: string; raw_content?: string | null }[] };
  return (data.results ?? []).map((r) => ({ url: r.url, title: r.title, content: r.content ?? "", raw: r.raw_content ?? "" }));
}

const KEYWORDS =
  /oauth|scope|redirect|callback|client id|client secret|review|verif|approv|publish|distribut|marketplace|install|limit|partner|privacy|security|assessment|business|token|expire|test user|production|consent|certif|connections?\b|plans?\b|pric|fee|paid|tier|maximum|cap\b|users\b/gi;

/** Pick the paragraphs most likely to carry setup/review requirements, in original order. */
export function excerpt(text: string, maxChars: number): string {
  const paras = text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40 && p.length < 900);
  const scored = paras.map((p, i) => ({ p, i, s: (p.match(KEYWORDS) ?? []).length }));
  const chosen: typeof scored = [];
  let used = 0;
  for (const c of [...scored].sort((a, b) => b.s - a.s)) {
    if (c.s === 0 || used + c.p.length > maxChars) continue;
    chosen.push(c);
    used += c.p.length;
  }
  return chosen
    .sort((a, b) => a.i - b.i)
    .map((c) => c.p)
    .join("\n");
}
