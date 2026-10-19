import type { Factors, Guide, Scenario } from "./schema";

/**
 * Difficulty is computed from extracted facts, never chosen by an LLM.
 * The highest matching rule wins. Each tier explains *why* it was assigned,
 * so the developer sees the cause, not just a label.
 */
export type Tier = 0 | 1 | 2 | 3 | 4;

export const TIERS: Record<Tier, { label: string; short: string; blurb: string }> = {
  0: { label: "Instant", short: "Instant", blurb: "Self-serve. No provider review." },
  1: { label: "Self-serve with limits", short: "Limited", blurb: "Works now, but capped or warned until reviewed." },
  2: { label: "Review for production", short: "Review", blurb: "Provider must approve before this audience can use it." },
  3: { label: "Compliance-heavy", short: "Compliance", blurb: "Security assessment or business verification on top of review." },
  4: { label: "Gated", short: "Gated", blurb: "Access depends on a partner application or paid tier that can be refused." },
};

export type Assessment = {
  tier: Tier;
  reasons: string[];
  /** Agent guides only: requirements the model claimed without a confirmed quote. */
  unconfirmed: string[];
  /** The tier if every unconfirmed claim turned out true (agent guides only). */
  possibleTier: Tier;
};

/**
 * @param requireEvidence  When true (agent-generated guides), a requirement only raises the
 *   tier if it is backed by a documented/tested quote. Unbacked claims are reported separately
 *   as "could be up to" — so an over-eager model can't make an app look harder than the sources say.
 */
export function assess(f: Factors, requireEvidence = false): Assessment {
  const reasons: string[] = [];
  const unconfirmed: string[] = [];
  let tier: Tier = 0;
  let possibleTier: Tier = 0;
  const backed = (k: keyof Factors) => !requireEvidence || f[k]?.evidence.status !== "unverified";
  const rule = (k: keyof Factors, active: boolean, t: Tier | null, why: string) => {
    if (!active) return;
    if (t !== null && t > possibleTier) possibleTier = t;
    if (!backed(k)) return void unconfirmed.push(why);
    reasons.push(why);
    if (t !== null && t > tier) tier = t;
  };

  rule("selfServeCreate", !f.selfServeCreate.value, 4, "You cannot create the app self-serve");
  rule("partnerApproval", f.partnerApproval.value, 4, "Needs a partner/program application that can be refused");
  rule("paidAccessRequired", f.paidAccessRequired.value, 4, "API access requires a paid tier");
  rule("securityAssessment", f.securityAssessment.value, 3, "Third-party security assessment required");
  rule("businessVerification", f.businessVerification.value, 3, "Business/legal entity verification required");
  rule("reviewRequired", f.reviewRequired.value, 2, "Provider review required before this audience can connect");
  rule("demoVideoRequired", f.demoVideoRequired.value, null, "Demo video needed for review");
  rule("domainVerification", f.domainVerification.value, null, "You must prove you own your domain");
  rule("privacyPolicyRequired", f.privacyPolicyRequired.value, null, "Public privacy policy URL required");
  rule("customerAdminApproval", !!f.customerAdminApproval?.value, 1, "Your users' org admins may have to approve the app first");
  rule("userCapBeforeReview", f.userCapBeforeReview.value != null, 1, `Capped at ${f.userCapBeforeReview.value} users until reviewed`);

  if (reasons.length === 0) reasons.push(unconfirmed.length ? "No requirement confirmed by a source yet" : "Create the app, paste credentials, connect");
  if (possibleTier < tier) possibleTier = tier;
  return { tier, reasons, unconfirmed, possibleTier };
}

/** Curated guides were reviewed, so their unverified items count; agent guides need evidence. */
export const assessFor = (g: Pick<Guide, "origin">, s: Scenario) => assess(s.factors, g.origin === "agent");

/** Range of tiers across a guide's scenarios, for library cards. */
export function guideTierRange(g: Guide): [Tier, Tier] {
  const tiers = g.scenarios.map((s) => assessFor(g, s).tier);
  return [Math.min(...tiers) as Tier, Math.max(...tiers) as Tier];
}

export function formatRange([a, b]: [number, number], unit: string): string {
  const u = (n: number) => (n === 1 ? unit.replace(/s$/, "") : unit);
  if (a === b) return `${a} ${u(b)}`;
  return `${a}–${b} ${unit}`;
}

/** Count evidence statuses anywhere in a guide (for the trust summary). */
export function evidenceCounts(g: Guide) {
  const counts = { tested: 0, documented: 0, unverified: 0 };
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Record<string, unknown>;
    if (typeof o.status === "string" && "sourceIds" in o) {
      const s = o.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
    Object.values(o).forEach(walk);
  };
  walk(g);
  return counts;
}
