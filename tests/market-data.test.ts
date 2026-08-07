import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTickers, percentagePerformance } from "../src/lib/market-data.ts";

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
