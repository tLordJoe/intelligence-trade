/**
 * Comparison selection, windows, common endpoints, ranking and summaries.
 *
 * The endpoint tests are the important ones: they are what stop five funds
 * being measured over five slightly different periods and printed in one table
 * as though they were comparable.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  AMOUNT_PRESETS, DEFAULT_AMOUNT, HIGHEST_RETURN_LABEL, MAX_AMOUNT, MAX_FUNDS, MIN_FUNDS,
  STARTER_SYMBOLS, WINDOWS,
  availableWindows, buildComparison, canAddFund, canRemoveFund, changePercent,
  decodeState, encodeState, illustrativeValue, placeholderSections, rankReturns,
  summarize, validateAmount, validateSelection,
  type FundReturn,
} from "../src/lib/funds/compare.ts";
import { selfGeneratedRights } from "../src/lib/funds/rights.ts";
import type { PriceSeries, ReturnMethodology, SourceProvenance } from "../src/lib/funds/types.ts";

// --- helpers -----------------------------------------------------------------

const METHODOLOGY: ReturnMethodology = {
  basis: "price_return",
  splitAdjusted: false,
  distributionAdjusted: false,
  excludes: ["Everything"],
  adjustmentEvidence: "Test fixture.",
};

const PROVENANCE: SourceProvenance = {
  sourceId: "test",
  sourceName: "Test",
  kind: "demonstration",
  rights: selfGeneratedRights("test", "2026-01-01T00:00:00.000Z"),
  producedAt: "2026-01-01T00:00:00.000Z",
  method: "Fixture.",
  demonstrationLabel: "Demonstration data — not actual market performance.",
};

const DAY_MS = 86_400_000;

/** Weekday dates, `count` of them, ending on `endDate`. */
function weekdaysEndingOn(endDate: string, count: number): string[] {
  const dates: string[] = [];
  let ms = Date.parse(`${endDate}T00:00:00Z`);
  while (dates.length < count) {
    const day = new Date(ms).getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(ms).toISOString().slice(0, 10));
    ms -= DAY_MS;
  }
  return dates.reverse();
}

function makeSeries(
  symbol: string,
  dates: string[],
  valueAt: (index: number) => number
): PriceSeries {
  const values = dates.map((_, i) => valueAt(i));
  return {
    symbol,
    dates,
    values,
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

/** Six years of weekdays, which covers every window. */
const LONG_DATES = weekdaysEndingOn("2026-08-31", 1560);

function makeReturn(symbol: string, percent: number): FundReturn {
  return {
    symbol,
    changePercent: percent,
    basis: "price_return",
    startDate: "2025-09-01",
    endDate: "2026-08-31",
    startValue: 100,
    endValue: 100 * (1 + percent / 100),
    illustrativeEndValue: 1000 * (1 + percent / 100),
  };
}

// --- selection ---------------------------------------------------------------

const UNIVERSE = ["VOO", "QQQ", "XLK", "SMH", "XLU", "SOXX"];

test("selection accepts a valid set", () => {
  const result = validateSelection(["VOO", "QQQ"], UNIVERSE);
  assert.deepEqual(result.symbols, ["VOO", "QQQ"]);
  assert.equal(result.errors.length, 0);
});

test("selection normalises case and whitespace", () => {
  const result = validateSelection([" voo ", "qqq"], UNIVERSE);
  assert.deepEqual(result.symbols, ["VOO", "QQQ"]);
});

test("selection refuses an unknown symbol and says which", () => {
  const result = validateSelection(["VOO", "NOPE", "QQQ"], UNIVERSE);
  assert.deepEqual(result.symbols, ["VOO", "QQQ"]);
  const error = result.errors.find((e) => e.kind === "unknown_symbol");
  assert.ok(error && error.message.includes("NOPE"));
});

test("selection refuses a duplicate rather than showing a fund twice", () => {
  const result = validateSelection(["VOO", "VOO"], UNIVERSE);
  assert.deepEqual(result.symbols, ["VOO"]);
  assert.ok(result.errors.some((e) => e.kind === "duplicate"));
});

test("selection reports too few below the minimum", () => {
  const result = validateSelection(["VOO"], UNIVERSE);
  assert.ok(result.errors.some((e) => e.kind === "too_few"));
});

test("selection caps at the maximum and refuses the eleventh", () => {
  // Twelve synthetic symbols, because the real universe has fewer than ten.
  const many = Array.from({ length: 12 }, (_, i) => `T${String(i).padStart(2, "0")}`);
  const result = validateSelection(many, many);
  assert.equal(result.symbols.length, MAX_FUNDS);
  const tooMany = result.errors.filter((e) => e.kind === "too_many");
  assert.equal(tooMany.length, 2);
  assert.ok(tooMany[0].message.includes(String(MAX_FUNDS)));
});

test("add and remove respect the bounds", () => {
  assert.equal(canAddFund(Array(MAX_FUNDS - 1).fill("X")), true);
  assert.equal(canAddFund(Array(MAX_FUNDS).fill("X")), false);
  assert.equal(canRemoveFund(Array(MIN_FUNDS + 1).fill("X")), true);
  assert.equal(canRemoveFund(Array(MIN_FUNDS).fill("X")), false);
});

test("the starter set is five funds and is never described as a ranking", () => {
  assert.equal(STARTER_SYMBOLS.length, 5);
  assert.deepEqual([...STARTER_SYMBOLS], ["VOO", "QQQ", "XLK", "SMH", "XLU"]);
});

// --- amounts -----------------------------------------------------------------

test("amount presets are the agreed four", () => {
  assert.deepEqual([...AMOUNT_PRESETS], [100, 500, 1000, 5000]);
  assert.equal(DEFAULT_AMOUNT, 1000);
});

test("amount validation accepts formatted input", () => {
  assert.deepEqual(validateAmount("$2,500"), { valid: true, amount: 2500 });
  assert.deepEqual(validateAmount(" 750 "), { valid: true, amount: 750 });
});

test("amount validation refuses nonsense, zero, negatives and absurd values", () => {
  for (const bad of ["", "abc", "0", "-5", String(MAX_AMOUNT + 1)]) {
    const result = validateAmount(bad);
    assert.equal(result.valid, false, `expected ${bad} to be refused`);
  }
});

// --- windows -----------------------------------------------------------------

test("windows are the three agreed periods", () => {
  assert.deepEqual(WINDOWS.map((w) => w.key), ["1y", "3y", "5y"]);
});

test("a window longer than the shared history is disabled with a reason", () => {
  const long = makeSeries("A", LONG_DATES, (i) => 100 + i * 0.1);
  const short = makeSeries("B", LONG_DATES.slice(-300), (i) => 100 + i * 0.1);

  const windows = availableWindows([long, short]);
  assert.equal(windows.find((w) => w.key === "1y")?.enabled, true);
  assert.equal(windows.find((w) => w.key === "3y")?.enabled, false);
  assert.equal(windows.find((w) => w.key === "5y")?.enabled, false);

  const blocked = windows.find((w) => w.key === "5y");
  assert.ok(blocked?.reason?.includes("share"));
});

test("shared history governs the window, not the longest series", () => {
  const long = makeSeries("A", LONG_DATES, () => 100);
  const short = makeSeries("B", LONG_DATES.slice(-300), () => 100);
  const windows = availableWindows([long, short]);
  // The long series alone would support five years.
  assert.ok((windows[0].sharedYears ?? 0) < 2);
});

test("no funds selected disables every window", () => {
  for (const window of availableWindows([])) {
    assert.equal(window.enabled, false);
    assert.ok(window.reason);
  }
});

// --- common endpoints --------------------------------------------------------

test("every fund is measured between the same two dates", () => {
  const a = makeSeries("A", LONG_DATES, (i) => 100 + i * 0.05);
  const b = makeSeries("B", LONG_DATES, (i) => 100 + i * 0.02);
  const c = makeSeries("C", LONG_DATES, (i) => 100 - i * 0.01);

  const comparison = buildComparison([a, b, c], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  const starts = new Set(comparison.ranked.map((r) => r.startDate));
  const ends = new Set(comparison.ranked.map((r) => r.endDate));
  assert.equal(starts.size, 1, "all funds must share one start date");
  assert.equal(ends.size, 1, "all funds must share one end date");
  assert.equal([...starts][0], comparison.endpoints.startDate);
  assert.equal([...ends][0], comparison.endpoints.endDate);
});

test("the common endpoints are dates every fund actually reports", () => {
  const full = makeSeries("A", LONG_DATES, (i) => 100 + i * 0.05);
  // B is missing the last two hundred days' worth of odd-indexed dates.
  const sparseDates = LONG_DATES.filter((_, i) => i % 3 !== 0);
  const sparse = makeSeries("B", sparseDates, (i) => 100 + i * 0.02);

  const comparison = buildComparison([full, sparse], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  const { startDate, endDate } = comparison.endpoints;
  for (const series of [full, sparse]) {
    assert.ok(series.dates.includes(startDate), `${series.symbol} must report ${startDate}`);
    assert.ok(series.dates.includes(endDate), `${series.symbol} must report ${endDate}`);
  }
});

test("a fund with no overlap makes the comparison unmeasurable rather than approximate", () => {
  const early = makeSeries("A", weekdaysEndingOn("2021-01-29", 260), () => 100);
  const late = makeSeries("B", weekdaysEndingOn("2026-08-31", 260), () => 100);
  const comparison = buildComparison([early, late], "1y", 1000);
  assert.equal(comparison.status, "unmeasurable");
});

test("all metrics come from the same endpoints, including the amount illustration", () => {
  const a = makeSeries("A", LONG_DATES, (i) => 100 + i * 0.05);
  const b = makeSeries("B", LONG_DATES, (i) => 100 + i * 0.02);
  const comparison = buildComparison([a, b], "1y", 1000);
  assert.equal(comparison.status, "measured");
  if (comparison.status !== "measured") return;

  for (const entry of comparison.ranked) {
    const series = [a, b].find((s) => s.symbol === entry.symbol);
    assert.ok(series);
    // Values must be read at the shared dates, not at each series' own ends.
    assert.equal(entry.startValue, series.values[series.dates.indexOf(entry.startDate)]);
    assert.equal(entry.endValue, series.values[series.dates.indexOf(entry.endDate)]);
    assert.equal(
      entry.illustrativeEndValue,
      illustrativeValue(1000, entry.startValue, entry.endValue)
    );
  }
});

// --- arithmetic --------------------------------------------------------------

test("change percent is the plain ratio", () => {
  assert.equal(changePercent(100, 150), 50);
  assert.equal(changePercent(200, 100), -50);
  assert.equal(changePercent(100, 100), 0);
});

test("change percent refuses to divide by a non-positive base", () => {
  assert.equal(changePercent(0, 100), 0);
  assert.equal(changePercent(-5, 100), 0);
});

test("the amount illustration scales by the ratio and nothing else", () => {
  assert.equal(illustrativeValue(1000, 100, 150), 1500);
  assert.equal(illustrativeValue(2500, 200, 180), 2250);
});

// --- ranking -----------------------------------------------------------------

test("ranking orders by measured change, highest first", () => {
  const ranked = rankReturns([makeReturn("A", 5), makeReturn("B", 20), makeReturn("C", -3)]);
  assert.deepEqual(ranked.map((r) => r.symbol), ["B", "A", "C"]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
});

test("ties share a rank and the next rank skips", () => {
  const ranked = rankReturns([makeReturn("A", 10), makeReturn("B", 10), makeReturn("C", 5)]);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 1, 3]);
  assert.equal(ranked[0].tiedAtRank, true);
  assert.equal(ranked[1].tiedAtRank, true);
  assert.equal(ranked[2].tiedAtRank, false);
});

test("both members of a top tie are marked highest", () => {
  const ranked = rankReturns([makeReturn("A", 10), makeReturn("B", 10)]);
  assert.equal(ranked.filter((r) => r.isHighest).length, 2);
});

test("the top label is contextual and never a recommendation", () => {
  const lowered = HIGHEST_RETURN_LABEL.toLowerCase();
  assert.ok(lowered.includes("in this comparison"));
  for (const banned of ["best", "winner", "recommend", "top pick", "buy"]) {
    assert.ok(!lowered.includes(banned), `label must not contain "${banned}"`);
  }
});

// --- summary -----------------------------------------------------------------

test("the summary leads with the demonstration caveat", () => {
  const ranked = rankReturns([makeReturn("A", 10), makeReturn("B", 2)]);
  const lines = summarize(ranked, "1y", METHODOLOGY, { demonstration: true });
  assert.ok(lines[0].toLowerCase().includes("demonstration"));
});

test("the summary states the shared period and never promises anything", () => {
  const ranked = rankReturns([makeReturn("A", 10), makeReturn("B", 2)]);
  const text = summarize(ranked, "1y", METHODOLOGY, { demonstration: false }).join(" ").toLowerCase();

  assert.ok(text.includes("2025-09-01"));
  assert.ok(text.includes("2026-08-31"));
  assert.ok(text.includes("same two dates"));
  assert.ok(text.includes("past movement does not indicate future results"));
  for (const banned of ["best fund", "winner", "recommended", "will outperform", "should buy"]) {
    assert.ok(!text.includes(banned), `summary must not say "${banned}"`);
  }
});

test("a price basis is never described as total return", () => {
  const ranked = rankReturns([makeReturn("A", 10), makeReturn("B", 2)]);
  const text = summarize(ranked, "1y", METHODOLOGY, { demonstration: false }).join(" ");
  assert.ok(text.includes("not total return"));
  assert.ok(!/\bgrowth of\b/i.test(text));
});

// --- URL state ---------------------------------------------------------------

test("state round-trips through the query string", () => {
  const state = { symbols: ["SMH", "SOXX", "XLU"], amount: 2500, window: "3y" as const };
  const decoded = decodeState(encodeState(state), UNIVERSE);
  assert.deepEqual(decoded, state);
});

test("a link with a bad parameter still opens a working comparison", () => {
  const decoded = decodeState("funds=NOPE&amount=banana&period=99y", UNIVERSE);
  assert.deepEqual(decoded.symbols, [...STARTER_SYMBOLS]);
  assert.equal(decoded.amount, DEFAULT_AMOUNT);
  assert.equal(decoded.window, "1y");
});

test("a link naming one fund falls back rather than opening below the minimum", () => {
  const decoded = decodeState("funds=VOO", UNIVERSE);
  assert.ok(decoded.symbols.length >= MIN_FUNDS);
});

// --- placeholders ------------------------------------------------------------

test("every unconnected section is explicitly unavailable, never zero", () => {
  const sections = placeholderSections();
  assert.ok(sections.length >= 5);
  for (const section of sections) {
    assert.equal(section.value.status, "unavailable");
    assert.equal(section.value.reason, "source_not_connected");
    assert.ok(section.title.length > 0);
  }
});

test("total return is listed as an unconnected section, not computed", () => {
  assert.ok(placeholderSections().some((s) => s.id === "total-return"));
});
