import { Guide, type Evidence } from "../schema";
import { slugify } from "../store";
import { COMPOSIO } from "../composio";
import { STAGES, type Emit } from "./events";

/**
 * Demo mode: used when no LLM/search keys are configured. Replays the pipeline's
 * stages so the UI can be exercised, and returns a clearly-labelled placeholder
 * guide in which every claim is "unverified". It never pretends to be research.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const U = (note = "Demo mode: no research was performed."): Evidence => ({ status: "unverified", sourceIds: [], note });
const F = <T,>(value: T) => ({ value, evidence: U() });

export async function runDemo(input: string, emit: Emit): Promise<Guide> {
  const name = input.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const app = name.charAt(0).toUpperCase() + name.slice(1);
  emit({ type: "log", message: "Demo mode — add GROQ_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) and TAVILY_API_KEY to run real research." });
  for (const s of STAGES) {
    emit({ type: "stage", stage: s.id, status: "start" });
    await sleep(500);
    emit({ type: "stage", stage: s.id, status: "done", detail: "simulated" });
  }
  const today = new Date().toISOString().slice(0, 10);
  const base = {
    selfServeCreate: F(true),
    reviewRequired: F(false),
    securityAssessment: F(false),
    businessVerification: F(false),
    partnerApproval: F(false),
    paidAccessRequired: F(false),
    userCapBeforeReview: F<number | null>(null),
    demoVideoRequired: F(false),
    privacyPolicyRequired: F(false),
    domainVerification: F(false),
  };
  return Guide.parse({
    slug: `demo-${slugify(name)}`,
    app: { name: app, website: `https://${name.includes(".") ? name : name + ".com"}`, category: "Unknown", developerPortalUrl: `https://${name.includes(".") ? name : name + ".com"}`, docsUrl: `https://${name.includes(".") ? name : name + ".com"}` },
    origin: "agent",
    lastVerified: today,
    summary: `DEMO MODE placeholder for ${app}. No research ran because API keys aren't configured; every statement below is a generic template, not a finding.`,
    composio: {
      managedAppAvailable: F(null),
      whenYouNeedYourOwn: "Bring your own OAuth app for your branding on the consent screen, your own rate limits, or custom scopes.",
      redirectUri: F(COMPOSIO.redirectUri),
    },
    defaultScenarioId: "public",
    scenarios: [
      {
        id: "public",
        label: "Public app (template)",
        audience: "public",
        description: "Generic template.",
        scopes: [],
        factors: { ...base, reviewRequired: F(true), privacyPolicyRequired: F(true) },
        timeline: { firstConnection: { handsOnMinutes: [15, 45], note: "Template." }, production: { handsOnHours: [1, 4], waitDays: [3, 14], note: "Template." }, evidence: U() },
        steps: [
          { id: "p1", phase: "create", title: "Create an OAuth app in the developer portal", detail: "Template step.", actor: "human", humanMust: "Log in and create the app.", evidence: U() },
          { id: "p2", phase: "configure", title: "Register Composio's redirect URI", detail: "Template step.", actor: "human", values: [{ label: "Redirect URI", value: COMPOSIO.redirectUri ?? "" }], evidence: U() },
          { id: "p3", phase: "connect", title: "Paste client ID and secret into a Composio auth config", detail: "Template step.", actor: "both", agentCan: "Create the auth config via the Composio API and run a test connection.", evidence: U() },
        ],
        blockers: [],
      },
    ],
    openQuestions: ["Everything — this is a demo placeholder."],
    sources: [],
  });
}
