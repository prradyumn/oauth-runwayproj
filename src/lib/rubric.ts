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

export type Assessment = { tier: Tier; reasons: string[] };

export function assess(f: Factors): Assessment {
  const reasons: string[] = [];
  let tier: Tier = 0;
  const bump = (t: Tier, why: string) => {
    reasons.push(why);
    if (t > tier) tier = t;
  };

  if (!f.selfServeCreate.value) bump(4, "You cannot create the app self-serve");
  if (f.partnerApproval.value) bump(4, "Needs a partner/program application that can be refused");
  if (f.paidAccessRequired.value) bump(4, "API access requires a paid tier");
  if (f.securityAssessment.value) bump(3, "Third-party security assessment required");
  if (f.businessVerification.value) bump(3, "Business/legal entity verification required");
  if (f.reviewRequired.value) bump(2, "Provider review required before this audience can connect");
  if (f.demoVideoRequired.value) reasons.push("Demo video needed for review");
  if (f.domainVerification.value) reasons.push("You must prove you own your domain");
  if (f.privacyPolicyRequired.value) reasons.push("Public privacy policy URL required");
  if (f.customerAdminApproval?.value) bump(1, "Your users' org admins may have to approve the app first");
  if (f.userCapBeforeReview.value != null) bump(1, `Capped at ${f.userCapBeforeReview.value} users until reviewed`);

  if (reasons.length === 0) reasons.push("Create the app, paste credentials, connect");
  return { tier, reasons };
}

export const assessScenario = (s: Scenario) => assess(s.factors);

/** Range of tiers across a guide's scenarios, for library cards. */
export function guideTierRange(g: Guide): [Tier, Tier] {
  const tiers = g.scenarios.map((s) => assess(s.factors).tier);
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
