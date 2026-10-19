import { runPipeline } from "@/lib/agent/pipeline";
import type { AgentEvent } from "@/lib/agent/events";
import { getGuide, listCurated, saveGenerated, slugify } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300; // research + free-tier rate-limit waits can take a few minutes

/** POST { input, fresh? } -> NDJSON stream of AgentEvents, ending with "done" or "error". */
export async function POST(req: Request) {
  const { input, fresh } = (await req.json().catch(() => ({}))) as { input?: string; fresh?: boolean };
  const query = (input ?? "").trim().slice(0, 120);
  if (!query) return Response.json({ error: "Enter an app name or website." }, { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        // Cache: a curated guide or a previous generation answers instantly.
        if (!fresh) {
          const hit = await getGuide(slugify(query));
          if (hit) {
            emit({ type: "log", message: `Found an existing ${hit.origin === "curated" ? "curated" : "generated"} guide — opening it.` });
            emit({ type: "done", slug: hit.slug, guide: hit, cached: true });
            return controller.close();
          }
        }
        const guide = await runPipeline(query, emit);
        // Never overwrite a curated library guide with a live run.
        if ((await listCurated()).some((g) => g.slug === guide.slug)) guide.slug = `${guide.slug}-live`;
        await saveGenerated(guide);
        emit({ type: "done", slug: guide.slug, guide });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
