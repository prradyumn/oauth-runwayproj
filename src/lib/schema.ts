import { z } from "zod";

/**
 * Guide schema. One guide = one provider app. A guide holds several
 * scenarios because difficulty depends on app x scopes x audience, not on
 * the app alone (e.g. Gmail for your own workspace vs Gmail for the public).
 */

// How we know a claim is true.
// - tested:      a person or agent actually did it in the provider console
// - documented:  an official source says so, and we hold the exact quote
// - unverified:  inferred, community-reported, or the quote could not be confirmed
export const EvidenceStatus = z.enum(["tested", "documented", "unverified"]);
export type EvidenceStatus = z.infer<typeof EvidenceStatus>;

export const Evidence = z.object({
  status: EvidenceStatus,
  sourceIds: z.array(z.string()).default([]),
  // Verbatim sentence copied from the source page. The verifier checks it in code.
  quote: z.string().optional(),
  note: z.string().optional(),
  // Written by the verifier (verify.ts), not by the LLM.
  check: z
    .object({
      result: z.enum(["confirmed", "near-match", "not-found", "unreachable"]),
      checkedAt: z.string(),
      url: z.string().optional(),
    })
    .optional(),
});
export type Evidence = z.infer<typeof Evidence>;

export const Source = z.object({
  id: z.string(), // short id like "s1"
  url: z.string().url(),
  title: z.string(),
  kind: z.enum(["official", "community", "composio", "test-log"]),
  accessed: z.string(), // YYYY-MM-DD
});
export type Source = z.infer<typeof Source>;

// Who does a step.
// - agent: an agent can do it end to end (draft text, check config, call an API)
// - human: needs a person (login, CAPTCHA, legal attestation, payment, recording video)
// - both:  agent prepares, human submits/approves
export const Actor = z.enum(["agent", "human", "both"]);
export type Actor = z.infer<typeof Actor>;

const Fact = <T extends z.ZodTypeAny>(value: T) =>
  z.object({ value, evidence: Evidence });

// Rubric inputs. The difficulty tier is computed from these in code (rubric.ts),
// never chosen by the LLM.
export const Factors = z.object({
  selfServeCreate: Fact(z.boolean()), // can anyone create the OAuth app with a free account?
  reviewRequired: Fact(z.boolean()), // provider must approve before this audience can use it
  securityAssessment: Fact(z.boolean()), // third-party audit, e.g. Google CASA
  businessVerification: Fact(z.boolean()), // legal entity / business docs checked
  partnerApproval: Fact(z.boolean()), // gated program / application that can be refused
  paidAccessRequired: Fact(z.boolean()), // API access itself costs money
  userCapBeforeReview: Fact(z.number().int().nullable()), // e.g. 100 users for unverified Google apps; null = no cap / n.a.
  demoVideoRequired: Fact(z.boolean()),
  privacyPolicyRequired: Fact(z.boolean()),
  domainVerification: Fact(z.boolean()),
  // The *end customer's* admin must approve the app (GitHub org restrictions, Slack app
  // approval, Workspace admin allowlists). Not a provider review, but it blocks real users.
  customerAdminApproval: Fact(z.boolean()).optional(),
});
export type Factors = z.infer<typeof Factors>;

const Range = z.tuple([z.number(), z.number()]);

export const Timeline = z.object({
  // Timeline 1: first working connection (your own account, dev/test mode)
  firstConnection: z.object({
    handsOnMinutes: Range,
    note: z.string(),
  }),
  // Timeline 2: production-ready for this scenario's audience
  production: z.object({
    handsOnHours: Range,
    waitDays: Range.nullable(), // null = no provider wait
    note: z.string(),
  }),
  evidence: Evidence,
});
export type Timeline = z.infer<typeof Timeline>;

export const Step = z.object({
  id: z.string(),
  phase: z.enum(["prepare", "create", "configure", "connect", "review", "launch"]),
  title: z.string(),
  detail: z.string(), // markdown allowed (short)
  actor: Actor,
  agentCan: z.string().optional(), // what the agent does for you here
  humanMust: z.string().optional(), // what only you can do
  links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  values: z.array(z.object({ label: z.string(), value: z.string() })).default([]), // exact values to paste
  estMinutes: z.number().optional(),
  evidence: Evidence,
});
export type Step = z.infer<typeof Step>;

export const Blocker = z.object({
  title: z.string(),
  symptom: z.string(), // what you see
  whatToDo: z.string(), // how to proceed
  evidence: Evidence,
});
export type Blocker = z.infer<typeof Blocker>;

export const Scope = z.object({
  name: z.string(),
  purpose: z.string(),
  sensitivity: z.enum(["basic", "sensitive", "restricted", "gated"]),
});

export const Scenario = z.object({
  id: z.string(),
  label: z.string(), // e.g. "Public app, restricted Gmail scopes"
  audience: z.enum(["self", "internal", "public"]),
  description: z.string(),
  scopes: z.array(Scope),
  factors: Factors,
  timeline: Timeline,
  steps: z.array(Step),
  blockers: z.array(Blocker).default([]),
});
export type Scenario = z.infer<typeof Scenario>;

export const Artifact = z.object({
  title: z.string(), // e.g. "Scope justification (draft)"
  forStepId: z.string().optional(),
  content: z.string(), // markdown; drafted by the agent, edited by the human
});

export const TestLogEntry = z.object({
  date: z.string(),
  by: z.string(), // "human" or "agent"
  what: z.string(),
  observed: z.string(),
  minutes: z.number().optional(),
  screenshot: z.string().optional(), // path under /public/evidence
});

export const Guide = z.object({
  slug: z.string(),
  app: z.object({
    name: z.string(),
    website: z.string().url(),
    category: z.string(),
    developerPortalUrl: z.string().url(),
    docsUrl: z.string().url(),
  }),
  origin: z.enum(["curated", "agent"]), // curated = researched + human-checked library guide
  lastVerified: z.string(), // YYYY-MM-DD
  summary: z.string(), // 2-3 sentences: the honest bottom line
  composio: z.object({
    // Does Composio offer a managed OAuth app for this toolkit, and when do you need your own?
    managedAppAvailable: Fact(z.boolean().nullable()),
    whenYouNeedYourOwn: z.string(),
    redirectUri: Fact(z.string().nullable()),
  }),
  defaultScenarioId: z.string(),
  scenarios: z.array(Scenario).min(1),
  artifacts: z.array(Artifact).default([]),
  openQuestions: z.array(z.string()).default([]), // what remains uncertain
  testLog: z.array(TestLogEntry).default([]),
  sources: z.array(Source),
});
export type Guide = z.infer<typeof Guide>;
