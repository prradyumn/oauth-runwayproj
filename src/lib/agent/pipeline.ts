import { z } from "zod";
import { Guide, type Evidence, type Factors, type Source, type Step } from "../schema";
import { assessFor, TIERS } from "../rubric";
import { verifyGuide, httpFetcher, type PageFetcher } from "../verify";
import { slugify } from "../store";
import { COMPOSIO, LIBRARY_INDEX } from "../composio";
import { askJSON, getModel } from "./llm";
import { search, excerpt, type SearchHit } from "./search";
import { crawlDocs } from "./crawl";
import type { Emit } from "./events";
import { runDemo } from "./demo";

/**
 * Live guide generation:
 *   resolve -> research -> classify (LLM) -> plan (LLM) -> verify (code) -> score (code)
 *
 * The LLM never decides evidence status or difficulty. It proposes facts with a
 * quote + source id; code turns that into "documented" only if the quote is
 * really on the page, and the rubric computes the tier.
 */

const today = () => new Date().toISOString().slice(0, 10);
const FACTOR_KEYS = [
  "selfServeCreate",
  "reviewRequired",
  "securityAssessment",
  "businessVerification",
  "partnerApproval",
  "paidAccessRequired",
  "userCapBeforeReview",
  "demoVideoRequired",
  "privacyPolicyRequired",
  "domainVerification",
  "customerAdminApproval",
] as const;

const FACTOR_HELP: Record<(typeof FACTOR_KEYS)[number], string> = {
  selfServeCreate: "boolean: can anyone create the OAuth app with a free account, no approval?",
  reviewRequired: "boolean: must the provider review/approve before THIS scenario's audience can connect?",
  securityAssessment: "boolean: third-party security assessment/audit required (e.g. CASA)?",
  businessVerification: "boolean: legal business/entity verification required?",
  partnerApproval: "boolean: a SEPARATE partner program / API-access application (beyond normal app review) that can be refused? A normal listing/app review is reviewRequired, not this.",
  paidAccessRequired: "boolean: does API access itself require a paid plan/tier?",
  userCapBeforeReview: "integer or null: max users/installs before review (null if no cap)",
  demoVideoRequired: "boolean: demo/screencast video required for review?",
  privacyPolicyRequired: "boolean: public privacy policy URL required?",
  domainVerification: "boolean: must you verify ownership of your domain?",
  customerAdminApproval: "boolean: may an admin in the END USER's organization have to approve/allowlist the app before users can connect?",
};

// ---------- lenient shapes for model output ----------
// Small models drift from the requested shape (booleans in text fields, bare values instead of
// {value, quote}). Accept the drift, and drop only the bad item, never a whole list.
const str = z.unknown().transform((v) => (typeof v === "string" && v.trim() ? v : null));
const Q = { quote: str, src: str };
const items = <T extends z.ZodTypeAny>(item: T) =>
  z.unknown().transform((v) => (Array.isArray(v) ? v : []).flatMap((x) => { const r = item.safeParse(x); return r.success ? [r.data as z.infer<T>] : []; }));
const FactorIn = z.unknown().transform((v) => {
  if (v === null || typeof v !== "object") return { value: (typeof v === "boolean" || typeof v === "number" ? v : null) as boolean | number | null, quote: null, src: null };
  const o = v as Record<string, unknown>;
  const val = o.value;
  return {
    value: (typeof val === "boolean" || typeof val === "number" ? val : val === "true" ? true : val === "false" ? false : null) as boolean | number | null,
    quote: typeof o.quote === "string" && o.quote.trim() ? o.quote : null,
    src: typeof o.src === "string" && o.src.trim() ? o.src : null,
  };
});
const num = z.coerce.number().catch(0);
const range = z.array(num).catch([0, 0]).transform((a) => [a[0] ?? 0, a[1] ?? a[0] ?? 0] as [number, number]);

const ResolveOut = z.object({
  appName: z.string(),
  website: z.string().catch(""),
  category: z.string().catch("Other"),
  developerPortalUrl: z.string().catch(""),
  docsUrl: z.string().catch(""),
  officialDomains: z.array(z.string()).catch([]),
  supportsOAuth: z.boolean().catch(true),
  candidateUrls: z.array(z.string()).catch([]),
  notes: z.string().catch(""),
});

const ClassifyOut = z.object({
  summary: z.string().catch(""),
  openQuestions: z.array(z.string()).catch([]),
  scenarios: z
    .array(
      z.object({
        id: z.string().catch("scenario"),
        label: z.string().catch("Scenario"),
        audience: z.enum(["self", "internal", "public"]).catch("public"),
        description: z.string().catch(""),
        scopes: items(z.object({ name: z.string(), purpose: z.string().catch(""), sensitivity: z.enum(["basic", "sensitive", "restricted", "gated"]).catch("basic") })),
        factors: z.record(FactorIn).catch({}),
        timeline: z
          .object({
            firstConnectionMinutes: range,
            productionHandsOnHours: range,
            productionWaitDays: range.nullable().catch(null),
            note: z.string().catch(""),
          })
          .catch({ firstConnectionMinutes: [15, 60], productionHandsOnHours: [1, 4], productionWaitDays: null, note: "" }),
      }),
    )
    .min(1),
});

const PlanOut = z.object({
  scenarios: items(
    z.object({
      id: z.string(),
      steps: items(
        z.object({
          phase: z.enum(["prepare", "create", "configure", "connect", "review", "launch"]).catch("configure"),
          title: z.string(),
          detail: z.string().catch(""),
          actor: z.enum(["agent", "human", "both"]).catch("human"),
          agentCan: str,
          humanMust: str,
          url: str,
          values: items(z.object({ label: z.string(), value: z.coerce.string() })),
          estMinutes: z.coerce.number().nullish().catch(null),
          ...Q,
        }),
      ),
      blockers: items(z.object({ title: z.string(), symptom: z.string().catch(""), whatToDo: z.string().catch(""), ...Q })),
    }),
  ),
  artifacts: items(z.object({ title: z.string(), content: z.string() })),
});

const isUrl = (s: string) => /^https?:\/\/|^[\w-]+\.[a-z]{2,}(\/|$)/i.test(s.trim());
const validUrl = (u?: string | null) => {
  if (!u) return null;
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).toString();
  } catch {
    return null;
  }
};

type Deps = {
  model: ReturnType<typeof getModel>;
  search: typeof search;
  askJSON: (system: string, prompt: string, emit: Emit, maxTokens?: number) => Promise<unknown>;
};

/** Dependencies are injectable so the pipeline can be tested offline (scripts/test-pipeline.ts). */
export async function runPipeline(input: string, emit: Emit, deps?: Partial<Deps>): Promise<Guide> {
  const llm = deps?.model !== undefined ? deps.model : getModel();
  const search_ = deps?.search ?? search;
  const ask = deps?.askJSON ?? ((sys: string, prompt: string, e: Emit, max?: number) => askJSON(llm!.model, sys, prompt, e, max));
  // Discovery: Tavily search (keyless by default, or with a free key). If search is disabled,
  // rate-limited or thin, the agent falls back to crawling the provider's docs itself.
  let useSearch = !!deps?.search || process.env.SEARCH_PROVIDER !== "crawl";
  const searchOrFallback = async (q: string, o: Parameters<typeof search>[1]): Promise<SearchHit[]> => {
    if (!useSearch) return [];
    try {
      return await search_(q, o);
    } catch (err) {
      useSearch = false;
      emit({ type: "log", message: `Web search unavailable (${err instanceof Error ? err.message.slice(0, 80) : "error"}) — switching to the built-in docs crawler.` });
      return [];
    }
  };
  if (!llm) {
    emit({ type: "meta", mode: "demo" });
    return runDemo(input, emit);
  }
  emit({ type: "meta", mode: "live", model: llm.name });
  const isGroq = llm.name.startsWith("Groq");
  const excerptBudget = isGroq ? 7000 : 24000; // chars; Groq free tier has a small tokens/minute budget

  // ---------- 1. resolve ----------
  emit({ type: "stage", stage: "resolve", status: "start" });
  const first = await searchOrFallback(
    isUrl(input) ? `${new URL(validUrl(input)!).hostname} OAuth 2.0 API developer documentation` : `${input} OAuth 2.0 API developer documentation create app`,
    { maxResults: 6 },
  );
  const searched = first.length > 0;
  const resolved = ResolveOut.parse(
    await ask(
      "You identify software products and their official developer documentation." + (searched ? " Use the search results given." : " Use your own knowledge; every URL you give will be fetched to check it exists, and wrong URLs are discarded."),
      `User asked about: "${input}"\n\n${
        searched ? `Search results:\n${first.map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.content.slice(0, 300)}`).join("\n\n")}\n\n` : ""
      }Return JSON: {"appName": string, "website": url, "category": string (e.g. "CRM", "Email", "Developer tools"), "developerPortalUrl": url where developers create apps, "docsUrl": url of OAuth docs, "officialDomains": [bare hostnames that host this provider's OWN developer docs, e.g. "developers.hubspot.com"], "candidateUrls": [up to 8 full URLs of official pages about: creating an OAuth app, OAuth scopes, the app review / verification / marketplace publishing process, API access tiers or partner programs], "supportsOAuth": boolean (does it offer OAuth 2.0 for third-party apps?), "notes": string}`,
      emit,
      900,
    ),
  );
  if (!resolved.supportsOAuth) {
    throw new Error(`${resolved.appName} doesn't appear to offer OAuth 2.0 for third-party apps (${resolved.notes || "no OAuth docs found"}). It may use API keys instead, in which case no OAuth app is needed.`);
  }
  const app = resolved.appName;
  const domains = resolved.officialDomains.map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);
  emit({ type: "stage", stage: "resolve", status: "done", detail: `${app} · docs on ${domains.join(", ") || "unknown domains"}` });

  // ---------- 2. research ----------
  emit({ type: "stage", stage: "research", status: "start" });
  const queries = [
    `${app} create OAuth app client ID client secret redirect URI`,
    `${app} OAuth scopes permissions`,
    `${app} app review verification approval publish marketplace requirements`,
    `${app} API access requirements partner program pricing rate limits`,
  ];
  const runQueries = async (incl?: string[]) => {
    const out: SearchHit[][] = [];
    for (const q of queries) out.push(await searchOrFallback(q, { includeDomains: incl, maxResults: 3, raw: true })); // sequential: gentle on keyless limits
    return out;
  };
  const seen = new Set<string>();
  let hits: SearchHit[] = [];
  if (useSearch) {
    let batches = await runQueries(domains);
    if (useSearch && batches.flat().length < 3) {
      emit({ type: "log", message: "Few results on official domains — widening search." });
      batches = await runQueries(undefined);
    }
    hits = batches.flat().filter((h) => h.raw.length > 200 && !seen.has(h.url) && seen.add(h.url)).slice(0, 8);
    if (hits.length) emit({ type: "log", message: `Web search found ${hits.length} relevant pages.` });
  }
  if (hits.length < 4) {
    // Search off, rate-limited or thin: crawl the docs site and top up.
    const extra = [resolved.docsUrl, resolved.developerPortalUrl].map(validUrl).filter((u): u is string => !!u && new URL(u).pathname.length > 1);
    const crawled = await crawlDocs({ app, domains, candidates: [...resolved.candidateUrls, ...extra], max: 8 - hits.length }, emit);
    hits = [...hits, ...crawled.filter((h) => !seen.has(h.url) && seen.add(h.url))].slice(0, 8);
  }
  if (!hits.length) throw new Error(`Couldn't find readable documentation for ${app}.`);

  const sources: Source[] = hits.map((h, i) => ({
    id: `s${i + 1}`,
    url: h.url,
    title: h.title.slice(0, 140) || h.url,
    kind: domains.some((d) => new URL(h.url).hostname.endsWith(d)) ? "official" : "community",
    accessed: today(),
  }));
  const rawByUrl = new Map(hits.map((h) => [h.url, h.raw]));
  sources.forEach((s) => emit({ type: "source", url: s.url, title: s.title }));
  const per = Math.floor(excerptBudget / hits.length);
  const corpus = hits.map((h, i) => `[s${i + 1}] ${h.title} (${sources[i].kind})\n${excerpt(h.raw, per)}`).join("\n\n");
  emit({ type: "stage", stage: "research", status: "done", detail: `${hits.length} pages read (${sources.filter((s) => s.kind === "official").length} official)` });

  const RULES = `Rules:
- Use ONLY the excerpts. Never invent requirements, numbers, or URLs.
- When an excerpt supports a fact, set "quote" to a full sentence copied EXACTLY, character for character, from that excerpt (8-30 words) that states the fact in words (not a table row, code sample or URL), and "src" to its id like "s2". Otherwise set quote and src to null.
- Code will check every quote against the real page; paraphrased quotes are discarded.
- Set a requirement to true only if an excerpt states it for THIS provider. Never carry over rules you know from other providers (e.g. Google's 100-user cap or CASA). If unsure, use false/null and add an open question.`;

  // ---------- 3. classify ----------
  emit({ type: "stage", stage: "classify", status: "start" });
  const classified = ClassifyOut.parse(
    await ask(
      `You analyse what it takes for a developer to create an OAuth app with a provider and get it approved, for an AI agent product using Composio as the OAuth client. ${RULES}`,
      `Provider: ${app}\n\nExcerpts:\n${corpus}\n\nDifficulty depends on scopes x audience. Define ${isGroq ? "2" : "2-3"} scenarios, always including (a) the developer's own account/testing and (b) public production use with the scopes an AI agent would typically need. For each scenario give EVERY one of these factors as an object, e.g. "reviewRequired": {"value": true, "quote": "<exact sentence>", "src": "s3"}:\n${FACTOR_KEYS.map((k) => `- ${k}: ${FACTOR_HELP[k]}`).join("\n")}\n\nReturn JSON: {"summary": "2-3 honest sentences: how hard, how long, main blocker", "openQuestions": [things the excerpts did not settle], "scenarios": [{"id": kebab-case, "label", "audience": "self"|"internal"|"public", "description", "scopes": [{"name","purpose","sensitivity":"basic"|"sensitive"|"restricted"|"gated"}], "factors": {...}, "timeline": {"firstConnectionMinutes":[min,max], "productionHandsOnHours":[min,max], "productionWaitDays":[min,max] or null if no provider wait, "note"}}]}`,
      emit,
      isGroq ? 3200 : 4000,
    ),
  );
  const usedIds = new Set<string>();
  for (const sc of classified.scenarios) {
    let id = sc.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scenario";
    while (usedIds.has(id)) id += "-2";
    usedIds.add(id);
    sc.id = id;
  }
  emit({ type: "stage", stage: "classify", status: "done", detail: `${classified.scenarios.length} scenarios: ${classified.scenarios.map((s) => s.label).join(" · ")}` });

  // ---------- 4. plan ----------
  emit({ type: "stage", stage: "plan", status: "start" });
  const redirect = COMPOSIO.redirectUri ?? "<Composio callback URL from your auth config>";
  const planned = PlanOut.parse(
    await ask(
      `You write precise, actionable setup guides for developers. Label each step's actor: "agent" (an AI agent can do it alone: drafting text, generating config, checking settings, testing a connection), "human" (login, CAPTCHA, legal/business attestation, payment, recording video, submitting to the provider), or "both" (agent prepares, human submits). ${RULES}`,
      `Provider: ${app}. Developer portal: ${resolved.developerPortalUrl}. The redirect URI to register is Composio's: ${redirect}\n\nScenarios:\n${classified.scenarios
        .map((s) => `- ${s.id}: ${s.label} — ${s.description}; scopes: ${s.scopes.map((x) => x.name).join(", ")}`)
        .join("\n")}\n\nExcerpts:\n${corpus}\n\nReturn JSON: {"scenarios": [{"id", "steps": [{"phase":"prepare"|"create"|"configure"|"connect"|"review"|"launch", "title", "detail" (1-3 sentences, concrete field names), "actor", "agentCan": text or null, "humanMust": text or null, "url" (only if from excerpts or the portal URL above), "values": [{"label","value"}] exact values to paste, "estMinutes", "quote", "src"}], "blockers": [{"title","symptom","whatToDo","quote","src"}]}], "artifacts": [{"title","content"}] (1-2 drafts an agent can write now, e.g. scope justification or app description)}. ${isGroq ? "Max 6 steps and 3 blockers per scenario, 1 short artifact. Keep detail to 1-2 sentences. Be concise." : "4-10 steps and 2-5 blockers per scenario."}`,
      emit,
      isGroq ? 4800 : 6000,
    ),
  );
  emit({ type: "stage", stage: "plan", status: "done", detail: `${planned.scenarios.reduce((n, s) => n + s.steps.length, 0)} steps, ${planned.scenarios.reduce((n, s) => n + s.blockers.length, 0)} blockers` });

  // ---------- assemble ----------
  const ids = new Set(sources.map((s) => s.id));
  const ev = (quote?: string | null, src?: string | null, fallbackNote = "Not supported by a quote from the pages the agent read."): Evidence =>
    quote && src && ids.has(src) ? { status: "documented", sourceIds: [src], quote } : { status: "unverified", sourceIds: [], note: fallbackNote };

  const scenarios = classified.scenarios.map((s) => {
    const factors = Object.fromEntries(
      FACTOR_KEYS.map((k) => {
        const f = s.factors[k];
        const value =
          k === "userCapBeforeReview"
            ? typeof f?.value === "number" && f.value > 0
              ? Math.round(f.value)
              : null
            : k === "selfServeCreate"
              ? f?.value !== false
              : f?.value === true;
        return [k, { value, evidence: ev(f?.quote, f?.src, f ? undefined : "Model gave no answer; defaulted.") }];
      }),
    ) as unknown as Factors;
    const plan = planned.scenarios.find((p) => p.id === s.id) ?? planned.scenarios[classified.scenarios.indexOf(s)];
    const steps: Step[] = (plan?.steps ?? []).map((st, i) => {
      const url = validUrl(st.url);
      return {
        id: `${s.id}-${i + 1}`,
        phase: st.phase,
        title: st.title,
        detail: st.detail,
        actor: st.actor,
        agentCan: st.agentCan ?? undefined,
        humanMust: st.humanMust ?? undefined,
        links: url ? [{ label: new URL(url).hostname, url }] : [],
        values: st.values,
        estMinutes: st.estMinutes ?? undefined,
        evidence: ev(st.quote, st.src),
      };
    });
    return {
      id: s.id,
      label: s.label,
      audience: s.audience,
      description: s.description,
      scopes: s.scopes,
      factors,
      timeline: {
        firstConnection: { handsOnMinutes: s.timeline.firstConnectionMinutes, note: "Your own account, test/dev mode." },
        production: { handsOnHours: s.timeline.productionHandsOnHours, waitDays: s.timeline.productionWaitDays, note: s.timeline.note },
        evidence: { status: "unverified" as const, sourceIds: [], note: "Agent estimate derived from the documented requirements; not timed." },
      },
      steps,
      blockers: (plan?.blockers ?? []).map((b) => ({ title: b.title, symptom: b.symptom, whatToDo: b.whatToDo, evidence: ev(b.quote, b.src) })),
    };
  });

  sources.push({ id: "c1", url: COMPOSIO.redirectSource.url, title: COMPOSIO.redirectSource.title, kind: "composio", accessed: today() });
  const known = LIBRARY_INDEX.find((a) => a.name.toLowerCase() === app.toLowerCase());

  const guide = Guide.parse({
    slug: slugify(app),
    app: {
      name: app,
      website: validUrl(resolved.website) ?? sources[0].url,
      category: resolved.category,
      developerPortalUrl: validUrl(resolved.developerPortalUrl) ?? sources[0].url,
      docsUrl: validUrl(resolved.docsUrl) ?? sources[0].url,
    },
    origin: "agent",
    lastVerified: today(),
    summary: classified.summary,
    composio: {
      managedAppAvailable: {
        value: known ? known.managed : null,
        evidence: {
          status: "unverified",
          sourceIds: [],
          note: known
            ? "From our snapshot of Composio's managed-auth directory (2026-10-19); re-check the toolkit page."
            : "Not in our snapshot of Composio's managed-auth directory; check the toolkit page.",
        },
      },
      whenYouNeedYourOwn:
        known && !known.managed
          ? `Composio has no managed ${app} app, so you must register your own before any user can connect.`
          : `Bring your own ${app} OAuth app when you need your brand on the consent screen, your own rate limits, or scopes the managed app doesn't request.`,
      redirectUri: {
        value: COMPOSIO.redirectUri,
        evidence: { status: "documented", sourceIds: ["c1"], quote: COMPOSIO.redirectSource.quote, note: "Copy the exact URI your auth config shows in the Composio dashboard; some toolkits still default to the legacy v1 URL." },
      },
    },
    defaultScenarioId: (scenarios.find((x) => x.audience === "public") ?? scenarios[scenarios.length - 1]).id,
    scenarios,
    artifacts: planned.artifacts,
    openQuestions: classified.openQuestions,
    testLog: [],
    sources,
  });

  // ---------- 5. verify (code) ----------
  emit({ type: "stage", stage: "verify", status: "start" });
  const fetcher: PageFetcher = async (url) => {
    const raw = rawByUrl.get(url);
    return raw && raw.length > 200 ? { ok: true, text: raw } : httpFetcher(url);
  };
  const rows = await verifyGuide(guide, fetcher);
  const c = (r: string) => rows.filter((x) => x.result === r).length;
  emit({
    type: "stage",
    stage: "verify",
    status: "done",
    detail: `${rows.length} quoted claims: ${c("confirmed") + c("near-match")} confirmed, ${c("not-found")} downgraded to unverified`,
  });

  // ---------- 6. score (code) ----------
  emit({ type: "stage", stage: "score", status: "start" });
  const tiers = guide.scenarios.map((s) => `${s.label}: ${TIERS[assessFor(guide, s).tier].label}`);
  emit({ type: "stage", stage: "score", status: "done", detail: tiers.join(" · ") });
  return guide;
}
