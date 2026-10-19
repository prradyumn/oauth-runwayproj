"use client";

import { useState, type ReactNode } from "react";
import type { Evidence, Guide } from "@/lib/schema";
import { TIERS, type Tier } from "@/lib/rubric";

export function TierChip({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      style={{ color: `var(--t${tier})`, background: `var(--t${tier}-bg)` }}
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="w-1 h-2.5 rounded-sm" style={{ background: i < tier ? `var(--t${tier})` : "currentColor", opacity: i < tier ? 1 : 0.2 }} />
        ))}
      </span>
      {TIERS[tier].label}
    </span>
  );
}

const STATUS = {
  tested: { icon: "✅", label: "Tested", color: "var(--ok)", bg: "var(--t0-bg)" },
  documented: { icon: "📄", label: "Documented", color: "var(--doc)", bg: "var(--doc-bg)" },
  unverified: { icon: "❓", label: "Unverified", color: "var(--unv)", bg: "var(--unv-bg)" },
} as const;

/** Small evidence badge; click to see the quote, source and what the verifier found. */
export function EvidenceChip({ e, guide }: { e: Evidence; guide: Guide }) {
  const [open, setOpen] = useState(false);
  const st = STATUS[e.status];
  const srcs = e.sourceIds.map((id) => ({ s: guide.sources.find((x) => x.id === id), n: guide.sources.findIndex((x) => x.id === id) + 1 })).filter((x) => x.s);
  return (
    <span className="inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] rounded-full px-2 py-0.5 font-medium cursor-pointer whitespace-nowrap"
        style={{ color: st.color, background: st.bg }}
        aria-expanded={open}
      >
        {st.icon} {st.label}
        {srcs.length > 0 && <span className="opacity-70"> [{srcs.map((x) => x.n).join(",")}]</span>}
        {e.check?.result === "unreachable" && <span className="opacity-70"> · not auto-checked</span>}
      </button>
      {open && (
        <span className="block mt-2 p-3 rounded-lg border border-border bg-surface-2 text-xs leading-relaxed text-text max-w-prose">
          {e.quote && <span className="block italic mb-2">“{e.quote}”</span>}
          {srcs.map(({ s, n }) => (
            <a key={s!.id} href={s!.url} target="_blank" rel="noreferrer" className="block text-accent underline underline-offset-2 break-all">
              [{n}] {s!.title}
            </a>
          ))}
          {e.check && (
            <span className="block mt-1 text-muted">
              Verifier ({e.check.checkedAt}):{" "}
              {{ confirmed: "quote found verbatim on the page", "near-match": "quote found with minor wording drift", "not-found": "quote NOT found — claim downgraded", unreachable: "page couldn't be fetched as plain HTML (JS-rendered or blocked), so not auto-checked" }[e.check.result]}
            </span>
          )}
          {e.note && <span className="block mt-1 text-muted">{e.note}</span>}
        </span>
      )}
    </span>
  );
}

export const ACTOR = {
  agent: { icon: "🤖", label: "Agent can do this", short: "Agent" },
  both: { icon: "🤝", label: "Agent prepares, you submit", short: "Agent + you" },
  human: { icon: "👤", label: "You must do this", short: "You" },
} as const;

export function ActorBadge({ actor }: { actor: keyof typeof ACTOR }) {
  const a = ACTOR[actor];
  return (
    <span className="text-[11px] rounded-full px-2 py-0.5 border border-border bg-surface-2 whitespace-nowrap">
      {a.icon} {a.label}
    </span>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
      className="text-xs rounded-md border border-border px-2 py-1 hover:bg-surface-2 cursor-pointer whitespace-nowrap"
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/** Minimal, safe inline markdown: `code`, **bold**, [text](url). */
export function Md({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<code key={k++}>{m[1]}</code>);
    else if (m[2]) parts.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[5]) parts.push(<em key={k++}>{m[5]}</em>);
    else parts.push(<a key={k++} href={m[4]} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Multi-line markdown-ish block (paragraphs, bullets, fenced code). */
export function MdBlock({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="text-xs bg-surface-2 border border-border rounded-lg p-3 overflow-x-auto"><code className="!border-0 !bg-transparent !p-0">{b.replace(/^\w*\n/, "")}</code></pre>
        ) : (
          b.split(/\n{2,}/).filter((p) => p.trim()).map((p, j) => {
            const lines = p.split("\n");
            if (lines.every((l) => /^\s*([-*]|\d+\.)\s/.test(l) || !l.trim()))
              return (
                <ul key={`${i}-${j}`} className="list-disc pl-5 space-y-1">
                  {lines.filter((l) => l.trim()).map((l, n) => <li key={n}><Md text={l.replace(/^\s*([-*]|\d+\.)\s/, "")} /></li>)}
                </ul>
              );
            return <p key={`${i}-${j}`} className="whitespace-pre-line"><Md text={p.replace(/^#+\s*/gm, "")} /></p>;
          })
        ),
      )}
    </div>
  );
}
