/**
 * Write the committed demonstration fixture.
 *
 * Makes no network request. The dataset is produced entirely by
 * `src/lib/funds/fixtures/generate-demo-series.ts` from a fixed seed, so
 * regenerating it on any machine reproduces the committed file byte for byte —
 * which `tests/fund-fixtures.test.ts` asserts.
 *
 *   npx tsx scripts/generate-demo-series.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { generateDemoDataset } from "../src/lib/funds/fixtures/generate-demo-series.ts";

const OUTPUT = resolve(
  import.meta.dirname,
  "../src/lib/funds/fixtures/demo-price-series.json"
);

/**
 * Indent the metadata, collapse the long numeric arrays.
 *
 * Fully pretty-printed, one observation per line, the file is 388 KB and the
 * label at the top is fifteen thousand lines from the data it labels. Fully
 * compact, it is one unreadable line. Collapsing only the arrays keeps every
 * structural field on its own line — so a reviewer can read the disclaimer and
 * the parameters, and a diff of a regenerated fixture stays legible.
 */
function format(dataset: unknown): string {
  const indented = JSON.stringify(dataset, null, 2);
  return indented.replace(/\[\n\s+((?:[^[\]{}]|\n)*?)\n\s+\]/g, (_match, body: string) =>
    `[${body.trim().replace(/\s*\n\s*/g, " ")}]`
  );
}

const dataset = generateDemoDataset();
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${format(dataset)}\n`, "utf8");

const symbols = Object.keys(dataset.series);
const observations = symbols.reduce((sum, s) => sum + dataset.series[s].dates.length, 0);

console.log(`Wrote ${OUTPUT}`);
console.log(`  ${dataset.label}`);
console.log(`  ${symbols.length} series, ${observations} observations`);
for (const symbol of symbols) {
  const s = dataset.series[symbol];
  console.log(
    `  ${symbol.padEnd(5)} ${s.dates[0]} → ${s.dates[s.dates.length - 1]}  ` +
      `${String(s.dates.length).padStart(5)} points` +
      (s.gaps.length > 0 ? `  (gap ${s.gaps[0].from}…${s.gaps[0].to})` : "")
  );
}
