// Offline test of the live pipeline with canned search + LLM responses.
// Usage: npx tsx scripts/test-pipeline.ts
import { runPipeline } from "../src/lib/agent/pipeline";
import { assess, TIERS } from "../src/lib/rubric";

const page = `Create an OAuth app in the Acme developer console. Every app must be reviewed by Acme before it can be installed by other organizations. Unreviewed apps can be installed by up to 10 users. You must provide a privacy policy URL before submitting for review. Redirect URIs must use HTTPS.`;
const hit = (url: string) => ({ url, title: "Acme OAuth docs", content: page.slice(0, 200), raw: page.repeat(3) });

const answers: unknown[] = [
  { appName: "Acme", website: "https://acme.example", category: "CRM", developerPortalUrl: "https://dev.acme.example/apps", docsUrl: "https://dev.acme.example/oauth", officialDomains: ["dev.acme.example"], supportsOAuth: true, notes: "" },
  {
    summary: "Easy to test, review needed for other orgs.",
    openQuestions: ["Review time is not published."],
    scenarios: [
      { id: "Testing Mode", label: "Your own account", audience: "self", description: "Dev", scopes: [{ name: "read", purpose: "read", sensitivity: "basic" }],
        factors: { selfServeCreate: { value: true, quote: "Create an OAuth app in the Acme developer console.", src: "s1" }, userCapBeforeReview: { value: 10, quote: "Unreviewed apps can be installed by up to 10 users.", src: "s1" } },
        timeline: { firstConnectionMinutes: [10, 20], productionHandsOnHours: [0, 0], productionWaitDays: null, note: "" } },
      { id: "public", label: "Any customer", audience: "public", description: "Prod", scopes: [],
        factors: { reviewRequired: { value: true, quote: "Every app must be reviewed by Acme before it can be installed by other organizations.", src: "s1" },
                   privacyPolicyRequired: { value: true, quote: "This sentence is invented and not on the page at all okay.", src: "s1" } },
        timeline: { firstConnectionMinutes: [10, 20], productionHandsOnHours: [2, 4], productionWaitDays: [5, 10], note: "Review." } },
    ],
  },
  {
    scenarios: [
      { id: "testing-mode", steps: [{ phase: "create", title: "Create app", detail: "In console", actor: "human", url: "dev.acme.example/apps", values: [{ label: "Redirect URI", value: "x" }], quote: "Redirect URIs must use HTTPS.", src: "s1" }], blockers: [] },
      { id: "public", steps: [{ phase: "review", title: "Submit for review", detail: "Submit", actor: "both", quote: null, src: null }], blockers: [{ title: "Rejected", symptom: "email", whatToDo: "fix", quote: null, src: null }] },
    ],
    artifacts: [{ title: "App description", content: "Draft" }],
  },
];

(async () => {
  let i = 0;
  const guide = await runPipeline("Acme", (e) => console.log(" ·", e.type, "stage" in e ? `${e.stage} ${e.status} ${e.detail ?? ""}` : "message" in e ? e.message : ""), {
    model: { model: null as never, name: "Fake" },
    search: async (q) => [hit(`https://dev.acme.example/oauth?q=${encodeURIComponent(q).slice(0, 10)}`)],
    askJSON: async () => answers[i++],
  });
  const fails: string[] = [];
  const pub = guide.scenarios.find((s) => s.id === "public")!;
  if (guide.scenarios[0].id !== "testing-mode") fails.push("scenario id not normalised");
  if (guide.defaultScenarioId !== "public") fails.push("default scenario should be public");
  if (pub.factors.privacyPolicyRequired.evidence.status !== "unverified") fails.push("invented quote was not downgraded");
  if (pub.factors.reviewRequired.evidence.status !== "documented") fails.push("real quote should stay documented");
  if (assess(pub.factors).tier !== 2) fails.push(`public tier should be 2, got ${assess(pub.factors).tier}`);
  if (assess(guide.scenarios[0].factors).tier !== 1) fails.push("testing tier should be 1 (user cap)");
  if (guide.scenarios[0].steps[0].links[0]?.url !== "https://dev.acme.example/apps") fails.push("step URL not normalised");
  if (guide.composio.redirectUri.evidence.status !== "documented") fails.push("Composio redirect URI should be documented");
  console.log(guide.scenarios.map((s) => `${s.id}: ${TIERS[assess(s.factors).tier].label}`).join(" | "));
  console.log(fails.length ? `FAIL\n- ${fails.join("\n- ")}` : "PASS: pipeline assembles, verifies and scores correctly");
  process.exit(fails.length ? 1 : 0);
})();
