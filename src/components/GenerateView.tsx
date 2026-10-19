"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STAGES, type AgentEvent, type StageId } from "@/lib/agent/events";
import SearchBox from "./SearchBox";
import GuideView from "./GuideView";
import { guideToMarkdown } from "@/lib/markdown";
import type { Guide } from "@/lib/schema";

type StageState = { status: "pending" | "start" | "done" | "error"; detail?: string; t0?: number; t1?: number };

export default function GenerateView() {
  const params = useSearchParams();
  const router = useRouter();
  const app = params.get("app") ?? "";
  const fresh = params.get("fresh") === "1";
  const [stages, setStages] = useState<Record<StageId, StageState>>(() => Object.fromEntries(STAGES.map((s) => [s.id, { status: "pending" }])) as Record<StageId, StageState>);
  const [logs, setLogs] = useState<{ t: number; m: string }[]>([]);
  const [sources, setSources] = useState<{ url: string; title: string }[]>([]);
  const [meta, setMeta] = useState<{ mode: string; model?: string } | null>(null);
  const [done, setDone] = useState<{ slug: string; cached?: boolean; guide: Guide; saved?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const ran = useRef("");

  useEffect(() => {
    if (!app || ran.current === app + fresh) return;
    ran.current = app + fresh;
    const t0 = Date.now();
    setStartedAt(t0);
    const tick = setInterval(() => setNow(Date.now()), 500);
    (async () => {
      try {
        const res = await fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: app, fresh }) });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) handle(JSON.parse(line) as AgentEvent);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        clearInterval(tick);
        setNow(Date.now());
      }
    })();

    function handle(e: AgentEvent) {
      const at = Date.now();
      if (e.type === "meta") setMeta({ mode: e.mode, model: e.model });
      else if (e.type === "stage")
        setStages((s) => ({ ...s, [e.stage]: { ...s[e.stage], status: e.status, detail: e.detail ?? s[e.stage].detail, ...(e.status === "start" ? { t0: at } : { t1: at }) } }));
      else if (e.type === "log") setLogs((l) => [...l, { t: at, m: e.message }]);
      else if (e.type === "source") setSources((s) => [...s, { url: e.url, title: e.title }]);
      else if (e.type === "error") setError(e.message);
      else if (e.type === "done") {
        setDone({ slug: e.slug, cached: e.cached, guide: e.guide, saved: e.saved });
        if (e.cached) router.push(`/guides/${e.slug}`);
      }
    }
  }, [app, fresh, router]);

  if (!app)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4">
        <h1 className="text-3xl font-semibold">Generate a guide</h1>
        <p className="text-muted">Enter any app that offers OAuth. The agent researches it live and saves a shareable guide.</p>
        <SearchBox autoFocus />
      </div>
    );

  const elapsed = Math.max(0, Math.round(((now || startedAt) - startedAt) / 1000));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">Researching “{app}”</h1>
        <span className="text-sm text-muted tabular-nums">{elapsed}s{meta?.model ? ` · ${meta.model}` : ""}</span>
      </div>
      {meta?.mode === "demo" && (
        <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--t2)", background: "var(--t2-bg)", color: "var(--t2)" }}>
          Demo mode: no LLM / search API keys are configured, so the stages below are simulated and the result is a labelled placeholder.
        </div>
      )}

      <ol className="card divide-y divide-border">
        {STAGES.map((s, i) => {
          const st = stages[s.id];
          const secs = st.t0 && st.t1 ? ((st.t1 - st.t0) / 1000).toFixed(1) : null;
          return (
            <li key={s.id} className="p-4 flex gap-3 items-start">
              <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs font-semibold border border-border" style={st.status === "done" ? { background: "var(--t0-bg)", color: "var(--t0)" } : st.status === "error" ? { background: "var(--t4-bg)", color: "var(--t4)" } : undefined}>
                {st.status === "done" ? "✓" : st.status === "start" ? <span className="pulse">●</span> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${st.status === "pending" ? "text-muted" : ""}`}>{s.label}</div>
                {st.detail && <div className="text-xs text-muted mt-0.5 break-words">{st.detail}</div>}
              </div>
              {secs && <span className="text-xs text-muted tabular-nums">{secs}s</span>}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="card p-4 space-y-2" style={{ borderColor: "var(--t4)" }}>
          <div className="font-medium" style={{ color: "var(--t4)" }}>Couldn&apos;t finish this guide</div>
          <p className="text-sm">{error}</p>
          <Link href={`/generate?app=${encodeURIComponent(app)}&fresh=1&r=${Date.now()}`} className="text-sm text-accent underline">Try again</Link>
        </div>
      )}

      {done && !done.cached && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-3" style={{ background: done.saved === false ? "var(--t2-bg)" : "var(--t0-bg)" }}>
          <div>
            <div className="font-medium">Guide ready{done.saved === false ? " (not saved)" : ""}</div>
            <div className="text-sm text-muted">
              {done.saved === false
                ? "Storage isn't configured on this deployment, so there's no permanent share link. The full guide is below; download it as Markdown to share."
                : "Saved with a permanent link you can share. The full guide is also below."}
            </div>
          </div>
          {done.saved !== false ? (
            <Link href={`/guides/${done.slug}`} className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-medium">Open shareable page →</Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([guideToMarkdown(done.guide)], { type: "text/markdown" }));
                a.download = `${done.slug}-oauth-guide.md`;
                a.click();
              }}
              className="rounded-xl bg-accent text-white px-5 py-2.5 text-sm font-medium cursor-pointer"
            >
              Download Markdown
            </button>
          )}
        </div>
      )}

      {sources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Pages the agent read</h2>
          <ul className="text-xs space-y-1">
            {sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2 break-all">{s.title}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done && !done.cached && (
        <div className="-mx-4 border-t border-border pt-2">
          <GuideView guide={done.guide} />
        </div>
      )}

      {logs.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">Agent log</h2>
          {logs.map((l, i) => (
            <div key={i} className="text-xs text-muted font-mono">[{Math.round((l.t - startedAt) / 1000)}s] {l.m}</div>
          ))}
        </section>
      )}
    </div>
  );
}
