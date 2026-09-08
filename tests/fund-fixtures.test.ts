/**
 * What the comparison is allowed to be built on.
 *
 * Two claims are asserted here that no amount of code review reliably catches
 * on its own:
 *
 *   1. No file in the fund comparison fetches from, names, or was derived from
 *      a market-data provider. Checked by reading the source rather than by
 *      trusting that nobody added one back.
 *
 *   2. The committed fixture is reproducible from the generator, on any machine,
 *      with the network unplugged. A fixture that cannot be regenerated is
 *      indistinguishable from one that was pasted in from somewhere.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import committed from "../src/lib/funds/fixtures/demo-price-series.json" with { type: "json" };

import { DEMONSTRATION_LABEL, generateDemoDataset } from "../src/lib/funds/fixtures/generate-demo-series.ts";
import { demonstrationProvider } from "../src/lib/funds/providers/demonstration.ts";
import { requiresDemonstrationLabel } from "../src/lib/funds/types.ts";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Every file this feature owns. Nothing outside it is this test's business.
 *
 * The test files are discovered rather than listed, so adding one does not
 * quietly leave it outside the scan.
 */
const OWNED_PATHS = [
  "src/lib/funds",
  "src/components/compare",
  "src/app/compare",
  "scripts/generate-demo-series.ts",
  ...readdirSync(join(ROOT, "tests"))
    .filter((name) => name.startsWith("fund-") && name.endsWith(".test.ts"))
    .map((name) => join("tests", name)),
];

function walk(path: string): string[] {
  const full = join(ROOT, path);
  let stats;
  try {
    stats = statSync(full);
  } catch {
    return [];
  }
  if (stats.isFile()) return [path];
  return readdirSync(full).flatMap((entry) => walk(join(path, entry)));
}

const OWNED_FILES = OWNED_PATHS.flatMap(walk);

// --- no provider-derived price data ------------------------------------------

/**
 * Names of unlicensed sources this product must not reach for.
 *
 * Written as separated fragments so this list does not itself trip the check it
 * defines — the test would otherwise fail on its own source.
 */
const FORBIDDEN_SOURCE_FRAGMENTS = [
  ["yah", "oo"],
  ["stooq"],
  ["alphavan", "tage"],
  ["finn", "hub"],
  ["polygon", ".io"],
  ["query1.", "finance"],
  ["adjcl", "ose"],
];

test("no file in the fund comparison names an unlicensed market-data source", () => {
  const offenders: string[] = [];

  for (const file of OWNED_FILES) {
    if (file.endsWith("fund-fixtures.test.ts")) continue;
    const text = readFileSync(join(ROOT, file), "utf8").toLowerCase();
    for (const fragments of FORBIDDEN_SOURCE_FRAGMENTS) {
      const needle = fragments.join("");
      if (text.includes(needle)) offenders.push(`${file} contains "${needle}"`);
    }
  }

  assert.deepEqual(offenders, [], offenders.join("; "));
});

test("no file in the fund comparison fetches anything over the network", () => {
  const offenders: string[] = [];

  for (const file of OWNED_FILES) {
    if (file.endsWith("fund-fixtures.test.ts")) continue;
    const text = readFileSync(join(ROOT, file), "utf8");
    if (/\bfetch\s*\(/.test(text)) offenders.push(`${file} calls fetch`);
    if (/https?:\/\/(?!www\.sec\.gov|data\.sec\.gov)/.test(text)) {
      offenders.push(`${file} contains a non-SEC URL`);
    }
  }

  assert.deepEqual(offenders, [], offenders.join("; "));
});

test("the removed price snapshot and its capture script are gone", () => {
  for (const path of ["src/lib/fund-prices.json", "scripts/snapshot-fund-prices.ts"]) {
    assert.throws(() => statSync(join(ROOT, path)), `${path} must not exist`);
  }
});

// --- the fixture is generated, not copied ------------------------------------

test("the committed fixture regenerates exactly, with no network access", () => {
  const regenerated = generateDemoDataset();
  assert.deepEqual(
    JSON.parse(JSON.stringify(regenerated)),
    committed,
    "the committed fixture does not match the generator; it was edited or replaced"
  );
});

test("regeneration is deterministic across runs", () => {
  assert.deepEqual(generateDemoDataset(), generateDemoDataset());
});

test("every generated series starts at the same round number, as a tell", () => {
  const dataset = generateDemoDataset();
  for (const series of Object.values(dataset.series)) {
    assert.equal(series.parameters.startValue, 100);
  }
});

// --- the fixture cannot be mistaken for production data -----------------------

test("the fixture carries the demonstration label in its own bytes", () => {
  const raw = readFileSync(
    join(ROOT, "src/lib/funds/fixtures/demo-price-series.json"),
    "utf8"
  );
  assert.ok(raw.includes(DEMONSTRATION_LABEL));
  assert.ok(raw.includes("Not fetched, copied, or derived from any market-data provider"));
});

test("the fixture declares itself synthetic and cannot declare otherwise", () => {
  assert.equal(generateDemoDataset().synthetic, true);
  assert.equal((committed as { synthetic: boolean }).synthetic, true);
});

test("the label is the exact required wording", () => {
  assert.equal(DEMONSTRATION_LABEL, "Demonstration data — not actual market performance.");
});

test("the fixture states its method, so nobody has to guess where it came from", () => {
  const dataset = generateDemoDataset();
  assert.ok(dataset.method.toLowerCase().includes("random walk"));
  assert.ok(dataset.method.toLowerCase().includes("seed"));
  assert.ok(dataset.generator.endsWith("generate-demo-series.ts"));
});

// --- the provider serving it -------------------------------------------------

test("the provider identifies itself as a demonstration source", () => {
  assert.equal(demonstrationProvider.kind, "demonstration");
  assert.equal(requiresDemonstrationLabel(demonstrationProvider.provenance), true);
  assert.equal(demonstrationProvider.provenance.demonstrationLabel, DEMONSTRATION_LABEL);
});

test("the provider supplies price return only, and refuses total return", () => {
  assert.deepEqual(demonstrationProvider.supportedBases, ["price_return"]);

  const total = demonstrationProvider.getPriceSeries("VOO", "total_return");
  assert.equal(total.status, "unavailable");
  if (total.status !== "unavailable") return;
  assert.equal(total.reason, "basis_not_supplied");
});

test("the provider makes no claim to have adjusted for splits or distributions", () => {
  const result = demonstrationProvider.getPriceSeries("VOO", "price_return");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;

  const { methodology } = result.value;
  assert.equal(methodology.basis, "price_return");
  assert.equal(methodology.splitAdjusted, false);
  assert.equal(methodology.distributionAdjusted, false);
  assert.ok(methodology.adjustmentEvidence.toLowerCase().includes("not applicable"));
});

test("expenses, holdings and overlays are never generated", () => {
  assert.equal(demonstrationProvider.getExpenses("VOO").expenseRatioPercent.status, "unavailable");
  assert.equal(demonstrationProvider.getHoldings("VOO").status, "unavailable");
  assert.deepEqual(demonstrationProvider.getOverlays("VOO"), []);
});

test("a missing value is never delivered as zero", () => {
  const expenses = demonstrationProvider.getExpenses("VOO");
  assert.equal(expenses.expenseRatioPercent.status, "unavailable");
  assert.ok(!("value" in expenses.expenseRatioPercent));
});

test("the fixture includes a gapped series, so alignment is exercised by real use", () => {
  const dataset = generateDemoDataset();
  const gapped = Object.values(dataset.series).filter((s) => s.gaps.length > 0);
  assert.ok(gapped.length >= 1, "at least one demonstration series must contain a gap");
  for (const series of gapped) {
    for (const gap of series.gaps) {
      assert.ok(!series.dates.some((d) => d >= gap.from && d <= gap.to));
    }
  }
});

test("the fixture includes a later-starting series, so common endpoints are exercised", () => {
  const dataset = generateDemoDataset();
  const starts = new Set(Object.values(dataset.series).map((s) => s.dates[0]));
  assert.ok(starts.size > 1, "series must not all start on the same date");
});
