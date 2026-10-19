# OAuth Runway

**How long until your users can connect your agent to an app?**

OAuth Runway gives developers building AI agents a clear, evidence-backed path to creating a provider OAuth app and getting it approved. For each app it shows:
- how hard it is
- the hands-on time versus the wait for approval
- the requirements that can block you
- which steps an agent can do for you and which ones you must do yourself

There's a curated library, and a research agent that generates a shareable guide live for any app.

- **Live app:** _<add Vercel URL>_
- **Walkthrough video:** _<add Loom URL>_
- **Verification write-up:** [VERIFICATION.md](VERIFICATION.md)

---

## The problem, as I understand it

An agent acts on a user's behalf in Gmail, Slack, HubSpot and other apps through OAuth. Three layers are involved:

1. **The provider OAuth app**: a client ID and secret registered with the provider. It sets the redirect URI, the scopes and the branding on the consent screen. Someone has to register it, and for public use the provider often has to **approve** it.
2. **The integration** (in Composio, an *auth config*): which OAuth app and scopes to use for a toolkit.
3. **Connections** (a *connected account* per end user): each user's tokens, created when they click "Connect".

Composio's **managed** apps (123 toolkits as of Oct 2026) let a developer skip layer 1 at first. Developers need **their own** OAuth app when they want:
- their brand on the consent screen instead of "Composio wants to access your account"
- their own rate limits
- scopes the managed app doesn't request
- a toolkit with no managed app at all (211 toolkits, e.g. X, Shopify, Xero)

Composio's own managed Slack and HubSpot apps are still waiting on marketplace approval. Even Composio waits.

The hard part is **rarely the code**. It's the approvals, and which of them apply depends on what you're building. Developers can't tell up front whether setup will take an hour or six weeks.

## What I learned (the insights that shaped the product)

1. **Difficulty depends on app × scopes × audience, not the app alone.** Gmail ranges from about an hour (your own Workspace, Internal) to about 6 weeks plus a yearly paid security assessment (public, with read access). So every guide is split into **scenarios**, and a single "Gmail: Hard" label would be wrong half the time.
2. **Two timelines, not one.** *First working connection* is usually minutes. *Production-ready* is hours of your own work plus days or weeks of waiting. Developers plan around the wait, so the guide shows the two separately.
3. **Most blockers aren't technical.** They're things like:
   - a privacy policy on a domain you own
   - domain verification
   - a demo video for reviewers
   - written justifications for each scope
   - business verification
   - install minimums (HubSpot needs 3 installs before listing, Slack 10)
   - approvals by your *customers'* admins (GitHub org restrictions, Slack app approval)

   An agent can draft almost all the paperwork. A person still has to log in, attest, pay, record and submit.
4. **Some gotchas only show up in the docs' fine print.** For example:
   - Since May 2025, Slack apps distributed outside the Marketplace get 1 request per minute on `conversations.history`. That's crippling for a read-heavy agent.
   - LinkedIn's Community Management API can only be requested on a brand-new app with no other products.
   - HubSpot AI-connector apps must be user-level, and you can't change that after creating the app.
   - Google requires you to own every domain in the OAuth client. Composio's default callback is on Composio's domain, so for verification you route the callback through your own domain, which Composio supports.

## Key decisions

| Decision | Why |
|---|---|
| **Focused slice: 5 curated guides spanning the difficulty range + live generation**, plus an index of Composio's other OAuth toolkits that generate on click | The brief asks for varied apps and the live flow, not volume. Depth and accuracy on 5 beat thin coverage of 100. |
| **GitHub, Slack, HubSpot, LinkedIn, Gmail** | Each shows a different setup challenge: instant / customer-admin approval / marketplace thresholds / gated partner API / security assessment. |
| **Difficulty is computed by a fixed rubric in code** ([src/lib/rubric.ts](src/lib/rubric.ts)) from yes/no requirements, each with evidence | It's reproducible and explainable, with no "AI vibes". The page shows *why* each tier was assigned. |
| **Three evidence labels: ✅ tested / 📄 documented / ❓ unverified** | Being honest about uncertainty is part of the product. All time estimates are marked unverified unless someone actually timed them. |
| **Quotes are checked in code** ([src/lib/verify.ts](src/lib/verify.ts)) | The LLM proposes a quote plus a source. The verifier fetches the page and downgrades the claim if the quote isn't there. The model never sets its own evidence status. |
| **Every step is labelled 🤖 agent / 🤝 agent prepares, you submit / 👤 you**, and agents produce **drafts** (manifests, scope justifications, Limited Use text, listing copy) | This answers "what can an agent do for me, and where do I take over?" |
| **Free-tier stack, no credit card**: Groq `openai/gpt-oss-120b` (Gemini as a fallback) via the Vercel AI SDK, and **no search API** | ₹0 to run. The search APIs needed a card, and keyless search engines block bots, so the agent **crawls the provider's docs itself** (next row). The 8k tokens-per-minute budget pushed another good choice: the model sees only short, relevant excerpts of official docs. |
| **Built-in docs crawler** ([src/lib/agent/crawl.ts](src/lib/agent/crawl.ts)) | The model suggests the docs domain and likely URLs. Code **fetches every suggestion** and drops the ones that don't exist. In testing, the model invented 6–8 of its ~8 URLs for Zoom, and none survived. The crawler probes `developers.`/`docs.` hosts, reads the sitemap and `llms.txt`, ranks pages by topic (create / review / scopes / auth), and uses Jina Reader (free, no key) for JS-only pages. Tavily is used instead if a key is set. |
| **In agent-generated guides, only evidence counts toward difficulty** | A small model over-claims. On Xero it marked security assessment, business verification, a demo video and "a 100-user cap" (Google's rule) as required, with no source. Now a requirement raises the tier only if its quote was confirmed. Unconfirmed claims are shown as "could be up to <tier>". Curated guides count reviewed unverified items. |
| **Shareable everywhere**: permalinks per scenario (`/guides/gmail#testing`), Markdown export, and a JSON API | Developers paste guides into tickets. Agent builders can call `/api/guides/:slug` from their own agents. |
| **No database** | Curated guides are JSON in the repo, so they're reviewable in PRs. Generated guides go to Vercel Blob, or a local folder in dev. |

## How the live agent works

```
input ("zoom.us")
 → resolve   LLM names the provider, docs domains, portal and candidate URLs
 → research  CODE: verify candidate URLs exist, probe docs hosts, read sitemap/llms.txt,
             rank pages by topic, fetch (direct or Jina Reader); keep full page text
 → classify  LLM: scenarios + requirement facts, each with {quote, source}  (excerpts only)
 → plan      LLM: steps, blockers, agent/human labels, drafts
 → verify    CODE: each quote searched on its page → documented or downgraded
 → score     CODE: rubric → tier per scenario
 → save      shareable /guides/<slug>, streamed progress to the browser (NDJSON)
```

The stages are visible live on `/generate`. If a free-tier rate limit hits, the agent says so and waits rather than failing. If the model's JSON is cut off at the token limit, it's repaired by keeping every complete item. Small-model shape drift (booleans in text fields, bare values instead of objects) drops only the bad item, never a whole list.

**Live runs on apps outside the library** (free tier, Oct 2026):

| App | Time | Pages read | Quotes confirmed / downgraded | Result |
|---|---|---|---|---|
| Zoom | 61 s | 8 (create app, submit for review, review guidelines, scopes) | 16 / 2 | Instant → Review for production |
| Calendly | 43 s | 8 | 11 / 0 | Instant (docs mention no review; flagged as an open question) |
| Notion | ~60 s | 6 | 7 / 1 | Instant → Review for production |
| Xero | 22–39 s | 8 | 4–8 / 3 | Instant, could be up to Gated (partner program claimed, but the quote wasn't confirmed) | With no API keys the app runs in **demo mode**: the library works fully, and generation produces a placeholder that is clearly labelled as one.

## Evidence & verification (summary)

- **264 quoted claims** across the 5 curated guides, **264/264 confirmed** on the live source pages by the automated verifier (`npm run verify`, report in [data/verification-report.md](data/verification-report.md)). The first run found 10 misses, which turned out to be a verifier bug: Google served translated pages.
- A separate **reviewer agent** audited 48 high-impact claims for whether the quote actually *supports* the value. 21 needed changes, even though every one of them had a real quote. Examples: a HubSpot scope that would get a Marketplace listing rejected; Slack's Real-time Search API being unavailable to unlisted apps. One reviewer correction was **overruled** after checking the full source passage. Details in [VERIFICATION.md](VERIFICATION.md).
- **Console walkthroughs** (✅ tested): see [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) and VERIFICATION.md for what was tested by hand.

## Run it locally

```bash
cd oauth-runway
npm install
cp .env.example .env.local   # optional: add free keys (see below)
npm run dev                  # http://localhost:3000
```

| Variable | Needed for | Free key |
|---|---|---|
| `GROQ_API_KEY` (+ optional `GROQ_MODEL`, default `openai/gpt-oss-120b`) | live generation (primary LLM) | console.groq.com |
| `GOOGLE_GENERATIVE_AI_API_KEY` (+ `GEMINI_MODEL`) | live generation (fallback LLM, used if Groq is unset) | aistudio.google.com |
| `TAVILY_API_KEY` | web research | app.tavily.com |
| `BLOB_READ_WRITE_TOKEN` | persisting generated guides on Vercel | Vercel → Storage → Blob |

Scripts:
- `npm run validate`: schema-check all curated guides
- `npm run verify`: re-check every quote against the live pages and write the report
- `npm test`: offline pipeline test with canned search and LLM responses. It checks quote downgrading, ID normalization and scoring.

**Deploy:** import the repo in Vercel, set the env vars above, and create a Blob store (Storage → Blob → connect to project). `/api/generate` sets `maxDuration = 300`.

## Limitations

- **Time ranges are estimates** unless marked tested. Providers rarely publish review SLAs.
- **Live guides aren't reviewed by a person.** Free-tier models are weaker than frontier models, and unverified items are leads, not facts. The verifier catches invented quotes, but it can't catch a correct quote that's been misread.
- **Discovery without a search engine is incomplete.** The crawler can only read pages it can find from the docs sitemap and links. Two runs on the same app can read different pages, and a key policy page can be missed. For example, one Xero run missed the page on Xero's connection limit for uncertified apps. Evidence gating keeps the result honest rather than complete. Adding a search key (Tavily) or a frontier model improves coverage without code changes.
- **JS-rendered docs** can't be checked with a plain fetch. They're flagged "not auto-checked" rather than trusted.
- **No approvals were completed** and no paid accounts were used. Review-stage claims come from documentation, not experience.
- **Composio managed-app status** comes from a snapshot of the directory (Oct 2026) for apps outside the library.

## What I'd do next

1. **The path to 100:** batch-generate guides for the 211 bring-your-own toolkits first (no managed fallback, so the most pain), then put them through a human review queue before they're marked curated.
2. **Freshness:** a weekly job that re-runs `verify` and flags guides whose quotes disappeared, since a missing quote is a signal the provider changed a policy.
3. **Feedback loop:** a "this step was wrong" button on each step, feeding the review queue.
4. **Agent-in-the-loop setup:** for providers with APIs or manifests (Slack manifests, HubSpot CLI, Composio auth-config API), let the agent create the app and auth config directly, not just draft them.
5. **An MCP server** exposing `get_oauth_guide(app, scenario)` so coding agents can plan an integration before writing code.

## Repo map

```
data/guides/*.json          curated guides (schema: src/lib/schema.ts)
data/composio-context.md    Composio research with verbatim quotes
src/lib/rubric.ts           difficulty rubric (code)
src/lib/verify.ts           quote verifier (code)
src/lib/agent/              live research pipeline (pipeline, llm, search, demo)
src/app/                    pages + API routes
scripts/                    validate / verify / offline pipeline test
```
