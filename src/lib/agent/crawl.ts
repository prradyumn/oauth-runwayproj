import { htmlToText } from "../verify";
import type { Emit } from "./events";
import type { SearchHit } from "./search";

/**
 * Keyless docs research: no search API needed.
 *
 *  1. The model proposes the official docs domain and likely URLs (from its own knowledge).
 *  2. Code fetches every proposed URL; ones that don't exist are dropped and reported, so a
 *     hallucinated URL can never become a source.
 *  3. We read the docs site's sitemap / llms.txt and one hop of links from real pages,
 *     and rank URLs by OAuth/review keywords.
 *  4. Pages are fetched directly; JS-only pages go through Jina Reader (free, no key).
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 OAuthRunway";

export type Page = { url: string; title: string; text: string; via: "direct" | "reader" };

async function get(url: string, ms = 12_000): Promise<{ ok: boolean; status: number; url: string; body: string; type: string }> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    return { ok: res.ok, status: res.status, url: res.url || url, body: res.ok ? await res.text() : "", type: res.headers.get("content-type") ?? "" };
  } catch {
    return { ok: false, status: 0, url, body: "", type: "" };
  }
}

const titleOf = (html: string, url: string) =>
  (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? url).replace(/\s+/g, " ").trim().slice(0, 140);

let readerBudget = 4; // Jina Reader is slow and rate-limited without a key; use it sparingly

/** Fetch one page as readable text. Falls back to Jina Reader for JS-rendered or bot-blocked pages. */
export async function fetchPage(url: string): Promise<Page | null> {
  const r = await get(url, 10_000);
  if (r.ok && /html|text|markdown/.test(r.type)) {
    const text = htmlToText(r.body);
    if (text.replace(/\s+/g, " ").length > 1500) return { url: r.url, title: titleOf(r.body, r.url), text, via: "direct" };
  }
  // A URL that doesn't exist must never become a source. 403/JS shells go to the reader.
  if (r.status === 404 || r.status === 410 || (r.status === 0 && !/^https:\/\//.test(url))) return null;
  if (readerBudget <= 0 || r.status === 0) return null;
  readerBudget--;
  const jr = await get(`https://r.jina.ai/${url}`, 20_000);
  if (!jr.ok || jr.body.length < 800) return null;
  const title = /^Title:\s*(.+)$/m.exec(jr.body)?.[1]?.trim() ?? url;
  const text = jr.body.replace(/^[\s\S]*?Markdown Content:\s*/, "");
  return { url, title: title.slice(0, 140), text, via: "reader" };
}

export const DOC_KEYWORDS = /oauth|auth|scope|permission|consent|review|verif|publish|distribut|marketplace|app-?store|listing|redirect|register|create[-_]?app|getting[-_]?started|quickstart|rate[-_]?limit|token|app[-_]?approval|partner|security/i;
const NOISE = /changelog|release-notes|blog|community|forum|\/api-reference\/[^/]+\/[^/]+\/|\.(png|jpg|svg|pdf|zip)$|\/(fr|de|es|ja|ko|zh|pt|it)(-[a-z]{2})?\//i;

const lastSeg = (u: string) => u.replace(/\/$/, "").split("/").pop()!.toLowerCase();
function topic(u: string): string {
  const p = u.toLowerCase();
  if (/review|verif|approv|publish|submit|marketplace|listing|distribut/.test(p)) return "review";
  if (/scope|permission/.test(p)) return "scopes";
  if (/create|register|build|getting-started|quickstart/.test(p)) return "create";
  if (/oauth|auth/.test(p)) return "auth";
  return "other";
}

export function scoreUrl(u: string): number {
  if (NOISE.test(u)) return -1;
  const path = u.replace(/^https?:\/\/[^/]+/, "").toLowerCase();
  let s = 0;
  for (const [re, w] of [
    [/oauth/, 6], [/scope|permission/, 4], [/review|verif|approv/, 5], [/publish|distribut|marketplace|listing|submit/, 5],
    [/create|register|build|getting-started|quickstart/, 3], [/auth/, 2], [/rate-?limit/, 2], [/token/, 1], [/security|partner/, 2],
  ] as [RegExp, number][]) if (re.test(path)) s += w;
  return s - path.split("/").length * 0.2; // prefer shallower pages
}

async function sitemapUrls(domain: string): Promise<string[]> {
  const out = new Set<string>();
  const seeds = [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`, `https://${domain}/llms.txt`];
  const robots = await get(`https://${domain}/robots.txt`, 6000);
  if (robots.ok) for (const m of robots.body.matchAll(/^sitemap:\s*(\S+)/gim)) seeds.unshift(m[1]);
  const visited = new Set<string>();
  const queue = [...new Set(seeds)];
  while (queue.length && visited.size < 8 && out.size < 6000) {
    const u = queue.shift()!;
    if (visited.has(u)) continue;
    visited.add(u);
    const r = await get(u, 10_000);
    if (!r.ok) continue;
    if (u.endsWith("llms.txt")) {
      for (const m of r.body.matchAll(/\((https?:\/\/[^)\s]+)\)/g)) out.add(m[1]);
      continue;
    }
    for (const m of r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      const loc = m[1].replace(/&amp;/g, "&");
      if (/\.xml(\.gz)?$/.test(loc)) {
        // sitemap index: follow child sitemaps that look like docs first
        if (/doc|develop|api|guide|en/i.test(loc)) queue.unshift(loc);
        else queue.push(loc);
      } else out.add(loc);
    }
  }
  return [...out];
}

function linksFrom(html: string, base: string, domains: string[]): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"#]+)"/g)) {
    try {
      const u = new URL(m[1], base);
      if (domains.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))) out.add(u.origin + u.pathname);
    } catch {}
  }
  return [...out];
}

/**
 * Collect up to `max` relevant docs pages for an app, as SearchHits.
 * Reports what it did through `emit` so the user can watch the agent work.
 */
export async function crawlDocs(
  opts: { app: string; domains: string[]; candidates: string[]; max?: number },
  emit: Emit,
): Promise<SearchHit[]> {
  const max = opts.max ?? 8;
  readerBudget = 4;
  const deadline = Date.now() + 70_000;
  let domains = [...new Set(opts.domains.map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase()).filter(Boolean))];
  // The model often names the marketing domain. Probe the usual developer-docs hosts too.
  const bases = [...new Set([...domains, ...opts.candidates.map((u) => { try { return new URL(u).hostname; } catch { return ""; } })].filter(Boolean).map((h) => h.split(".").slice(-2).join(".")))];
  const probes = bases.flatMap((b) => ["developers", "developer", "docs", "dev"].map((sub) => `${sub}.${b}`)).filter((h) => !domains.includes(h));
  const alive = await Promise.all(probes.map(async (h) => ((await get(`https://${h}/`, 6000)).ok ? h : null)));
  const found = alive.filter((h): h is string => !!h);
  if (found.length) emit({ type: "log", message: `Found developer docs host${found.length > 1 ? "s" : ""}: ${found.join(", ")}.` });
  domains = [...found, ...domains];
  const isDocsHost = (h: string) => /^(developers?|docs|dev|api)\./.test(h) || found.includes(h);
  const docsLike = (u: string) => { try { const x = new URL(u); return isDocsHost(x.hostname) || /\/(docs?|developers?|api|guides?|reference)(\/|$)/i.test(x.pathname); } catch { return false; } };
  const pages: Page[] = [];
  const seen = new Set<string>();
  const norm = (u: string) => u.replace(/[?#].*$/, "").replace(/\.md$/, "").replace(/\/$/, "");

  // 1. Model-proposed URLs, verified by fetching.
  const cands = [...new Set(opts.candidates.filter((u) => /^https?:\/\//.test(u)).map(norm))].slice(0, 8);
  const fetched = await Promise.all(cands.map(async (u) => ({ u, p: await fetchPage(u) })));
  const dead = fetched.filter((f) => !f.p).map((f) => f.u);
  for (const f of fetched) if (f.p && !seen.has(norm(f.p.url))) { seen.add(norm(f.p.url)); seen.add(f.u); pages.push(f.p); }
  emit({ type: "log", message: `Checked ${cands.length} URLs the model suggested: ${pages.length} exist${dead.length ? `, ${dead.length} don't (dropped: ${dead.map((d) => d.replace(/^https?:\/\//, "")).join(", ")})` : ""}.` });

  // 2. Sitemaps / llms.txt of the official docs domains, plus one hop of links from real pages.
  let pool: string[] = [];
  for (const d of domains.slice(0, 3)) {
    if (Date.now() > deadline) break;
    const urls = (await sitemapUrls(d)).filter(docsLike);
    if (urls.length) emit({ type: "log", message: `Read ${d} sitemap: ${urls.length} docs pages indexed.` });
    pool.push(...urls);
  }
  for (const p of pages) {
    const r = await get(p.url, 8000);
    if (r.ok) pool.push(...linksFrom(r.body, r.url, domains.length ? domains : [new URL(p.url).hostname]));
  }
  pool = [...new Set(pool.map(norm))].filter((u) => !seen.has(u) && docsLike(u));
  const appWord = opts.app.toLowerCase().split(/\s+/)[0];
  // Rank, then pick round-robin across topics so we don't read six variants of the scopes page.
  const sorted = pool
    .map((u) => ({ u, s: scoreUrl(u) + (u.toLowerCase().includes(appWord) ? 0.5 : 0) }))
    .filter((x) => x.s > 2)
    .sort((a, b) => b.s - a.s);
  const have = new Set(pages.map((p) => topic(p.url)));
  const leaf = new Set(pages.map((p) => lastSeg(p.url)));
  const buckets = new Map<string, string[]>();
  for (const { u } of sorted) {
    if (leaf.has(lastSeg(u))) continue;
    const t = topic(u);
    buckets.set(t, [...(buckets.get(t) ?? []), u]);
  }
  const order = ["create", "review", "scopes", "auth", "other"].sort((a, b) => Number(have.has(a)) - Number(have.has(b)));
  const ranked: { u: string }[] = [];
  for (let round = 0; round < 4; round++)
    for (const t of order) {
      const b = buckets.get(t) ?? [];
      const next = b.find((u) => !leaf.has(lastSeg(u)));
      if (next) { ranked.push({ u: next }); leaf.add(lastSeg(next)); b.splice(b.indexOf(next), 1); }
    }

  // 3. Fetch the best-ranked pages until we have enough.
  for (let i = 0; i < ranked.length && pages.length < max && Date.now() < deadline; i += 4) {
    const batch = await Promise.all(ranked.slice(i, i + 4).map((r) => fetchPage(r.u)));
    for (const p of batch) if (p && pages.length < max && !seen.has(norm(p.url))) { seen.add(norm(p.url)); pages.push(p); }
  }
  const viaReader = pages.filter((p) => p.via === "reader").length;
  emit({ type: "log", message: `Collected ${pages.length} docs pages${viaReader ? ` (${viaReader} rendered via Jina Reader)` : ""}.` });

  return pages.map((p) => ({ url: p.url, title: p.title, content: p.text.slice(0, 300), raw: p.text }));
}
