// Usage: npx tsx scripts/verify.ts [data/guides/*.json]
// Checks every "documented" quote against its cited page, writes the result
// back into each guide, and writes data/verification-report.md.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { Guide } from "../src/lib/schema";
import { verifyGuide, type VerifyReportRow } from "../src/lib/verify";

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync("data/guides").filter((f) => f.endsWith(".json")).map((f) => `data/guides/${f}`);

const lines: string[] = [
  "# Automated quote verification",
  "",
  `Run: ${new Date().toISOString().slice(0, 10)}. Each "documented" claim's quote was searched for on the cited page with a plain HTTP GET.`,
  "",
  "| Guide | Claims checked | Confirmed | Near-match | Not found (downgraded) | Unreachable (JS/blocked) |",
  "|---|---|---|---|---|---|",
];
const details: string[] = [];

async function main() {
for (const file of files) {
  const guide = Guide.parse(JSON.parse(readFileSync(file, "utf8")));
  const rows: VerifyReportRow[] = await verifyGuide(guide);
  writeFileSync(file, JSON.stringify(guide, null, 2) + "\n");
  const c = (r: string) => rows.filter((x) => x.result === r).length;
  lines.push(`| ${guide.app.name} | ${rows.length} | ${c("confirmed")} | ${c("near-match")} | ${c("not-found")} | ${c("unreachable")} |`);
  const bad = rows.filter((r) => r.result !== "confirmed");
  if (bad.length) {
    details.push(`\n## ${guide.app.name}\n`);
    for (const r of bad) details.push(`- **${r.result}** \`${r.path}\` — "${r.quote.slice(0, 140)}" (${r.url ?? "no url"})`);
  }
  console.log(`${guide.app.name}: ${rows.length} checked, ${c("confirmed")} confirmed, ${c("near-match")} near, ${c("not-found")} not found, ${c("unreachable")} unreachable`);
}

writeFileSync("data/verification-report.md", [...lines, ...details, ""].join("\n"));
console.log("Wrote data/verification-report.md");
}
main();
