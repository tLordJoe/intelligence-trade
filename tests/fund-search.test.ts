import test from "node:test";
import assert from "node:assert/strict";
import {normalizeTypedSymbol, searchInstruments, type SearchInstrument} from "../src/lib/funds/search.ts";
import {decodeState, encodeState, MAX_FUNDS} from "../src/lib/funds/compare.ts";
import {buildComparisonDataset} from "../src/lib/funds/data.ts";
import {seriesFrom} from "../src/lib/funds/dataset.ts";

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
