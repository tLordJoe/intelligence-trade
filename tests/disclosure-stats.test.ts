import { test } from "node:test";
import assert from "node:assert/strict";
import { disclosureStats } from "../src/lib/disclosure-stats.ts";

test("statistics describe only supplied visible rows", () => {
  const rows = [
    { type: "Buy", politician: "A", ticker: "AA" },
    { type: "Sell", politician: "B", ticker: "BB" },
    { type: "Buy", politician: "A", ticker: "BB" },
  ];
  assert.deepEqual(disclosureStats(rows), { totalTrades: 3, buyRatio: 67, uniquePoliticians: 2, uniqueTickers: 2 });
  assert.deepEqual(disclosureStats(rows.filter(row => row.politician === "A")), { totalTrades: 2, buyRatio: 100, uniquePoliticians: 1, uniqueTickers: 2 });
});

test("empty results are not a zero percent buying signal", () => {
  assert.deepEqual(disclosureStats([]), { totalTrades: 0, buyRatio: null, uniquePoliticians: 0, uniqueTickers: 0 });
});
