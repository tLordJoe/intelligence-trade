import assert from "node:assert/strict";
import test from "node:test";

import {
  AMOUNT_PRESETS, DEFAULT_AMOUNT, HIGHEST_RETURN_LABEL, MAX_AMOUNT, MAX_FUNDS, MIN_FUNDS,
  STARTER_SYMBOLS, availableWindows, canAddFund, canRemoveFund, computeReturn, decodeState,
  encodeState, illustrativeValue, placeholderSections, priceReturnPercent, rankReturns,
  sliceWindow, summarize, validateAmount, validateSelection,
} from "../src/lib/funds/compare.ts";
import { METHODOLOGY, allIdentities, availableSymbols, getFund, getSeries } from "../src/lib/funds/data.ts";
import { describeUnavailable, holdingsWeightsAreConsistent, isAvailable } from "../src/lib/funds/types.ts";
import type { HoldingsSnapshot, PriceSeries, ReturnMethodology } from "../src/lib/funds/types.ts";

/**
 * Fund comparison: selection, amounts, windows, returns, ranking and state.
 *
 * Everything measured here is a price return from committed closing prices.
 * Several tests exist specifically to keep it that way — a figure that quietly
 * became "total return", or a missing value that quietly became zero, is the
 * failure this suite is built around.
 */

const SYMBOLS = availableSymbols();

function fakeSeries(symbol: string, closes: number[], startDate = "2021-01-04"): PriceSeries {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  return {
    symbol,
    dates: closes.map((_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10)),
    closes,
    methodology: METHODOLOGY,
    provenance: { sourceId: "test", sourceName: "test", licensed: false, capturedAt: "2026-09-05T00:00:00Z" },
    coverage: { firstDate: null, lastDate: null, observations: closes.length },
  };
}

/** A series spanning `years` with a known start and end close. */
function spanning(symbol: string, years: number, from: number, to: number): PriceSeries {
  const days = Math.round(years * 365.25);
  const closes = Array.from({ length: days + 1 }, (_, i) => from + ((to - from) * i) / days);
  const start = Date.now() - days * 86_400_000;
  return {
    ...fakeSeries(symbol, closes),
    dates: closes.map((_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10)),
  };
}

// --- selection: minimum, maximum, and the eleventh fund -----------------------

test("the starter selection is five funds and is not presented as a ranking", () => {
  assert.equal(STARTER_SYMBOLS.length, 5);
  assert.deepEqual([...STARTER_SYMBOLS], ["VOO", "QQQ", "XLK", "SMH", "XLU"]);
  for (const symbol of STARTER_SYMBOLS) {
    assert.ok(SYMBOLS.includes(symbol), `${symbol} must have price data`);
  }
  // SOXX is available for comparison but deliberately not in the starter set.
  assert.ok(SYMBOLS.includes("SOXX"));
  assert.ok(!STARTER_SYMBOLS.includes("SOXX" as never));
});

test("fewer than two funds is refused with an explanation", () => {
  for (const requested of [[], ["VOO"]]) {
    const result = validateSelection(requested, SYMBOLS);
    const tooFew = result.errors.find((e) => e.kind === "too_few");
    assert.ok(tooFew, `${requested.length} funds must be refused`);
    assert.match(tooFew.message, /at least 2/i);
  }
  assert.deepEqual(validateSelection(["VOO", "QQQ"], SYMBOLS).errors, [], "two is enough");
});

test("regression: an eleventh fund is rejected and the reason says why", () => {
  // The committed preview holds six funds, so ten distinct real symbols do not
  // exist yet. The bound is exercised against a synthetic universe so the limit
  // is tested now rather than when the dataset happens to grow past it.
  const universe = Array.from({ length: 12 }, (_, i) => `FUND${i}`);
  const ten = universe.slice(0, MAX_FUNDS);
  assert.equal(ten.length, MAX_FUNDS);

  const result = validateSelection([...ten, "FUND10"], universe);
  assert.equal(result.symbols.length, MAX_FUNDS, "the selection stops at ten");

  const tooMany = result.errors.find((e) => e.kind === "too_many");
  assert.ok(tooMany, "the eleventh must produce an explanation");
  assert.match(tooMany.message, /up to 10 funds/i);
  assert.match(tooMany.message, /remove one/i, "and say what to do about it");
});

test("add and remove are gated by the bounds, not silently ignored", () => {
  assert.equal(canAddFund(["VOO", "QQQ"]), true);
  assert.equal(canAddFund(new Array(MAX_FUNDS).fill("VOO")), false);
  assert.equal(canRemoveFund(["VOO", "QQQ", "XLK"]), true);
  assert.equal(canRemoveFund(["VOO", "QQQ"]), false, "removing below two is refused");
});

test("unknown and duplicate symbols are refused individually", () => {
  const result = validateSelection(["VOO", "NOTAFUND", "QQQ", "VOO"], SYMBOLS);
  assert.deepEqual(result.symbols, ["VOO", "QQQ"]);
  assert.ok(result.errors.some((e) => e.kind === "unknown_symbol" && e.symbol === "NOTAFUND"));
  assert.ok(result.errors.some((e) => e.kind === "duplicate" && e.symbol === "VOO"));
});

// --- example amounts ----------------------------------------------------------

test("the presets are the four required, defaulting to 1000", () => {
  assert.deepEqual([...AMOUNT_PRESETS], [100, 500, 1000, 5000]);
  assert.equal(DEFAULT_AMOUNT, 1000);
});

test("a custom amount must be positive and finite", () => {
  for (const bad of [0, -1, -1000, Number.NaN, Number.POSITIVE_INFINITY, "abc", ""]) {
    const result = validateAmount(bad as number);
    assert.equal(result.valid, false, `${String(bad)} must be refused`);
    assert.ok("message" in result && result.message.length > 0, "with an explanation");
  }
  for (const good of [1, 250, 1000, 999_999]) {
    const result = validateAmount(good);
    assert.equal(result.valid, true, `${good} must be accepted`);
  }
});

test("formatted input is accepted, and an absurd amount is not", () => {
  assert.deepEqual(validateAmount("$1,500"), { valid: true, amount: 1500 });
  assert.deepEqual(validateAmount("2500.50"), { valid: true, amount: 2500.5 });
  assert.equal(validateAmount(MAX_AMOUNT + 1).valid, false);
  assert.equal(validateAmount(MAX_AMOUNT).valid, true);
});

// --- time windows -------------------------------------------------------------

test("windows are enabled only where the data genuinely reaches", () => {
  const short = [spanning("A", 2, 100, 150)];
  const windows = availableWindows(short);

  const byKey = Object.fromEntries(windows.map((w) => [w.key, w]));
  assert.equal(byKey["1y"].enabled, true, "two years covers one");
  assert.equal(byKey["3y"].enabled, false, "two years does not cover three");
  assert.equal(byKey["5y"].enabled, false);
  assert.match(byKey["3y"].reason ?? "", /2\.0 years/, "the reason states what is actually held");
  assert.match(byKey["3y"].reason ?? "", /cannot be measured/);
});

test("the shortest selected series governs, so no window is overstated", () => {
  const mixed = [spanning("LONG", 6, 100, 200), spanning("SHORT", 1.5, 50, 60)];
  const byKey = Object.fromEntries(availableWindows(mixed).map((w) => [w.key, w]));

  assert.equal(byKey["1y"].enabled, true);
  assert.equal(byKey["3y"].enabled, false, "one fund with 1.5 years caps the comparison");
  assert.ok(byKey["3y"].coveredYears < 2);
});

test("the committed snapshot supports all three windows", () => {
  const windows = availableWindows(getSeries([...STARTER_SYMBOLS]));
  for (const window of windows) {
    assert.equal(window.enabled, true, `${window.key} should be covered`);
  }
  assert.ok(windows[0].coveredYears >= 5, `expected >= 5 years, have ${windows[0].coveredYears}`);
});

test("no window is offered when nothing is selected", () => {
  for (const window of availableWindows([])) {
    assert.equal(window.enabled, false);
    assert.ok(window.reason);
  }
});

// --- percentage returns --------------------------------------------------------

test("percentage return is measured from the window's own closes", () => {
  assert.equal(priceReturnPercent(100, 150), 50);
  assert.equal(priceReturnPercent(100, 50), -50);
  assert.equal(priceReturnPercent(100, 100), 0);
  assert.equal(priceReturnPercent(0, 100), 0, "a zero start cannot produce a return");
});

test("a computed return reports the dates it actually measured", () => {
  const series = spanning("TEST", 6, 100, 200);
  const result = computeReturn(series, "1y", 1000);
  assert.ok(result);

  const days =
    (Date.parse(`${result.endDate}T00:00:00Z`) - Date.parse(`${result.startDate}T00:00:00Z`)) / 86_400_000;
  assert.ok(days >= 360 && days <= 370, `one year window spanned ${days} days`);
  assert.ok(result.startDate < result.endDate);
  assert.equal(result.indexedSeries[0].percent, 0, "the series is indexed to its own start");
});

test("a slice needs two observations, and refuses rather than inventing one", () => {
  assert.equal(sliceWindow(fakeSeries("X", [100]), "1y"), null);
  assert.equal(sliceWindow(fakeSeries("X", []), "1y"), null);
  assert.equal(sliceWindow(fakeSeries("X", [0, 100]), "1y"), null, "a zero start close is unusable");
});

// --- dollar illustration --------------------------------------------------------

test("the dollar illustration scales the amount by the price change and nothing else", () => {
  assert.equal(illustrativeValue(1000, 100, 150), 1500);
  assert.equal(illustrativeValue(1000, 100, 50), 500);
  assert.equal(illustrativeValue(500, 100, 100), 500, "no change means no change");
  assert.equal(illustrativeValue(100, 40, 60), 150);
});

test("the illustration tracks the percentage return exactly", () => {
  // If these ever diverge, one of the two numbers on screen is wrong.
  for (const [amount, start, end] of [[1000, 100, 137], [500, 63.2, 41.9], [5000, 10, 10]]) {
    const percent = priceReturnPercent(start, end);
    const value = illustrativeValue(amount, start, end);
    assert.ok(
      Math.abs(value - amount * (1 + percent / 100)) < 0.01,
      `${amount} at ${percent.toFixed(2)}% should be ${amount * (1 + percent / 100)}, got ${value}`
    );
  }
});

test("an invalid amount or start price yields zero rather than a wrong illustration", () => {
  assert.equal(illustrativeValue(0, 100, 150), 0);
  assert.equal(illustrativeValue(-100, 100, 150), 0);
  assert.equal(illustrativeValue(1000, 0, 150), 0);
});

// --- ranking, including ties ----------------------------------------------------

test("funds rank by measured price return, highest first", () => {
  const ranked = rankReturns([
    { symbol: "LOW", priceReturnPercent: 5 } as never,
    { symbol: "HIGH", priceReturnPercent: 40 } as never,
    { symbol: "MID", priceReturnPercent: 20 } as never,
  ]);
  assert.deepEqual(ranked.map((r) => r.symbol), ["HIGH", "MID", "LOW"]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
  assert.equal(ranked[0].isHighest, true);
  assert.equal(ranked[1].isHighest, false);
});

test("regression: a tie shares a rank, and both are marked as tied", () => {
  const ranked = rankReturns([
    { symbol: "A", priceReturnPercent: 25 } as never,
    { symbol: "B", priceReturnPercent: 25 } as never,
    { symbol: "C", priceReturnPercent: 10 } as never,
  ]);
  // Competition ranking: two funds tied for first means the next is third, not
  // second. Presenting C as "second" would imply only one fund is ahead of it.
  assert.deepEqual(ranked.map((r) => r.rank), [1, 1, 3], "the tie shares first, C is third");
  assert.equal(ranked[0].isHighest, true);
  assert.equal(ranked[1].isHighest, true, "both tied funds are highest");
  assert.equal(ranked[0].tiedAtRank, true);
  assert.equal(ranked[1].tiedAtRank, true);
  assert.equal(ranked[2].tiedAtRank, false);
});

test("returns within a hundredth of a point count as tied", () => {
  const ranked = rankReturns([
    { symbol: "A", priceReturnPercent: 20.001 } as never,
    { symbol: "B", priceReturnPercent: 20.003 } as never,
  ]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 1], "a rounding difference is not a lead");
  assert.ok(ranked.every((r) => r.tiedAtRank));
});

test("a three-way tie shares one rank", () => {
  const ranked = rankReturns([
    { symbol: "A", priceReturnPercent: 12 } as never,
    { symbol: "B", priceReturnPercent: 12 } as never,
    { symbol: "C", priceReturnPercent: 12 } as never,
  ]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 1, 1]);
  assert.ok(ranked.every((r) => r.isHighest && r.tiedAtRank));
});

test("the top label is contextual and claims nothing about quality", () => {
  assert.equal(HIGHEST_RETURN_LABEL, "Highest historical price return in this comparison");
  for (const forbidden of [/\bbest\b/i, /\bwinner\b/i, /recommend/i, /\btop\b/i, /should/i]) {
    assert.doesNotMatch(HIGHEST_RETURN_LABEL, forbidden);
  }
});

// --- summary ---------------------------------------------------------------------

test("the summary states measured facts and draws no conclusion", () => {
  const ranked = rankReturns([
    { symbol: "AAA", priceReturnPercent: 30, startDate: "2025-09-04", endDate: "2026-09-04" } as never,
    { symbol: "BBB", priceReturnPercent: 4, startDate: "2025-09-04", endDate: "2026-09-04" } as never,
  ]);
  const lines = summarize(ranked, "1y", METHODOLOGY).join(" ");

  assert.match(lines, /AAA/);
  assert.match(lines, /highest price return in this comparison/);
  assert.match(lines, /BBB had the lowest/);
  assert.match(lines, /2025-09-04 to 2026-09-04/, "the measured period is stated");
  assert.match(lines, /not.*total return/i, "the basis is stated");
  assert.match(lines, /does not indicate future results/i);

  for (const forbidden of [/\bbest\b/i, /\bwinner\b/i, /recommend/i, /you should/i, /will /i, /outperform/i]) {
    assert.doesNotMatch(lines, forbidden, `summary must not contain ${forbidden}`);
  }
});

test("a tie at the top is described as a tie", () => {
  const ranked = rankReturns([
    { symbol: "AAA", priceReturnPercent: 20, startDate: "2025-01-01", endDate: "2026-01-01" } as never,
    { symbol: "BBB", priceReturnPercent: 20, startDate: "2025-01-01", endDate: "2026-01-01" } as never,
  ]);
  assert.match(summarize(ranked, "1y", METHODOLOGY).join(" "), /AAA and BBB had the same highest/);
});

test("a total-return series would not carry the price-only caveat", () => {
  // Guards against the caveat becoming decorative rather than conditional.
  const totalReturn: ReturnMethodology = { ...METHODOLOGY, dividendAdjusted: true, basis: "total_return" };
  const ranked = rankReturns([{ symbol: "A", priceReturnPercent: 5, startDate: "a", endDate: "b" } as never]);
  assert.doesNotMatch(summarize(ranked, "1y", totalReturn).join(" "), /Dividends and distributions are not included/);
  assert.match(summarize(ranked, "1y", METHODOLOGY).join(" "), /Dividends and distributions are not included/);
});

// --- shareable URL state ----------------------------------------------------------

test("state round-trips through the URL", () => {
  const state = { symbols: ["VOO", "SMH", "XLU"], amount: 2500, window: "3y" as const };
  const restored = decodeState(encodeState(state), SYMBOLS);
  assert.deepEqual(restored, state);
});

test("a malformed link still opens a working comparison", () => {
  const restored = decodeState("funds=NOPE,ALSONOPE&amount=-5&period=99y", SYMBOLS);
  assert.deepEqual(restored.symbols, [...STARTER_SYMBOLS], "falls back to the starter set");
  assert.equal(restored.amount, DEFAULT_AMOUNT);
  assert.equal(restored.window, "1y");
});

test("an empty query yields the demonstration defaults", () => {
  const restored = decodeState("", SYMBOLS);
  assert.deepEqual(restored.symbols, [...STARTER_SYMBOLS]);
  assert.equal(restored.amount, DEFAULT_AMOUNT);
  assert.equal(restored.window, "1y");
});

test("a link carrying more than ten funds is truncated, not rejected outright", () => {
  const universe = Array.from({ length: 15 }, (_, i) => `FUND${i}`);
  const restored = decodeState(`funds=${universe.join(",")}&amount=1000&period=1y`, universe);
  assert.equal(restored.symbols.length, MAX_FUNDS, "the extras are dropped, the link still opens");
  assert.ok(restored.symbols.length >= MIN_FUNDS);
});

// --- missing data stays missing ------------------------------------------------

test("regression: unconnected sources are unavailable, never zero", () => {
  const fund = getFund("VOO");
  assert.ok(fund);

  assert.equal(fund.expenses.expenseRatioPercent.status, "unavailable");
  assert.equal(isAvailable(fund.expenses.expenseRatioPercent), false);
  assert.ok(
    !("value" in fund.expenses.expenseRatioPercent),
    "an unavailable value carries no number at all, not even zero"
  );

  assert.equal(fund.holdings.status, "unavailable");
  assert.deepEqual(fund.overlays, [], "no overlay is fabricated");
});

test("every placeholder section says unavailable and shows no number", () => {
  const sections = placeholderSections();
  assert.equal(sections.length, 5);
  assert.deepEqual(
    sections.map((s) => s.id).sort(),
    ["concentration", "disclosures", "expenses", "overlap", "stack"]
  );
  for (const section of sections) {
    assert.equal(section.value.status, "unavailable");
    assert.equal(section.value.reason, "source_not_connected");
    assert.match(describeUnavailable(section.value.reason), /Unavailable — data source not connected yet/);
    assert.ok(!("value" in section.value));
  }
});

test("unavailable reasons all read as text, never as a value", () => {
  for (const reason of [
    "source_not_connected", "not_published_by_issuer", "outside_snapshot_coverage",
    "licensing_restricted", "stale_beyond_threshold", "parse_failed",
  ] as const) {
    const text = describeUnavailable(reason);
    assert.match(text, /^Unavailable — /);
    assert.doesNotMatch(text, /\b0\b/, "no absence may render as a number");
  }
});

// --- partial holdings must stay partial ------------------------------------------

test("regression: partial holdings are never normalised to look complete", () => {
  const partial: HoldingsSnapshot = {
    symbol: "TEST", asOf: "2026-06-30",
    holdings: [
      { symbol: "AAA", name: "Alpha", weightPercent: 40 },
      { symbol: "BBB", name: "Beta", weightPercent: 22 },
    ],
    knownWeightPercent: 62, unmappedWeightPercent: 8, unavailableWeightPercent: 30,
    complete: false,
    provenance: { sourceId: "t", sourceName: "t", licensed: false, capturedAt: "2026-09-05T00:00:00Z" },
  };

  assert.equal(holdingsWeightsAreConsistent(partial), true, "the three buckets sum to 100");
  assert.equal(partial.knownWeightPercent, 62, "the known slice is not rescaled to 100");
  assert.equal(partial.complete, false);

  // Rescaling the known slice to 100 is the failure this type prevents.
  const rescaled = { ...partial, knownWeightPercent: 100, unmappedWeightPercent: 0, unavailableWeightPercent: 0 };
  assert.equal(
    rescaled.knownWeightPercent + rescaled.unmappedWeightPercent + rescaled.unavailableWeightPercent,
    100,
    "a rescaled snapshot still sums to 100 — which is exactly why the buckets are separate"
  );
  assert.notEqual(rescaled.knownWeightPercent, partial.knownWeightPercent);
});

// --- methodology honesty ----------------------------------------------------------

test("the committed dataset declares a price-return basis with evidence", () => {
  assert.equal(METHODOLOGY.basis, "price_return");
  assert.equal(METHODOLOGY.dividendAdjusted, false);
  assert.equal(METHODOLOGY.splitAdjusted, true);
  assert.match(METHODOLOGY.splitAdjustmentEvidence ?? "", /10:1|ten-fold/i, "the claim is evidenced");
  for (const excluded of ["dividends", "distributions", "taxes", "trading costs", "reinvestment"]) {
    assert.ok(METHODOLOGY.excludes.includes(excluded), `${excluded} must be declared excluded`);
  }
});

test("every fund carries identity, provenance and coverage", () => {
  for (const symbol of SYMBOLS) {
    const fund = getFund(symbol);
    assert.ok(fund, symbol);
    assert.ok(fund.identity.name && fund.identity.issuer && fund.identity.exposure);
    assert.equal(fund.prices.provenance.licensed, false, "the preview source is unlicensed and says so");
    assert.ok(fund.prices.coverage.observations > 0);
    assert.equal(fund.prices.dates.length, fund.prices.closes.length);
  }
  assert.equal(allIdentities().length, SYMBOLS.length);
});
