/**
 * Date alignment.
 *
 * The regression this file exists for: two series pairing by array position
 * when one is missing dates the other has. It draws fine, it computes fine, and
 * every point after the first gap is against the wrong day. The only way to
 * catch it is to build a series with a hole in it and check where the values
 * land.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  alignSeries, commonDates, contiguousRuns, resolveCommonEndpoints, sharedYears, toPercentChange,
} from "../src/lib/funds/alignment.ts";
import { buildComparison } from "../src/lib/funds/compare.ts";
import { selfGeneratedRights } from "../src/lib/funds/rights.ts";
import { valueOn, type PriceSeries, type ReturnMethodology, type SourceProvenance } from "../src/lib/funds/types.ts";

const METHODOLOGY: ReturnMethodology = {
  basis: "price_return",
  splitAdjusted: false,
  distributionAdjusted: false,
  excludes: ["Everything"],
  adjustmentEvidence: "Test fixture.",
};

const PROVENANCE: SourceProvenance = {
  sourceId: "test", sourceName: "Test", kind: "demonstration",
  rights: selfGeneratedRights("test", "2026-01-01T00:00:00.000Z"),
  producedAt: "2026-01-01T00:00:00.000Z", method: "Fixture.",
  demonstrationLabel: "Demonstration data — not actual market performance.",
};

function series(symbol: string, entries: Array<[string, number]>): PriceSeries {
  const dates = entries.map(([d]) => d);
  return {
    symbol,
    dates,
    values: entries.map(([, v]) => v),
    methodology: METHODOLOGY,
    provenance: PROVENANCE,
    coverage: {
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      observations: dates.length,
      gaps: [],
    },
  };
}

// A five-day week. B is missing Wednesday.
const COMPLETE = series("A", [
  ["2026-01-05", 100], ["2026-01-06", 101], ["2026-01-07", 102],
  ["2026-01-08", 103], ["2026-01-09", 104],
]);

const WITH_GAP = series("B", [
  ["2026-01-05", 200], ["2026-01-06", 210], /* no 2026-01-07 */
  ["2026-01-08", 230], ["2026-01-09", 240],
]);

// --- the regression ----------------------------------------------------------

test("a missing date leaves a hole, and does not shift later values earlier", () => {
  const frame = alignSeries([COMPLETE, WITH_GAP], "2026-01-05", "2026-01-09");

  assert.deepEqual(frame.dates, [
    "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
  ]);

  const b = frame.columns.find((c) => c.symbol === "B");
  assert.ok(b);
  assert.deepEqual(b.values, [200, 210, null, 230, 240]);

  // Positional pairing would have put B's 2026-01-08 value of 230 against
  // 2026-01-07. It must be against 2026-01-08.
  const wednesday = frame.dates.indexOf("2026-01-07");
  const thursday = frame.dates.indexOf("2026-01-08");
  assert.equal(b.values[wednesday], null);
  assert.equal(b.values[thursday], 230);
});

test("every column in an aligned frame is the same length as the date axis", () => {
  const frame = alignSeries([COMPLETE, WITH_GAP], "2026-01-05", "2026-01-09");
  for (const column of frame.columns) {
    assert.equal(column.values.length, frame.dates.length);
  }
});

test("a gap never becomes zero", () => {
  const frame = alignSeries([COMPLETE, WITH_GAP], "2026-01-05", "2026-01-09");
  const b = frame.columns.find((c) => c.symbol === "B");
  assert.ok(b);
  assert.ok(b.values.every((v) => v !== 0));
  assert.equal(b.values.filter((v) => v === null).length, 1);
});

test("percent rebasing keeps the gap and rebases on the common start", () => {
  const frame = toPercentChange(alignSeries([COMPLETE, WITH_GAP], "2026-01-05", "2026-01-09"));
  const b = frame.columns.find((c) => c.symbol === "B");
  assert.ok(b);
  assert.equal(b.values[0], 0);
  assert.equal(b.values[2], null);
  assert.equal(b.values[4], 20); // 200 → 240
});

test("a series missing the common start date is not rebased on a substitute", () => {
  const late = series("C", [["2026-01-08", 50], ["2026-01-09", 55]]);
  const frame = toPercentChange(alignSeries([COMPLETE, late], "2026-01-05", "2026-01-09"));
  const c = frame.columns.find((col) => col.symbol === "C");
  assert.ok(c);
  // Rebasing on its own first value would report +10%. It reports nothing.
  assert.ok(c.values.every((v) => v === null));
});

// --- common dates and endpoints ----------------------------------------------

test("common dates are the intersection, in order", () => {
  assert.deepEqual(commonDates([COMPLETE, WITH_GAP]), [
    "2026-01-05", "2026-01-06", "2026-01-08", "2026-01-09",
  ]);
});

test("common dates of an empty set is empty", () => {
  assert.deepEqual(commonDates([]), []);
});

test("endpoints fall on dates both series report", () => {
  const resolved = resolveCommonEndpoints([COMPLETE, WITH_GAP], 1);
  assert.equal(resolved.status, "ok");
  if (resolved.status !== "ok") return;
  assert.equal(resolved.endpoints.startDate, "2026-01-05");
  assert.equal(resolved.endpoints.endDate, "2026-01-09");
});

test("endpoints are refused when there is nothing in common", () => {
  const other = series("D", [["2027-01-04", 1], ["2027-01-05", 2]]);
  const resolved = resolveCommonEndpoints([COMPLETE, other], 1);
  assert.equal(resolved.status, "unavailable");
});

test("shared years measures the overlap, not the union", () => {
  const long = series("L", [["2019-01-02", 1], ["2026-01-02", 2]]);
  const short = series("S", [["2025-01-02", 1], ["2026-01-02", 2]]);
  assert.ok(sharedYears([long, short]) < 1.1);
  assert.ok(sharedYears([long]) > 6.9);
});

// --- runs --------------------------------------------------------------------

test("contiguous runs split at every gap", () => {
  const runs = contiguousRuns([1, 2, null, 3, 4, null, null, 5]);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map((r) => r.map((p) => p.index)), [[0, 1], [3, 4], [7]]);
});

test("a run carries the original index, so a break is drawn in the right place", () => {
  const runs = contiguousRuns([null, null, 7, 8]);
  assert.deepEqual(runs, [[{ index: 2, value: 7 }, { index: 3, value: 8 }]]);
});

test("all-null values produce no runs rather than an empty run", () => {
  assert.deepEqual(contiguousRuns([null, null]), []);
});

// --- end to end --------------------------------------------------------------

test("a comparison over a gapped series still measures both funds on the same dates", () => {
  const comparison = buildComparison([COMPLETE, WITH_GAP], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  assert.equal(comparison.ranked.length, 2);
  for (const entry of comparison.ranked) {
    const source = [COMPLETE, WITH_GAP].find((s) => s.symbol === entry.symbol);
    assert.ok(source);
    assert.equal(entry.startValue, valueOn(source, comparison.endpoints.startDate));
    assert.equal(entry.endValue, valueOn(source, comparison.endpoints.endDate));
  }
});

test("a shorter fund pulls the shared period in rather than being measured on its own dates", () => {
  // E stops two days early. The common end moves back to a day all three
  // report — it does not stay at 2026-01-09 with E measured to its own last
  // observation, which would compare four days against two.
  const stops = series("E", [["2026-01-05", 10], ["2026-01-06", 11]]);
  const comparison = buildComparison([COMPLETE, WITH_GAP, stops], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  assert.equal(comparison.endpoints.endDate, "2026-01-06");
  assert.equal(comparison.ranked.length, 3);
  for (const entry of comparison.ranked) {
    assert.equal(entry.endDate, "2026-01-06");
  }
});

test("a fund whose value at the common start is unusable is excluded with a reason", () => {
  // A zero base cannot be a denominator. Measuring it anyway would produce
  // either an infinity or a silent zero, so it is dropped and explained.
  const zeroBase = series("Z", [
    ["2026-01-05", 0], ["2026-01-06", 5], ["2026-01-07", 6],
    ["2026-01-08", 7], ["2026-01-09", 8],
  ]);
  const comparison = buildComparison([COMPLETE, zeroBase], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  assert.ok(!comparison.ranked.some((r) => r.symbol === "Z"));
  const excluded = comparison.excluded.find((e) => e.symbol === "Z");
  assert.ok(excluded);
  assert.ok(excluded.reason.includes("same period"));
});
