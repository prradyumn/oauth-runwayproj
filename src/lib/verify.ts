import type { Evidence, Guide } from "./schema";

/**
 * Quote verifier. Runs in code, not in the LLM.
 *
 * For every claim marked "documented", fetch the cited page(s) and check the
 * quoted sentence actually appears there. Results:
 *   confirmed    exact match after normalising whitespace/quotes/dashes
 *   near-match   >= 80% of the quote's 5-word shingles appear (minor wording drift)
 *   not-found    page loaded, quote absent  -> claim downgraded to "unverified"
 *   unreachable  page blocked/JS-rendered    -> status kept, flagged as "not auto-checked"
 */

export type PageText = { ok: boolean; text: string };
export type PageFetcher = (url: string) => Promise<PageText>;

export function normalize(s: string): string {
  return s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[*_`#>|]/g, " ") // markdown noise
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:!?)])/g, "$1")
    .replace(/\( /g, "(")
    .trim()
    .toLowerCase();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|li|h[1-6]|div|tr|section|article)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
}

const tokens = (s: string) => normalize(s).replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);

function shingleScore(quote: string, page: string): number {
  const q = tokens(quote);
  const p = tokens(page);
  const n = Math.min(5, q.length);
  if (n === 0) return 0;
  const pageSet = new Set<string>();
  for (let i = 0; i + n <= p.length; i++) pageSet.add(p.slice(i, i + n).join(" "));
  let hit = 0;
  let total = 0;
  for (let i = 0; i + n <= q.length; i++) {
    total++;
    if (pageSet.has(q.slice(i, i + n).join(" "))) hit++;
  }
  return total ? hit / total : 0;
}

export function checkQuote(quote: string, pageText: string): "confirmed" | "near-match" | "not-found" {
  const page = normalize(pageText);
  if (page.includes(normalize(quote))) return "confirmed";
  return shingleScore(quote, pageText) >= 0.8 ? "near-match" : "not-found";
}

export const httpFetcher: PageFetcher = async (url) => {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (OAuthRunway verifier)", accept: "text/html,*/*", "accept-language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false, text: "" };
    const text = htmlToText(await res.text());
    // Very short bodies are almost always JS shells.
    return { ok: text.replace(/\s+/g, " ").length > 500, text };
  } catch {
    return { ok: false, text: "" };
  }
};

export type VerifyReportRow = {
  path: string;
  quote: string;
  url?: string;
  result: NonNullable<Evidence["check"]>["result"];
  downgraded: boolean;
};

/** Mutates the guide in place: writes `check` on each quoted claim and downgrades not-found quotes. */
export async function verifyGuide(guide: Guide, fetcher: PageFetcher = httpFetcher, today = new Date().toISOString().slice(0, 10)) {
  const cache = new Map<string, Promise<PageText>>();
  const get = (url: string) => {
    if (!cache.has(url)) cache.set(url, fetcher(url));
    return cache.get(url)!;
  };
  const sourceUrl = new Map(guide.sources.map((s) => [s.id, s.url]));
  const rows: VerifyReportRow[] = [];
  const jobs: Promise<void>[] = [];

  const visit = (v: unknown, path: string) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach((x, i) => visit(x, `${path}[${i}]`));
    const o = v as Record<string, unknown>;
    if (typeof o.status === "string" && "sourceIds" in o) {
      const ev = o as unknown as Evidence;
      // Re-runs: give previously downgraded quotes another chance.
      if (ev.status === "unverified" && ev.quote && ev.check?.result === "not-found") {
        ev.status = "documented";
        ev.note = ev.note?.replace(/\s*Downgraded: quote not found on the cited page\./, "") || undefined;
      }
      if (ev.status === "documented" && ev.quote) jobs.push(checkEvidence(ev, path));
      else if (ev.status === "documented" && !ev.quote) {
        ev.status = "unverified";
        ev.note = [ev.note, "Downgraded: no quote supplied for a documented claim."].filter(Boolean).join(" ");
        rows.push({ path, quote: "", result: "not-found", downgraded: true });
      }
      return;
    }
    for (const [k, child] of Object.entries(o)) visit(child, path ? `${path}.${k}` : k);
  };

  const checkEvidence = async (ev: Evidence, path: string) => {
    const urls = ev.sourceIds.map((id) => sourceUrl.get(id)).filter((u): u is string => !!u);
    let best: VerifyReportRow["result"] = "unreachable";
    let bestUrl: string | undefined;
    for (const url of urls) {
      const page = await get(url);
      if (!page.ok) continue;
      let r = checkQuote(ev.quote!, page.text);
      // Some docs sites (e.g. Google) serve slightly different page variants per request.
      // Re-fetch before concluding a quote is absent.
      for (let retry = 0; r === "not-found" && retry < 2; retry++) {
        const again = await fetcher(url);
        if (again.ok) r = checkQuote(ev.quote!, again.text);
      }
      if (r === "confirmed" || (r === "near-match" && best !== "confirmed") || best === "unreachable") {
        best = r;
        bestUrl = url;
      }
      if (r === "confirmed") break;
    }
    ev.check = { result: best, checkedAt: today, url: bestUrl };
    const downgraded = best === "not-found";
    if (downgraded) {
      ev.status = "unverified";
      ev.note = [ev.note, "Downgraded: quote not found on the cited page."].filter(Boolean).join(" ");
    }
    rows.push({ path, quote: ev.quote!, url: bestUrl ?? urls[0], result: best, downgraded });
  };

  visit(guide, "");
  await Promise.all(jobs);
  return rows;
}
