// CLI: run the live research agent for one app and save the guide.
// Usage: npx tsx --env-file=.env.local scripts/generate.ts "Zoom"
import { runPipeline } from "../src/lib/agent/pipeline";
import { saveGenerated } from "../src/lib/store";
import { assessFor, TIERS, evidenceCounts } from "../src/lib/rubric";

(async () => {
  const input = process.argv.slice(2).join(" ") || "Zoom";
  const t0 = Date.now();
  const s = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`.padStart(4);
  const guide = await runPipeline(input, (e) => {
    if (e.type === "stage") console.log(`${s()} [${e.stage}] ${e.status}${e.detail ? " — " + e.detail : ""}`);
    else if (e.type === "log") console.log(`${s()}   ${e.message}`);
    else if (e.type === "source") console.log(`${s()}   source: ${e.url}`);
    else if (e.type === "meta") console.log(`${s()} mode=${e.mode} ${e.model ?? ""}`);
  });
  await saveGenerated(guide);
  const c = evidenceCounts(guide);
  console.log(`\n${guide.app.name} → /guides/${guide.slug}  (${s()})`);
  console.log(guide.summary);
  for (const sc of guide.scenarios) console.log(`  - ${sc.label}: ${TIERS[assessFor(guide, sc).tier].label} · ${sc.steps.length} steps · ${sc.blockers.length} blockers`);
  console.log(`  evidence: 📄 ${c.documented} documented · ❓ ${c.unverified} unverified`);
})().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
