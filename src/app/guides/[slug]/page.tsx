import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGuide } from "@/lib/store";
import { assessFor, TIERS } from "@/lib/rubric";
import GuideView from "@/components/GuideView";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = await getGuide((await params).slug);
  if (!guide) return { title: "Guide not found — OAuth Runway" };
  const tiers = guide.scenarios.map((s) => `${s.label}: ${TIERS[assessFor(guide, s).tier].label}`).join(" · ");
  return { title: `${guide.app.name} OAuth app setup & approval — OAuth Runway`, description: `${guide.summary} ${tiers}` };
}

export default async function GuidePage({ params }: Props) {
  const guide = await getGuide((await params).slug);
  if (!guide) notFound();
  return <GuideView guide={guide} />;
}
