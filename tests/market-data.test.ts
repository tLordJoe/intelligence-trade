import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTickers, percentagePerformance } from "../src/lib/market-data.ts";
import { dedupeById, isOfficialHouseFilingUrl } from "../src/lib/congress-utils.ts";

test("normalizeTickers trims, uppercases, deduplicates, and rejects invalid symbols", () => {
  assert.deepEqual(
    normalizeTickers([" nvda ", "NVDA", "brk.b", "bad-symbol", "TOOLONG"]),
    ["NVDA", "BRK.B"]
  );
});

test("normalizeTickers enforces a request limit", () => {
  assert.deepEqual(normalizeTickers(["A", "B", "C"], 2), ["A", "B"]);
});

test("percentagePerformance calculates gain and loss from the first close", () => {
  assert.equal(percentagePerformance(100, 125), 25);
  assert.ok(Math.abs(percentagePerformance(100, 80) - (-20)) < 1e-10);
});

test("percentagePerformance rejects invalid base prices", () => {
  assert.throws(() => percentagePerformance(0, 100));
  assert.throws(() => percentagePerformance(Number.NaN, 100));
});

test("dedupeById keeps the first unique disclosure record", () => {
  assert.deepEqual(
    dedupeById([{ id: "a", value: 1 }, { id: "a", value: 2 }, { id: "b", value: 3 }]),
    [{ id: "a", value: 1 }, { id: "b", value: 3 }]
  );
});

test("official filing links are restricted to House PTR PDFs", () => {
  assert.equal(
    isOfficialHouseFilingUrl("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035136.pdf"),
    true
  );
  assert.equal(isOfficialHouseFilingUrl("https://example.com/filing.pdf"), false);
  assert.equal(isOfficialHouseFilingUrl("javascript:alert(1)"), false);
});
