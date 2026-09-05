/**
 * Prove the demonstration fixture is not in any browser asset.
 *
 * Reads the emitted build, not the source. Every JavaScript file under
 * `.next/static` — the directory Next serves to browsers — and every file under
 * `public/` is scanned for markers that could only have come from the fixture
 * or its generator. One hit fails the run.
 *
 * Run after `next build`:
 *
 *   node --experimental-strip-types scripts/verify-compare-assets.ts
 *
 * The markers are chosen to be unmistakable rather than broad. The disclaimer
 * phrase is in the fixture's own bytes and nowhere else; the seeds are the
 * exact 32-bit values the generator derives for each symbol; the value runs
 * are the first five closes of each series; the two hex constants are the
 * generator's PRNG and hash primes. A build that ships any of them has shipped
 * the fixture or the generator.
 *
 * The label "Demonstration data — not actual market performance." is *not* a
 * marker. It is rendered by the client component as the banner above the
 * chart, so it belongs in the browser bundle by design; its presence proves
 * nothing about the data.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const FIXTURE_PATH = join(ROOT, "src/lib/funds/fixtures/demo-price-series.json");
const GENERATOR_PATH = join(ROOT, "src/lib/funds/fixtures/generate-demo-series.ts");

interface Fixture {
  label: string;
  disclaimer: string;
  series: Record<string, { values: number[]; parameters: { seed: number } }>;
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture;

/** Strings that exist only in the fixture, the generator, or something derived from them. */
const markers: Array<{ name: string; needle: string }> = [
  { name: "fixture disclaimer", needle: fixture.disclaimer.slice(0, 60) },
  { name: "generator: mulberry32 constant", needle: "0x6d2b79f5" },
  { name: "generator: FNV prime", needle: "0x01000193" },
  ...Object.entries(fixture.series).map(([symbol, s]) => ({
    name: `${symbol} seed`,
    needle: String(s.parameters.seed),
  })),
  ...Object.entries(fixture.series).map(([symbol, s]) => ({
    name: `${symbol} first five values`,
    needle: s.values.slice(0, 5).join(","),
  })),
];

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const browserFiles = [
  ...walk(join(ROOT, ".next/static")).filter((f) => /\.(js|mjs|json|txt|css)$/.test(f)),
  ...walk(join(ROOT, "public")),
];

if (browserFiles.length === 0) {
  console.error("No browser assets found. Run `next build` first.");
  process.exit(2);
}

const hits: string[] = [];
for (const file of browserFiles) {
  const text = readFileSync(file, "utf8");
  for (const marker of markers) {
    if (text.includes(marker.needle)) {
      hits.push(`${file.replace(`${ROOT}/`, "")}: ${marker.name}`);
    }
  }
}

// The generator is a source file; it must also not be copied into public/.
for (const file of walk(join(ROOT, "public"))) {
  if (readFileSync(file, "utf8") === readFileSync(GENERATOR_PATH, "utf8")) {
    hits.push(`${file.replace(`${ROOT}/`, "")}: generator source copied verbatim`);
  }
}

const scanned = browserFiles.length;
if (hits.length > 0) {
  console.error(`Demonstration fixture found in ${hits.length} browser asset(s):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(
  `Scanned ${scanned} browser asset(s) under .next/static and public/ for ` +
    `${markers.length} fixture markers: none present.`
);
