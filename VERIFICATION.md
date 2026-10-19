# Verification: what we tested, what sources support, what we corrected

Guidance about approvals is only useful if it's right, so every claim in a guide carries one of three labels:

| Label | Meaning | How it's earned |
|---|---|---|
| ✅ Tested | Someone did it in the provider console | Walkthrough notes and screenshots in `public/evidence/` (see [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)) |
| 📄 Documented | An official source says it, with the exact sentence | The quote must be found on the live page by `src/lib/verify.ts`, or the claim is downgraded |
| ❓ Unverified | Estimate, inference or community report | Shown with a note explaining why |

The library guides went through four checks:

1. **Research agents** (one per app) read the official docs and wrote each guide with verbatim quotes.
2. **Automated quote verification** (`npm run verify`): every quote is fetched and searched for in code.
3. **An adversarial reviewer agent** checked whether each quote actually *supports* the claimed value. A quote can exist on the page and still be misread.
4. **Console walkthroughs** by a person, for the parts that can be done free and without submitting for review.

## 1. Automated quote check

Report: [data/verification-report.md](data/verification-report.md). Latest run: **264 of 264 quoted claims confirmed** on the live pages, after the audit corrections below.

| Guide | Quoted claims | Confirmed |
|---|---|---|
| GitHub | 27 | 27 |
| Gmail | 97 | 97 |
| HubSpot | 50 | 50 |
| LinkedIn | 41 | 41 |
| Slack | 49 | 49 |

The first run was **250/260**, and investigating the 10 misses taught us something about the verifier itself (correction V1 below).

## 2. Corrections log

### Verifier and method

| # | What happened | What we changed |
|---|---|---|
| V1 | 10 Gmail quotes "not found", but the Gmail agent had confirmed them. Re-fetching showed Google returning **different page variants per request** (34–36k chars), because the verifier sent no `Accept-Language` header and sometimes got a translated page. | The verifier sends `Accept-Language: en` and re-fetches twice before downgrading. Re-runs also re-check previously downgraded claims. Result: 260/260. |
| V2 | Tag stripping produced `Branding , Audience` while the quote said `Branding, Audience`. | Normalize spacing before punctuation. |
| V3 | **A rubric gap.** GitHub reviews nothing, so a public GitHub app scored "Instant". But org owners at your customers may have to approve the app before it can see org data, and new orgs restrict OAuth apps by default. The same pattern applies to Slack app approval and Google Workspace admin trust settings. | Added a `customerAdminApproval` factor (tier 1: "Self-serve with limits") and set it for GitHub public, Slack own-workspace and distributed, and Gmail internal. |
| V4 | **A definition problem.** The Slack agent marked Marketplace listing as "partner approval" because Slack "may use their judgment to deny any app". That pushed Slack to "Gated", the same tier as LinkedIn's partner-only API. | Clarified that `partnerApproval` means a *separate* access program; any review can refuse you, and that's `reviewRequired`. Slack Marketplace is now "Review for production". The live agent's prompt carries the same clarification. |

### Content

| # | Guide | What was wrong or missing | Correction | Source |
|---|---|---|---|---|
| C1 | All | Research agents left the redirect URI as a placeholder | Set to Composio's documented callback `https://backend.composio.dev/api/v3/toolkits/auth/callback`, noting that some toolkits still default to the legacy `/api/v1/auth-apps/add`, so copy what your auth config shows | Composio docs, programmatic auth configs |
| C2 | All | "Do you need your own app?" was unknown | All 5 have Composio-managed apps (toolkit pages: "Composio-managed OAuth available? Yes"). Added caveats: Composio's own Slack app is in Marketplace review, its HubSpot app awaits HubSpot approval, and its Google app covers only its verified default scopes | Composio toolkit pages |
| C3 | Gmail | Google requires you to verify ownership of every domain in the OAuth client configuration, but Composio's default callback is on `backend.composio.dev` | Added the step "Route the OAuth callback through your own domain", which Composio documents. That Google *requires* this is our inference, and it's marked as such | Google verification docs + Composio white-labeling docs |

## 3. Adversarial claim audit

A separate reviewer agent re-read the sources for **48 high-impact claims**: every tier-deciding factor, the timelines and the main gotchas. It also searched for 2025–26 changes. Full table: [data/claim-audit.md](data/claim-audit.md).

| Verdict | Count |
|---|---|
| Supported | 27 |
| Overstated | 6 |
| Understated | 5 |
| Wrong | 2 |
| Missing | 6 |
| Can't verify | 2 |

**A quote can be real and still mislead.** All 21 non-supported findings had quotes that passed the automated check. That's why both layers exist.

### Corrections applied (ranked by impact on a developer's decision)

| # | Guide | Was | Now | Evidence |
|---|---|---|---|---|
| A1 | HubSpot | Marketplace scenario requested `crm.objects.contacts.sensitive.read` ("avoid unless essential") | **Removed.** Listed apps may not request sensitive scopes at all, so that request would get the listing rejected | "Your app must not access, request, or use sensitive data scopes" |
| A2 | Gmail | Composio-callback-domain issue left as an open question | A required **prepare** step with documented Composio support for routing the callback through your own domain | Composio white-labeling docs |
| A3 | Slack | Marketplace scope `search:read` (the guide itself said to leave it out) | `search:read.public` (Real-time Search API) | Slack RTS API docs |
| A4 | Slack | Missing: unlisted apps can't use the Real-time Search API, Slack's sanctioned way for agents to read context | Added as a blocker for unlisted distribution; that scenario is relabelled "pilots only" | "The RTS API is available for directory-published apps and internal apps only." |
| A5 | Gmail | Internal Workspace: customer-admin approval = yes (Tier 1) | **No** (Tier 0). Only needed if your admin has restricted Gmail | Google Workspace Admin Help |
| A6 | Slack | Own workspace: customer-admin approval = yes (Tier 1) | **No** (Tier 0). Only "some workspaces" restrict installs, and here the admin is your own | Slack distribution docs |
| A7 | Gmail | Send-only wait 3–21 days | **14–42 days.** Brand review must finish before the 10-business-day scope review starts | Google verification timelines |
| A8 | LinkedIn | Summary said refresh tokens are partner-only "in both cases" | Only the self-serve case lacks refresh tokens; approved Community Management apps are expected to use them | LinkedIn programmatic refresh tokens |
| A9 | LinkedIn | Missing: self-serve scopes are write-only | Blocker added: the agent can post but can't read the member's posts (`r_member_social` is closed) | LinkedIn Community Management FAQ |
| A10 | LinkedIn | Technical Sign Off described as "may be required" | A blocker: Sign Off expects a full community-management product. Hands-on upper bound raised to 80 h | LinkedIn integration requirements |
| A11 | GitHub | Missing: enterprise IP allow lists also apply to OAuth app tokens | Blocker added | GitHub IP allow list docs |
| A12 | HubSpot | Missing: user-level apps get no webhooks, app cards or workflow actions | Added to the access-level decision step, plus an open question about Composio triggers | HubSpot user-level apps docs |
| A13 | Slack | Marketplace install threshold: 10 workspaces | 10 active workspaces **and 10 weekly active users** (since July 2026) | Slack Marketplace guidelines and changelog |
| A14 | Gmail | Suggested `gmail.metadata` as a narrower alternative | Corrected: `gmail.metadata` is also restricted (still needs CASA). Only `gmail.send`/`gmail.labels` avoid it | Gmail scopes table |
| A15 | Gmail | The "lifetime 100-user cap" blocker appeared under Testing | Moved: it belongs to unverified *production* apps; Testing has a separate test-user quota | Google unverified-apps docs |

### Where we overruled the reviewer

| # | Reviewer said | What we found | Decision |
|---|---|---|---|
| R1 | Slack Marketplace: demo video is **required** (quote: "For a new submission, it should include a video showing the full installation and OAuth flow.") | The verifier flagged the quote as a near-match. The full passage begins: "You can help us review your app more quickly by providing us with a short video demo." It's a recommendation that speeds up review | Kept **not required, strongly recommended**. A reviewer can overstate too, so its edits go through the same verification |

## 3b. Live agent: what testing it on unfamiliar apps taught us

We ran the live agent on apps outside the library (Zoom, Calendly, Xero, Notion), using the free Groq tier and no search API.

| Finding | Evidence | Change |
|---|---|---|
| The model invents docs URLs | Zoom: 6–8 of ~8 suggested URLs didn't exist (e.g. `marketplace.zoom.us/docs/guides/publish/app-review`) | Code fetches every suggested URL and drops dead ones. Real pages come from the sitemap and links |
| The model names the marketing domain, not the docs host | Zoom run: `zoom.us`; 5,454 sitemap pages, 0 relevant | The crawler probes `developers.` / `developer.` / `docs.` hosts and filters to docs-like pages |
| A small model over-claims requirements | Xero: security assessment, business verification, demo video, domain verification and a "100-user cap" (Google's number) were all marked required, with no source | In agent guides, only quote-confirmed requirements raise the tier. The rest appear as "could be up to …" |
| The verifier catches misattributed quotes | Zoom 2/18, Xero 3/7, Notion 1/8 quotes not on the cited page → downgraded | Working as designed |
| Model output drifts from the requested JSON shape | Factors returned as bare `true` instead of `{value, quote}`; booleans in text fields. One bad field silently emptied all steps (0 steps on the first Zoom run) | Lenient parsing per item, plus repair of truncated JSON |
| The free tier has an undocumented output-tokens-per-minute cap | `qwen/qwen3.8-27b`: 1,000 output tokens/min, too small for one guide | Switched to `openai/gpt-oss-120b` with `reasoning_effort: low` |
| Coverage varies between runs | Two Xero runs read different page sets; one missed the partner-program page | Documented as a limitation. A search key or a stronger model improves coverage |

## 4. Console walkthroughs (✅ tested)

_Pending: see [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md). Each walkthrough adds `testLog` entries to its guide and upgrades the claims it confirms._

## 5. What we could not verify

- **Review wait times.** Most providers publish no SLA. Google gives non-guaranteed estimates (about 6 weeks for restricted scopes), Slack gives "up to 10 business days" for the first Marketplace review, and HubSpot says first feedback comes within 10 business days. All other ranges are estimates.
- **CASA cost and duration** for a new app. It depends on the assessor, and Google charges no fee.
- **Anything behind a login or a submission**: exact console button labels, the contents of Slack's Manage Distribution checklist, LinkedIn's review outcomes.
- **Composio dashboard values.** The docs say to copy the redirect URI the dashboard shows. We used the documented value.

Each guide's "Still uncertain" section lists its open questions.
