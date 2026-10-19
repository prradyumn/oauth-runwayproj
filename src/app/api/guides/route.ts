import { listCurated, listGenerated } from "@/lib/store";
import { guideTierRange, TIERS } from "@/lib/rubric";

/** GET /api/guides -> index of all guides (curated + generated). */
export async function GET() {
  const guides = [...(await listCurated()), ...(await listGenerated())];
  return Response.json(
    guides.map((g) => {
      const [lo, hi] = guideTierRange(g);
      return {
        slug: g.slug,
        name: g.app.name,
        origin: g.origin,
        lastVerified: g.lastVerified,
        difficulty: lo === hi ? TIERS[lo].label : `${TIERS[lo].label} → ${TIERS[hi].label}`,
        scenarios: g.scenarios.map((s) => s.id),
        url: `/api/guides/${g.slug}`,
      };
    }),
  );
}
