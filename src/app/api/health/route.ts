import { getModel } from "@/lib/agent/llm";
import { blobAccess, blobEnabled, blobEnvNames, blobToken, blobWrite, storageMode } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Which features this deployment can use. Booleans and names only, never secret values.
 *   GET /api/health          -> config summary
 *   GET /api/health?probe=1  -> also writes + reads a tiny Blob file to prove storage works
 */
export async function GET(req: Request) {
  const llm = getModel();
  const out: Record<string, unknown> = {
    llm: llm?.name ?? "none (demo mode)",
    search: process.env.SEARCH_PROVIDER === "crawl" ? "built-in crawler only" : process.env.TAVILY_API_KEY ? "Tavily (API key)" : "Tavily keyless → crawler fallback",
    storage: storageMode(),
    blobEnvVarsPresent: blobEnvNames(),
  };
  if (new URL(req.url).searchParams.get("probe") === "1" && blobEnabled()) {
    try {
      const at = new Date().toISOString();
      const mode = await blobWrite("health/probe.json", JSON.stringify({ at }));
      const { get } = await import("@vercel/blob");
      const r = await get("health/probe.json", { access: mode, useCache: false, token: blobToken() });
      const back = r ? JSON.parse(await new Response(r.stream).text()) : null;
      out.blobProbe = back?.at === at ? `ok (${mode} store)` : "write ok, read-back mismatch";
    } catch (err) {
      out.blobProbe = `failed: ${err instanceof Error ? err.message.slice(0, 200) : String(err)}`;
    }
    out.blobAccess = blobAccess();
  }
  return Response.json(out);
}
