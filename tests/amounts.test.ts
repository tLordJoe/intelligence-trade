import assert from "node:assert/strict";
import test from "node:test";
import {
  averageAmount,
  filterByAmount,
  formatAmount,
  hasAmount,
  midpoint,
  sortByAmount,
  totalAmount,
  totalLowerBound,
  withAmount,
  withoutAmount,
} from "../src/lib/amounts.ts";
import type { AmountStatus } from "../src/lib/congress-schema.ts";

/**
 * A missing amount must never behave like zero.
 *
 * Two records were stored as `amountLow: 0, amountHigh: 0` because the parser
 * recognised only ranges and both filings disclosed an exact figure. Nothing
 * downstream could tell "$0" from "not disclosed", so both would have pulled
 * every average they appeared in toward zero.
 */

function rec(
  amount: string,
  low: number | null,
  high: number | null,
  amountStatus: AmountStatus
) {
  return { amount, amountLow: low, amountHigh: high, amountStatus };
}

const RANGE_A = rec("$1,001 - $15,000", 1001, 15000, "disclosed_range");
const RANGE_B = rec("$15,001 - $50,000", 15001, 50000, "disclosed_range");
const EXACT = rec("$2,722.50", 2722.5, 2722.5, "disclosed_exact");
const NOT_DISCLOSED = rec("", null, null, "not_disclosed");
const NOT_APPLICABLE = rec("", null, null, "not_applicable");
const PARSE_FAILED = rec("", null, null, "parse_failed");

// --- the core guarantee ------------------------------------------------------

test("regression: a missing amount contributes nothing to a total", () => {
  const withMissing = totalAmount([RANGE_A, NOT_DISCLOSED]);
  const withoutMissing = totalAmount([RANGE_A]);

  assert.equal(withMissing.value, withoutMissing.value, "the total is unchanged");
  assert.equal(withMissing.excluded, 1, "and the exclusion is reported");
  assert.equal(withMissing.included, 1);
});

test("regression: a missing amount does not drag an average toward zero", () => {
  const clean = averageAmount([RANGE_A, RANGE_B]);
  const withMissing = averageAmount([RANGE_A, RANGE_B, NOT_DISCLOSED]);

  assert.equal(withMissing.value, clean.value, "mean is over amounts that exist");
  assert.equal(withMissing.excluded, 1);

  // The specific defect: had the record counted as $0, the mean would fall.
  const asZero = (8000.5 + 32500.5 + 0) / 3;
  assert.notEqual(withMissing.value, asZero);
});

test("every amountless status is excluded, not just one of them", () => {
  for (const record of [NOT_DISCLOSED, NOT_APPLICABLE, PARSE_FAILED]) {
    assert.equal(hasAmount(record), false, record.amountStatus);
    assert.equal(midpoint(record), null, record.amountStatus);
    assert.equal(totalAmount([RANGE_A, record]).value, midpoint(RANGE_A));
  }
});

test("a total over nothing but amountless records is null, never zero", () => {
  const result = totalAmount([NOT_DISCLOSED, PARSE_FAILED]);
  assert.equal(result.value, null, "null says 'unknown'; 0 would claim 'none'");
  assert.equal(result.excluded, 2);
  assert.equal(result.included, 0);
});

test("a status claiming a number but carrying null bounds is not trusted", () => {
  // Defends the invariant at the boundary: a hand-edited or partially migrated
  // record must not be aggregated on the strength of its status alone.
  const inconsistent = rec("$1,001 - $15,000", null, null, "disclosed_range");
  assert.equal(hasAmount(inconsistent), false);
  assert.equal(totalAmount([inconsistent]).value, null);
});

test("lower-bound totals also exclude rather than zero", () => {
  const result = totalLowerBound([RANGE_A, RANGE_B, NOT_DISCLOSED]);
  assert.equal(result.value, 1001 + 15001);
  assert.equal(result.excluded, 1);
});

// --- exact amounts are real amounts -----------------------------------------

test("an exact disclosed figure aggregates as a real amount", () => {
  assert.equal(hasAmount(EXACT), true);
  assert.equal(midpoint(EXACT), 2722.5);
  assert.equal(totalAmount([EXACT]).value, 2722.5);
  assert.equal(totalAmount([EXACT]).excluded, 0);
});

test("parser failures stay distinguishable from not-applicable amounts", () => {
  // Both are excluded from arithmetic, but they are different facts and the
  // record must keep saying which it is.
  assert.equal(hasAmount(PARSE_FAILED), false);
  assert.equal(hasAmount(NOT_APPLICABLE), false);
  assert.notEqual(PARSE_FAILED.amountStatus, NOT_APPLICABLE.amountStatus);
  assert.notEqual(formatAmount(PARSE_FAILED), formatAmount(NOT_APPLICABLE));
  assert.match(formatAmount(PARSE_FAILED), /unreadable/i);
  assert.match(formatAmount(NOT_APPLICABLE), /not applicable/i);
});

// --- sorting and filtering ---------------------------------------------------

test("records without an amount sort last in both directions", () => {
  const input = [NOT_DISCLOSED, RANGE_B, RANGE_A];

  const desc = sortByAmount(input, "desc");
  assert.deepEqual(
    desc.map((r) => r.amountStatus),
    ["disclosed_range", "disclosed_range", "not_disclosed"]
  );
  assert.equal(desc[0], RANGE_B, "largest first");

  const asc = sortByAmount(input, "asc");
  assert.equal(asc[0], RANGE_A, "smallest first");
  assert.equal(
    asc[asc.length - 1].amountStatus,
    "not_disclosed",
    "unknown is not 'smallest' — it sorts last ascending too"
  );
});

test("amount filters never match a record without an amount", () => {
  const input = [RANGE_A, NOT_DISCLOSED, PARSE_FAILED];
  assert.deepEqual(filterByAmount(input, { min: 0 }), [RANGE_A]);
  assert.deepEqual(filterByAmount(input, { max: 1_000_000 }), [RANGE_A]);
  assert.deepEqual(filterByAmount(input, { max: 0 }), []);
});

test("partitioning helpers agree with hasAmount", () => {
  const input = [RANGE_A, NOT_DISCLOSED, EXACT, PARSE_FAILED];
  assert.deepEqual(withAmount(input), [RANGE_A, EXACT]);
  assert.deepEqual(withoutAmount(input), [NOT_DISCLOSED, PARSE_FAILED]);
});

// --- display -----------------------------------------------------------------

test("a legitimately amountless exchange displays an honest label, never blank", () => {
  // Pelosi's Versant spinoff is an Exchange; a blank cell reads as zero.
  const label = formatAmount(NOT_APPLICABLE);
  assert.notEqual(label.trim(), "");
  assert.equal(label, "Not applicable");
  assert.doesNotMatch(label, /\$/, "no dollar sign for an amount that has none");
  assert.doesNotMatch(label, /\b0\b/);
});

test("not-disclosed displays its own label", () => {
  assert.equal(formatAmount(NOT_DISCLOSED), "Not disclosed");
});

test("a disclosed amount displays its disclosed text", () => {
  assert.equal(formatAmount(RANGE_A), "$1,001 - $15,000");
  assert.equal(formatAmount(EXACT), "$2,722.50");
});

test("a record with numeric bounds but no text still renders a label", () => {
  const odd = rec("", 1001, 15000, "disclosed_range");
  assert.notEqual(formatAmount(odd).trim(), "");
});
