"use client";

import { useEffect, useMemo, useState } from "react";
import type { Guide, Scenario, Factors } from "@/lib/schema";
import { assess, evidenceCounts, formatRange, TIERS } from "@/lib/rubric";
import { ActorBadge, CopyButton, EvidenceChip, Md, MdBlock, TierChip, ACTOR } from "./ui";

const AUDIENCE = { self: "Just you (testing)", internal: "Your own organization", public: "Any customer" } as const;

const FACTOR_LABELS: { key: keyof Factors; label: string; bad: boolean }[] = [
  { key: "selfServeCreate", label: "Create the app self-serve with a free account", bad: false },
  { key: "reviewRequired", label: "Provider review before users can connect", bad: true },
  { key: "securityAssessment", label: "Third-party security assessment", bad: true },
  { key: "businessVerification", label: "Business / legal entity verification", bad: true },
  { key: "partnerApproval", label: "Partner or API-access application (can be refused)", bad: true },
  { key: "paidAccessRequired", label: "Paid tier required for API access", bad: true },
  { key: "customerAdminApproval", label: "Customer's org admin may need to approve the app", bad: true },
  { key: "demoVideoRequired", label: "Demo video for reviewers", bad: true },
  { key: "privacyPolicyRequired", label: "Public privacy policy URL", bad: true },
  { key: "domainVerification", label: "Prove you own your domain", bad: true },
];

export default function GuideView({ guide }: { guide: Guide }) {
  const [sid, setSid] = useState(guide.defaultScenarioId);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (guide.scenarios.some((s) => s.id === fromHash)) setSid(fromHash);
  }, [guide.scenarios]);
  useEffect(() => {
    setShareUrl(`${window.location.origin}/guides/${guide.slug}#${sid}`);
  }, [guide.slug, sid]);

  const scenario = guide.scenarios.find((s) => s.id === sid) ?? guide.scenarios[0];
  const counts = useMemo(() => evidenceCounts(guide), [guide]);
  const isDemo = guide.slug.startsWith("demo-");

  const choose = (id: string) => {
    setSid(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {isDemo && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--t4)", background: "var(--t4-bg)", color: "var(--t4)" }}>
          Demo-mode placeholder: no research was run because API keys aren&apos;t configured. Nothing on this page is a finding.
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-border px-2 py-0.5">{guide.app.category}</span>
            <span className="rounded-full px-2 py-0.5" style={guide.origin === "curated" ? { background: "var(--accent-soft)", color: "var(--accent)" } : { background: "var(--surface-2)" }}>
              {guide.origin === "curated" ? "Curated library guide" : "Generated live by the research agent"}
            </span>
            <span>Last verified {guide.lastVerified}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{guide.app.name} OAuth app: setup &amp; approval</h1>
          <p className="text-[15px] leading-relaxed text-muted">{guide.summary}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a className="text-accent underline underline-offset-2" href={guide.app.developerPortalUrl} target="_blank" rel="noreferrer">Developer portal ↗</a>
            <a className="text-accent underline underline-offset-2" href={guide.app.docsUrl} target="_blank" rel="noreferrer">OAuth docs ↗</a>
          </div>
        </div>
        <div className="flex flex-wrap md:flex-col gap-2 md:items-end shrink-0">
          <CopyButton text={shareUrl} label="Copy share link" />
          <a href={`/api/guides/${guide.slug}?format=md&scenario=${scenario.id}`} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-2">Markdown (this scenario)</a>
          <a href={`/api/guides/${guide.slug}?format=md`} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-2">Markdown (all)</a>
          <a href={`/api/guides/${guide.slug}`} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-2">JSON for agents</a>
        </div>
      </header>

      {/* Trust bar */}
      <div className="card p-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="font-medium">How sure are we?</span>
        <span>✅ {counts.tested} tested in a console</span>
        <span>📄 {counts.documented} backed by a quoted source</span>
        <span>❓ {counts.unverified} unverified or estimated</span>
        <span className="text-xs text-muted">Click any badge to see the quote and whether our verifier found it on the page.</span>
      </div>

      {/* Do you need your own app? */}
      <section className="card p-5 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <h2 className="font-semibold">Do you need your own {guide.app.name} OAuth app?</h2>
          <p className="text-sm">
            Composio-managed app:{" "}
            <strong>{guide.composio.managedAppAvailable.value === null ? "unknown" : guide.composio.managedAppAvailable.value ? "available" : "not available — you must bring your own"}</strong>{" "}
            <EvidenceChip e={guide.composio.managedAppAvailable.evidence} guide={guide} />
          </p>
          <p className="text-sm text-muted">{guide.composio.whenYouNeedYourOwn}</p>
        </div>
        {guide.composio.redirectUri.value && (
          <div className="space-y-2">
            <div className="text-xs text-muted">Redirect URI to register with {guide.app.name}</div>
            <code className="block text-xs !p-2">{guide.composio.redirectUri.value}</code>
            <div className="flex gap-2 items-center flex-wrap">
              <CopyButton text={guide.composio.redirectUri.value} />
              <EvidenceChip e={guide.composio.redirectUri.evidence} guide={guide} />
            </div>
          </div>
        )}
      </section>

      {/* Scenario picker */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Difficulty depends on who connects and which scopes you need. Pick your situation:</h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))` }}>
          {guide.scenarios.map((s) => {
            const a = assess(s.factors);
            const active = s.id === scenario.id;
            return (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className={`text-left card p-3 cursor-pointer transition ${active ? "ring-2" : "hover:bg-surface-2"}`}
                style={active ? { boxShadow: "0 0 0 2px var(--accent)" } : undefined}
              >
                <div className="text-xs text-muted mb-1">{AUDIENCE[s.audience]}</div>
                <div className="font-medium text-sm mb-2">{s.label}</div>
                <TierChip tier={a.tier} />
              </button>
            );
          })}
        </div>
      </section>

      <ScenarioBody s={scenario} guide={guide} />

      {/* Artifacts */}
      {guide.artifacts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Drafts the agent prepared for you</h2>
          <p className="text-sm text-muted">Starting points to edit, not final text. You stay responsible for what you submit.</p>
          {guide.artifacts.map((a, i) => (
            <details key={i} className="card p-4">
              <summary className="cursor-pointer font-medium flex items-center justify-between gap-2">
                {a.title}
                <CopyButton text={a.content} />
              </summary>
              <div className="mt-3"><MdBlock text={a.content} /></div>
            </details>
          ))}
        </section>
      )}

      {guide.openQuestions.length > 0 && (
        <section className="card p-5" style={{ background: "var(--unv-bg)" }}>
          <h2 className="font-semibold mb-2">Still uncertain</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {guide.openQuestions.map((q, i) => <li key={i}><Md text={q} /></li>)}
          </ul>
        </section>
      )}

      {guide.testLog.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What we tested in the console</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {guide.testLog.map((t, i) => (
              <div key={i} className="card p-4 text-sm space-y-2">
                <div className="text-xs text-muted">{t.date} · {t.by}{t.minutes ? ` · ${t.minutes} min` : ""}</div>
                <div className="font-medium">{t.what}</div>
                <div className="text-muted">{t.observed}</div>
                {t.screenshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={t.screenshot} target="_blank" rel="noreferrer"><img src={t.screenshot} alt={t.what} className="rounded-lg border border-border" /></a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Sources</h2>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          {guide.sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 break-all">{s.title}</a>{" "}
              <span className="text-xs text-muted">({s.kind}, accessed {s.accessed})</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ScenarioBody({ s, guide }: { s: Scenario; guide: Guide }) {
  const a = assess(s.factors);
  const t = s.timeline;
  const actorCounts = { agent: 0, both: 0, human: 0 };
  s.steps.forEach((st) => actorCounts[st.actor]++);
  const handsMax = Math.max(t.production.handsOnHours[1], 0.25);
  const waitMax = t.production.waitDays ? t.production.waitDays[1] * 24 : 0;
  // Bar: hands-on hours vs calendar wait (log-ish scale so a 2h task next to a 6-week wait is still visible)
  const scale = (h: number) => Math.log10(1 + h);
  const total = scale(handsMax) + scale(waitMax) || 1;

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <section className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 space-y-3">
          <div className="text-xs text-muted">Difficulty for this scenario</div>
          <TierChip tier={a.tier} size="lg" />
          <p className="text-sm text-muted">{TIERS[a.tier].blurb}</p>
          <ul className="text-sm space-y-1">
            {a.reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
          <p className="text-[11px] text-muted">Computed by a fixed rubric from the requirements below — not an AI judgement.</p>
        </div>

        <div className="card p-5 lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted">① First working connection</div>
              <div className="text-2xl font-semibold">{formatRange(t.firstConnection.handsOnMinutes, "min")}</div>
              <div className="text-sm text-muted">hands-on · {t.firstConnection.note}</div>
            </div>
            <div>
              <div className="text-xs text-muted">② Production-ready for “{AUDIENCE[s.audience].toLowerCase()}”</div>
              <div className="text-2xl font-semibold">
                {formatRange(t.production.handsOnHours, "h")} <span className="text-base font-normal text-muted">work</span>
                {t.production.waitDays && <> + {formatRange(t.production.waitDays, "days")} <span className="text-base font-normal text-muted">waiting</span></>}
              </div>
              <div className="text-sm text-muted">{t.production.note}</div>
            </div>
          </div>
          <div>
            <div className="flex h-3 rounded-full overflow-hidden border border-border">
              <div style={{ width: `${(scale(handsMax) / total) * 100}%`, background: "var(--accent)" }} title="Your hands-on work" />
              {waitMax > 0 && <div style={{ width: `${(scale(waitMax) / total) * 100}%`, background: `repeating-linear-gradient(45deg, var(--t${a.tier}) 0 6px, var(--t${a.tier}-bg) 6px 12px)` }} title="Waiting on the provider" />}
            </div>
            <div className="flex gap-4 text-[11px] text-muted mt-1">
              <span>■ your work</span>
              {waitMax > 0 && <span>▨ waiting on {guide.app.name} (log scale)</span>}
              <span className="ml-auto"><EvidenceChip e={t.evidence} guide={guide} /></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted">Who does the {s.steps.length} steps:</span>
            {(Object.keys(actorCounts) as (keyof typeof ACTOR)[]).map((k) => (
              <span key={k} className="rounded-full border border-border px-2 py-0.5">{ACTOR[k].icon} {ACTOR[k].short}: {actorCounts[k]}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="card p-5">
        <h2 className="font-semibold mb-1">Requirements that shape this setup</h2>
        <p className="text-sm text-muted mb-3">{s.description}</p>
        <div className="grid md:grid-cols-2 gap-x-6">
          {FACTOR_LABELS.map(({ key, label, bad }) => {
            const f = s.factors[key];
            if (!f) return null;
            const v = f.value;
            const on = key === "userCapBeforeReview" ? v != null : v === true;
            const tone = on === bad ? (on ? "var(--t3)" : "var(--muted)") : "var(--t0)";
            return (
              <div key={key} className="flex items-start gap-2 py-2 border-b border-border text-sm">
                <span className="w-5 shrink-0 font-semibold" style={{ color: tone }}>{on ? "✓" : "—"}</span>
                <span className={`flex-1 ${on ? "" : "text-muted"}`}>{label}</span>
                <EvidenceChip e={f.evidence} guide={guide} />
              </div>
            );
          })}
          <div className="flex items-start gap-2 py-2 border-b border-border text-sm">
            <span className="w-5 shrink-0 font-semibold" style={{ color: s.factors.userCapBeforeReview.value != null ? "var(--t3)" : "var(--muted)" }}>{s.factors.userCapBeforeReview.value != null ? "✓" : "—"}</span>
            <span className={`flex-1 ${s.factors.userCapBeforeReview.value != null ? "" : "text-muted"}`}>
              User cap before review{s.factors.userCapBeforeReview.value != null ? `: ${s.factors.userCapBeforeReview.value}` : ""}
            </span>
            <EvidenceChip e={s.factors.userCapBeforeReview.evidence} guide={guide} />
          </div>
        </div>
        {s.scopes.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-muted mb-2">Scopes in this scenario</div>
            <div className="flex flex-wrap gap-2">
              {s.scopes.map((sc) => (
                <span key={sc.name} className="text-xs rounded-lg border border-border px-2 py-1 bg-surface-2" title={sc.purpose}>
                  <code className="!border-0 !bg-transparent !p-0">{sc.name}</code>{" "}
                  <span style={{ color: { basic: "var(--t0)", sensitive: "var(--t2)", restricted: "var(--t4)", gated: "var(--t4)" }[sc.sensitivity] }}>· {sc.sensitivity}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Steps */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Steps</h2>
        <ol className="space-y-3">
          {s.steps.map((st, i) => (
            <li key={st.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-surface-2 border border-border grid place-items-center text-xs font-semibold">{i + 1}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted">{st.phase}</span>
                <h3 className="font-medium flex-1 min-w-[200px]">{st.title}</h3>
                <ActorBadge actor={st.actor} />
                {st.estMinutes ? <span className="text-xs text-muted">~{st.estMinutes} min</span> : null}
              </div>
              <div className="text-sm leading-relaxed pl-8 space-y-2">
                <p><Md text={st.detail} /></p>
                {(st.agentCan || st.humanMust) && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {st.agentCan && <div className="rounded-lg p-2 text-xs" style={{ background: "var(--accent-soft)" }}><strong>🤖 Agent can:</strong> <Md text={st.agentCan} /></div>}
                    {st.humanMust && <div className="rounded-lg p-2 text-xs bg-surface-2"><strong>👤 You must:</strong> <Md text={st.humanMust} /></div>}
                  </div>
                )}
                {st.values.length > 0 && (
                  <div className="space-y-1">
                    {st.values.map((v, j) => (
                      <div key={j} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted">{v.label}:</span>
                        <code>{v.value}</code>
                        <CopyButton text={v.value} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {st.links.map((l, j) => (
                    <a key={j} href={l.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline underline-offset-2">{l.label} ↗</a>
                  ))}
                  <EvidenceChip e={st.evidence} guide={guide} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Blockers */}
      {s.blockers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">If you hit a blocker</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {s.blockers.map((b, i) => (
              <div key={i} className="card p-4 text-sm space-y-2">
                <div className="font-medium">{b.title}</div>
                <div><span className="text-muted">You see:</span> <Md text={b.symptom} /></div>
                <div><span className="text-muted">What to do:</span> <Md text={b.whatToDo} /></div>
                <EvidenceChip e={b.evidence} guide={guide} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
