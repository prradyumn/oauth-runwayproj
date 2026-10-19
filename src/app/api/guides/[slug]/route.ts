import { getGuide } from "@/lib/store";
import { guideToMarkdown } from "@/lib/markdown";
import { assessFor, TIERS } from "@/lib/rubric";

/**
 * Machine-readable guides for agent builders.
 *   GET /api/guides/gmail                 -> JSON (with computed difficulty per scenario)
 *   GET /api/guides/gmail?format=md       -> Markdown
 *   GET /api/guides/gmail?format=md&scenario=testing
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) return Response.json({ error: `No guide for "${slug}". POST /api/generate to create one.` }, { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "md") {
    return new Response(guideToMarkdown(guide, url.searchParams.get("scenario") ?? undefined), {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }
  return Response.json({
    ...guide,
    difficulty: guide.scenarios.map((s) => {
      const a = assessFor(guide, s);
      return { scenarioId: s.id, tier: a.tier, label: TIERS[a.tier].label, reasons: a.reasons, unconfirmed: a.unconfirmed, possibleTier: a.possibleTier };
    }),
  });
}
