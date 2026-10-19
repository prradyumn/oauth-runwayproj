// Usage: npx tsx scripts/validate.ts data/guides/*.json
import { readFileSync } from "node:fs";
import { Guide } from "../src/lib/schema";

let failed = 0;
for (const file of process.argv.slice(2)) {
  const result = Guide.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (result.success) {
    const g = result.data;
    const ids = new Set(g.sources.map((s) => s.id));
    const missing = JSON.stringify(g).match(/"sourceIds":\[[^\]]*\]/g)?.flatMap((m) => JSON.parse(m.slice(12))).filter((id: string) => !ids.has(id)) ?? [];
    if (missing.length) { failed++; console.log(`✗ ${file}: unknown sourceIds ${[...new Set(missing)].join(", ")}`); }
    else console.log(`✓ ${file}`);
  } else {
    failed++;
    console.log(`✗ ${file}`);
    for (const issue of result.error.issues.slice(0, 20)) console.log(`   ${issue.path.join(".")}: ${issue.message}`);
  }
}
process.exit(failed ? 1 : 0);
