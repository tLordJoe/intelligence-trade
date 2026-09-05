/**
 * Holdings: partial stays partial, and comparison needs a shared date.
 *
 * Two failures being guarded against.
 *
 * Normalising a partial snapshot to 100% turns "we can see two thirds of this
 * fund" into "this is the whole fund", and every concentration and overlap
 * figure computed afterwards inherits the lie without carrying any trace of it.
 *
 * Comparing one fund's June snapshot with another's March snapshot and calling
 * the difference overlap measures the reporting calendar rather than the
 * portfolios.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  available, holdingsComparisonBasis, holdingsMayBePublished, holdingsWeightsAreConsistent,
  unavailable,
  type HoldingsHistory, type HoldingsSnapshot, type SourceProvenance,
} from "../src/lib/funds/types.ts";
import { selfGeneratedRights, unknownRights, type DataRights } from "../src/lib/funds/rights.ts";

function provenance(rights: DataRights): SourceProvenance {
  return {
    sourceId: "issuer", sourceName: "Issuer", kind: "licensed", rights,
    producedAt: "2026-06-30T00:00:00.000Z", method: "Issuer publication.",
  };
}

const OPEN_RIGHTS = selfGeneratedRights("test", "2026-01-01");

function snapshot(
  symbol: string,
  asOf: string,
  known: number,
  unmapped: number,
  unavailableWeight: number
): HoldingsSnapshot {
  return {
    symbol,
    asOf,
    holdings: [{ symbol: "NVDA", name: "Example position", weightPercent: known }],
    knownWeightPercent: known,
    unmappedWeightPercent: unmapped,
    unavailableWeightPercent: unavailableWeight,
    complete: unavailableWeight === 0 && unmapped === 0,
    provenance: provenance(OPEN_RIGHTS),
  };
}

function history(symbol: string, dates: string[]): HoldingsHistory {
  const snapshots = dates.map((date) => snapshot(symbol, date, 62, 8, 30));
  return {
    symbol,
    snapshots,
    latest: snapshots.length > 0
      ? available(snapshots[snapshots.length - 1], snapshots[snapshots.length - 1].asOf, "issuer")
      : unavailable("not_published_by_issuer"),
  };
}

// --- partial stays partial ---------------------------------------------------

test("the three weight buckets sum to one hundred", () => {
  assert.equal(holdingsWeightsAreConsistent(snapshot("A", "2026-06-30", 62, 8, 30)), true);
});

test("a partial snapshot normalised to 100 is rejected as inconsistent", () => {
  // What renormalisation produces: the known slice scaled up, the rest erased.
  const normalised = snapshot("A", "2026-06-30", 100, 8, 30);
  assert.equal(holdingsWeightsAreConsistent(normalised), false);
});

test("undisclosed portfolio is recorded, not dropped", () => {
  const partial = snapshot("A", "2026-06-30", 62, 8, 30);
  assert.equal(partial.unavailableWeightPercent, 30);
  assert.equal(partial.complete, false);
});

test("only a fully disclosed portfolio is marked complete", () => {
  assert.equal(snapshot("A", "2026-06-30", 100, 0, 0).complete, true);
  assert.equal(snapshot("A", "2026-06-30", 62, 8, 30).complete, false);
});

// --- the common comparison date ----------------------------------------------

test("funds are compared at the latest holdings date they all report", () => {
  const basis = holdingsComparisonBasis([
    history("A", ["2026-03-31", "2026-06-30"]),
    history("B", ["2026-03-31", "2026-06-30", "2026-07-31"]),
  ]);

  assert.equal(basis.commonDate.status, "available");
  if (basis.commonDate.status !== "available") return;
  // Not B's 2026-07-31, which A has not reported.
  assert.equal(basis.commonDate.value, "2026-06-30");
});

test("each fund's own snapshot date is reported alongside the common one", () => {
  const basis = holdingsComparisonBasis([
    history("A", ["2026-03-31", "2026-06-30"]),
    history("B", ["2026-03-31", "2026-06-30", "2026-07-31"]),
  ]);

  assert.deepEqual(basis.perFund, [
    { symbol: "A", ownSnapshotDate: "2026-06-30" },
    { symbol: "B", ownSnapshotDate: "2026-07-31" },
  ]);
});

test("no shared date means unavailable, not a comparison across different dates", () => {
  const basis = holdingsComparisonBasis([
    history("A", ["2026-03-31"]),
    history("B", ["2026-06-30"]),
  ]);

  assert.equal(basis.commonDate.status, "unavailable");
  if (basis.commonDate.status !== "unavailable") return;
  assert.equal(basis.commonDate.reason, "no_common_date");
});

test("no holdings at all is unavailable, never an empty portfolio", () => {
  const basis = holdingsComparisonBasis([]);
  assert.equal(basis.commonDate.status, "unavailable");
  assert.deepEqual(basis.perFund, []);
});

// --- publication rights ------------------------------------------------------

test("issuer holdings are not published without both republication and analysis rights", () => {
  assert.equal(holdingsMayBePublished(provenance(unknownRights("not examined"))), false);

  const displayOnly: DataRights = {
    grants: ["public-display-authorized"], basis: "t", reviewedAt: "2026-01-01", reviewedBy: "t",
  };
  assert.equal(holdingsMayBePublished(provenance(displayOnly)), false);

  const redistributeOnly: DataRights = {
    grants: ["public-display-authorized", "redistribution-authorized"],
    basis: "t", reviewedAt: "2026-01-01", reviewedBy: "t",
  };
  assert.equal(
    holdingsMayBePublished(provenance(redistributeOnly)),
    false,
    "derived analysis is a separate permission"
  );
});

test("both rights together permit publication", () => {
  const full: DataRights = {
    grants: ["public-display-authorized", "redistribution-authorized", "derived-analytics-authorized"],
    basis: "t", reviewedAt: "2026-01-01", reviewedBy: "t",
  };
  assert.equal(holdingsMayBePublished(provenance(full)), true);
});
