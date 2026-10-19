import { TIERS, type Tier } from "@/lib/rubric";
import { STAGES } from "@/lib/agent/events";
import { TierChip } from "@/components/ui";

export const metadata = { title: "How it works — OAuth Runway" };

const RULES: [Tier, string][] = [
  [4, "You can't create the app self-serve, OR a separate partner/API-access program must approve you, OR API access needs a paid tier."],
  [3, "A third-party security assessment (e.g. Google CASA) OR business/legal-entity verification is required."],
  [2, "The provider must review the app before this audience can connect."],
  [1, "Works without review, but capped (e.g. 100 test users) or your customers' admins may have to approve it."],
  [0, "None of the above: create the app, paste credentials, connect."],
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-12 text-[15px] leading-relaxed">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
        <p className="text-muted">
          OAuth Runway answers one question for a developer shipping an AI agent: <em>what does it take before my users can connect this app, and how long
          will it take?</em>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The problem in one picture</h2>
        <div className="card p-4 font-mono text-xs leading-6 overflow-x-auto whitespace-pre">
{`Provider OAuth app (client ID + secret, redirect URI, scopes, branding)
   │   registered once by the developer — or by Composio ("managed")
   ▼
Composio auth config (which OAuth app + scopes to use for a toolkit)
   │
   ├── connected account: user A's tokens
   ├── connected account: user B's tokens
   └── ...one per end user who clicks "Connect"`}
        </div>
        <p>
          Composio&apos;s managed apps let you start immediately. You need <strong>your own</strong> OAuth app for your brand on the consent screen,
          your own rate limits, extra scopes, or toolkits with no managed app. That is where the pain is: each provider has its own console, its own
          review process and its own hidden requirements. The hard part is rarely the code. It&apos;s approvals, verification and waiting.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Difficulty depends on app × scopes × audience</h2>
        <p>
          &ldquo;Gmail&rdquo; isn&apos;t one difficulty. Testing with your own account takes about an hour, but a public agent that reads mail needs
          Google&apos;s restricted-scope verification and a yearly security assessment. So each guide has several <strong>scenarios</strong>, and each
          scenario gets two timelines: <strong>① first working connection</strong> and <strong>② production-ready</strong>, which splits your hands-on
          work from the time you spend waiting on the provider.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The difficulty rubric (code, not AI)</h2>
        <p>Each scenario records yes/no requirements with evidence. A fixed rule picks the tier, and the highest matching rule wins:</p>
        <div className="card divide-y divide-border">
          {RULES.map(([t, rule]) => (
            <div key={t} className="p-3 flex gap-3 items-start">
              <div className="w-48 shrink-0"><TierChip tier={t} /></div>
              <div className="text-sm">{rule}</div>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">
          Demo video, domain verification and privacy-policy requirements are listed as reasons, but they don&apos;t raise the tier on their own. They
          come with the review that already set it. Tier labels: {Object.values(TIERS).map((t) => t.label).join(" · ")}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Evidence: three labels, checked in code</h2>
        <ul className="space-y-2">
          <li>✅ <strong>Tested</strong>: a person did it in the provider console and logged what they saw (with screenshots where possible).</li>
          <li>📄 <strong>Documented</strong>: an official source says so, and we hold the exact sentence. A verifier fetches the page and checks the
            sentence is really there. If it isn&apos;t, the claim is <em>automatically downgraded</em>.</li>
          <li>❓ <strong>Unverified</strong>: estimates (all time ranges), inferences, community reports, or anything we couldn&apos;t confirm.
            They&apos;re shown with a note, not hidden.</li>
        </ul>
        <p className="text-sm text-muted">
          A matching quote proves the sentence exists, not that we read it correctly. For the library guides, a separate reviewer agent also checked that
          each quote really supports the claimed value. See VERIFICATION.md in the repo.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The live research agent</h2>
        <ol className="list-decimal pl-5 space-y-1">
          {STAGES.map((s) => <li key={s.id}>{s.label}</li>)}
        </ol>
        <p>
          The LLM proposes facts, each with a quote and a source id. Code decides the evidence status (verifier) and the difficulty (rubric). The model
          only sees short, relevant excerpts of the official docs, which keeps it within free-tier limits and leaves little room to invent. Each step is
          labelled 🤖 agent, 🤝 agent prepares and you submit, or 👤 you. That last one covers logins, legal attestations, payments, demo videos and
          submissions.
        </p>
      </section>

      <section id="api" className="space-y-3">
        <h2 className="text-xl font-semibold">API for agent builders</h2>
        <div className="card p-4 font-mono text-xs leading-6 overflow-x-auto whitespace-pre">
{`GET  /api/guides                         # index with difficulty per guide
GET  /api/guides/gmail                   # full guide JSON + computed tiers
GET  /api/guides/gmail?format=md         # Markdown (paste into a ticket / PR)
GET  /api/guides/gmail?format=md&scenario=testing
POST /api/generate {"input":"zoom.us"}   # NDJSON stream of agent events → guide`}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Limitations</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Time ranges are estimates unless marked tested. Providers rarely publish review times.</li>
          <li>Live guides aren&apos;t reviewed by a person. Unverified items are leads, not facts.</li>
          <li>Pages that only render with JavaScript can&apos;t be checked automatically. These are flagged &ldquo;not auto-checked&rdquo;.</li>
          <li>Provider rules change. Every guide shows its last-verified date and sources.</li>
          <li>No approvals were completed and no paid accounts were used.</li>
        </ul>
      </section>
    </div>
  );
}
