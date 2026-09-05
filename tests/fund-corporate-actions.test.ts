/**
 * Corporate-action hooks.
 *
 * The property under test is restraint. A large move must produce an alert and
 * nothing else — no inferred ratio, no adjusted series, no confident guess that
 * a 50% fall was a 2:1 split. Every assertion below is either "an alert was
 * raised" or "the data was left alone".
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  LARGE_MOVE_THRESHOLD_PERCENT,
  announcedAhead, detectLargeDailyMoves, detectMissingDistributions,
  detectUnconfirmedActions, isConfirmed, periodIsPublishable, registerAnnouncedAction,
  type CorporateAction,
} from "../src/lib/funds/corporate-actions.ts";
import { selfGeneratedRights } from "../src/lib/funds/rights.ts";
import type { PriceSeries, ReturnMethodology, SourceProvenance } from "../src/lib/funds/types.ts";

const METHODOLOGY: ReturnMethodology = {
  basis: "price_return", splitAdjusted: false, distributionAdjusted: false,
  excludes: ["Everything"], adjustmentEvidence: "Test fixture.",
};

const PROVENANCE: SourceProvenance = {
  sourceId: "test", sourceName: "Test", kind: "demonstration",
  rights: selfGeneratedRights("test", "2026-01-01"),
  producedAt: "2026-01-01T00:00:00.000Z", method: "Fixture.",
  demonstrationLabel: "Demonstration data — not actual market performance.",
};

function series(entries: Array<[string, number]>): PriceSeries {
  const dates = entries.map(([d]) => d);
  return {
    symbol: "TEST",
    dates,
    values: entries.map(([, v]) => v),
    methodology: METHODOLOGY,
    provenance: PROVENANCE,
    coverage: { firstDate: dates[0], lastDate: dates[dates.length - 1], observations: dates.length, gaps: [] },
  };
}

function action(overrides: Partial<CorporateAction> = {}): CorporateAction {
  return {
    symbol: "TEST",
    kind: "split",
    effectiveDate: "2026-03-02",
    ratio: 10,
    confirmation: { method: "unconfirmed", sources: [], confirmedAt: null, confirmedBy: null },
    announced: false,
    ...overrides,
  };
}

// --- large moves are alerts, not conclusions ---------------------------------

test("a large one-day fall raises an alert", () => {
  const alerts = detectLargeDailyMoves(
    series([["2026-03-01", 1000], ["2026-03-02", 100]])
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "large_daily_move");
  assert.equal(alerts[0].date, "2026-03-02");
  assert.equal(alerts[0].requiresHumanReview, true);
});

test("the alert does not name a split or compute a ratio", () => {
  const [alert] = detectLargeDailyMoves(
    series([["2026-03-01", 1000], ["2026-03-02", 100]])
  );
  const detail = alert.detail.toLowerCase();
  assert.ok(!/\b10:1\b|\b10-for-1\b/.test(detail));
  assert.ok(detail.includes("could be"));
  assert.ok(detail.includes("confirm"));
});

test("detection never alters the series it inspects", () => {
  const input = series([["2026-03-01", 1000], ["2026-03-02", 100], ["2026-03-03", 101]]);
  const before = JSON.stringify(input);
  detectLargeDailyMoves(input);
  assert.equal(JSON.stringify(input), before);
});

test("ordinary movement raises nothing", () => {
  const alerts = detectLargeDailyMoves(
    series([["2026-03-01", 100], ["2026-03-02", 101], ["2026-03-03", 99]])
  );
  assert.deepEqual(alerts, []);
});

test("the threshold is a parameter, and the default is stated", () => {
  const moving = series([["2026-03-01", 100], ["2026-03-02", 110]]);
  assert.equal(detectLargeDailyMoves(moving).length, 0);
  assert.equal(detectLargeDailyMoves(moving, 5).length, 1);
  assert.equal(LARGE_MOVE_THRESHOLD_PERCENT, 15);
});

test("a rise is flagged as readily as a fall", () => {
  const alerts = detectLargeDailyMoves(series([["2026-03-01", 100], ["2026-03-02", 200]]));
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].detail.includes("+100.0%"));
});

// --- confirmation ------------------------------------------------------------

test("an unconfirmed action is not confirmed, whatever else it carries", () => {
  assert.equal(isConfirmed(action()), false);
});

test("one authoritative filing confirms; a claim with no citation does not", () => {
  assert.equal(
    isConfirmed(action({
      confirmation: {
        method: "authoritative_filing",
        sources: ["https://www.sec.gov/Archives/edgar/data/0000000000/example.htm"],
        confirmedAt: "2026-03-03", confirmedBy: "tester",
      },
    })),
    true
  );

  assert.equal(
    isConfirmed(action({
      confirmation: { method: "authoritative_filing", sources: [], confirmedAt: null, confirmedBy: null },
    })),
    false
  );
});

test("independent confirmation needs two sources, not one", () => {
  const one = action({
    confirmation: { method: "independent_sources", sources: ["a"], confirmedAt: null, confirmedBy: null },
  });
  const two = action({
    confirmation: { method: "independent_sources", sources: ["a", "b"], confirmedAt: null, confirmedBy: null },
  });
  assert.equal(isConfirmed(one), false);
  assert.equal(isConfirmed(two), true);
});

// --- missing distributions ---------------------------------------------------

test("no distributions at all is detectable", () => {
  const alerts = detectMissingDistributions("TEST", [], 91, "2026-08-31");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "possible_missing_distribution");
});

test("a gap wider than the expected interval is detectable", () => {
  const paid = (date: string): CorporateAction =>
    action({
      kind: "cash_distribution",
      effectiveDate: date,
      amountPerShare: 1,
      confirmation: { method: "authoritative_filing", sources: ["filing"], confirmedAt: date, confirmedBy: "t" },
    });

  const alerts = detectMissingDistributions(
    "TEST",
    [paid("2026-01-15"), paid("2026-04-15") /* July missing */],
    91,
    "2026-10-15"
  );
  assert.ok(alerts.length >= 1);
  assert.ok(alerts.some((a) => a.detail.includes("may be missing")));
});

test("a regular schedule raises nothing", () => {
  const paid = (date: string): CorporateAction =>
    action({
      kind: "cash_distribution", effectiveDate: date, amountPerShare: 1,
      confirmation: { method: "authoritative_filing", sources: ["filing"], confirmedAt: date, confirmedBy: "t" },
    });

  const alerts = detectMissingDistributions(
    "TEST",
    [paid("2026-01-15"), paid("2026-04-15"), paid("2026-07-15")],
    91,
    "2026-08-15"
  );
  assert.deepEqual(alerts, []);
});

// --- announced actions -------------------------------------------------------

test("an action ahead of today registers as announced", () => {
  const registered = registerAnnouncedAction(
    { symbol: "TEST", kind: "split", effectiveDate: "2026-12-01", ratio: 4,
      confirmation: { method: "authoritative_filing", sources: ["filing"], confirmedAt: "2026-09-05", confirmedBy: "t" } },
    "2026-09-05"
  );
  assert.equal(registered.announced, true);
});

test("an action already past is not announced", () => {
  const registered = registerAnnouncedAction(
    { symbol: "TEST", kind: "split", effectiveDate: "2026-01-01",
      confirmation: { method: "unconfirmed", sources: [], confirmedAt: null, confirmedBy: null } },
    "2026-09-05"
  );
  assert.equal(registered.announced, false);
});

test("announced actions are surfaced as alerts so the change is expected", () => {
  const alerts = announcedAhead([action({ effectiveDate: "2027-01-04" })], "2026-09-05");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, "announced_action_ahead");
});

// --- publishability ----------------------------------------------------------

test("an unconfirmed action inside the window blocks publication", () => {
  const alerts = detectUnconfirmedActions([action({ effectiveDate: "2026-03-02" })], "2026-01-01", "2026-12-31");
  assert.equal(alerts.length, 1);
  assert.equal(periodIsPublishable(alerts).ok, false);
});

test("a confirmed action inside the window does not block publication", () => {
  const confirmed = action({
    confirmation: { method: "authoritative_filing", sources: ["filing"], confirmedAt: "2026-03-03", confirmedBy: "t" },
  });
  assert.deepEqual(detectUnconfirmedActions([confirmed], "2026-01-01", "2026-12-31"), []);
});

test("an unconfirmed action outside the window does not block it", () => {
  const alerts = detectUnconfirmedActions([action({ effectiveDate: "2020-01-02" })], "2026-01-01", "2026-12-31");
  assert.deepEqual(alerts, []);
});

test("a large move alone does not block publication — plenty of them are just large moves", () => {
  const alerts = detectLargeDailyMoves(series([["2026-03-01", 100], ["2026-03-02", 60]]));
  assert.equal(alerts.length, 1);
  assert.equal(periodIsPublishable(alerts).ok, true);
});
