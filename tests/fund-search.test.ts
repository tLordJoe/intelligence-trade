import test from "node:test";
import assert from "node:assert/strict";
import {normalizeTypedSymbol, searchInstruments, type SearchInstrument} from "../src/lib/funds/search.ts";
import {decodeState, encodeState, MAX_FUNDS} from "../src/lib/funds/compare.ts";
import {buildComparisonDataset} from "../src/lib/funds/data.ts";
import {seriesFrom, compareDatasetSelection} from "../src/lib/funds/dataset.ts";

const catalog: SearchInstrument[] = [
  {symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "fund"},
  {symbol: "MSFT", name: "Microsoft", kind: "stock"},
];
test("search matches names and tickers case-insensitively", () => {
  assert.equal(searchInstruments(catalog, "micro")[0].symbol, "MSFT");
  assert.equal(searchInstruments(catalog, " voo ")[0].symbol, "VOO");
  assert.deepEqual(searchInstruments(catalog, ""), []);
  assert.deepEqual(searchInstruments(catalog, "no such name"), []);
});
test("typed symbols are bounded and never treated as markup or URLs", () => {
  assert.equal(normalizeTypedSymbol(" dram "), "DRAM");
  assert.equal(normalizeTypedSymbol("BRK.B"), "BRK.B");
  for (const invalid of ["", "<script>", "two words", "a/b", "A".repeat(30)]) assert.equal(normalizeTypedSymbol(invalid), null);
});
test("unconnected typed selections round-trip without manufacturing histories", () => {
  const dataset = buildComparisonDataset();
  const symbols = ["VOO", "DRAM", "MSFT"];
  const query = encodeState({symbols, amount: 1000, window: "5y"});
  const restored = decodeState(query, dataset.symbols, ["DRAM", "MSFT"]);
  assert.deepEqual(restored.symbols, symbols);
  assert.equal(restored.window, "5y");
  assert.deepEqual(seriesFrom(dataset, symbols).map(s => s.symbol), ["VOO"]);
});
test("URL restoration still enforces ten distinct selections", () => {
  const symbols = Array.from({length: 12}, (_, i) => `TEST${i}`);
  const restored = decodeState(`funds=${[...symbols, symbols[0]].join(",")}`, ["VOO"], symbols);
  assert.equal(restored.symbols.length, MAX_FUNDS);
  assert.equal(new Set(restored.symbols).size, MAX_FUNDS);
});

test("missing histories stay in both result and endpoint exclusions without changing other results", () => {
  const dataset = buildComparisonDataset();
  const original = compareDatasetSelection(dataset, ["VOO", "QQQ"], "5y", 1000);
  const result = compareDatasetSelection(dataset, ["VOO", "QQQ", "DRAM"], "5y", 1000);
  assert.equal(result.status, "measured");
  if (result.status !== "measured" || original.status !== "measured") return;
  assert.deepEqual(result.ranked, original.ranked);
  assert.deepEqual(result.endpoints.excluded, result.excluded);
  assert.equal(result.excluded[0].symbol, "DRAM");
  assert.deepEqual(result.endpoints.includedSymbols, ["VOO", "QQQ"]);
});
test("a shared comparison fails explicitly if a selection has no history", () => {
  const result = compareDatasetSelection(buildComparisonDataset(), ["VOO", "DRAM"], "shared", 1000);
  assert.equal(result.status, "unmeasurable");
  assert.equal(result.excluded?.[0].symbol, "DRAM");
});
test("one measurable fund is not a ranked winner and all missing produces no numbers", () => {
  const dataset = buildComparisonDataset();
  const single = compareDatasetSelection(dataset, ["VOO", "DRAM"], "5y", 1000);
  assert.equal(single.status, "measured");
  if (single.status === "measured") assert.equal(single.ranked[0].isHighest, false);
  const none = compareDatasetSelection(dataset, ["DRAM", "MSFT"], "5y", 1000);
  assert.equal(none.status, "unmeasurable");
  assert.equal(none.excluded?.length, 2);
});
