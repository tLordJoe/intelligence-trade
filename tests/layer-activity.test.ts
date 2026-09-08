import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
import { buildLayerActivity } from "../src/lib/layer-activity.ts";
const archive = JSON.parse(readFileSync(new URL("../src/lib/congress-live.json", import.meta.url), "utf8"));
const asOf = "2026-09-08";
const layers = [{ slug: "software", stocks: [{ ticker: "TEST", name: "Test" }] }];
function row(id: string, fields: Partial<DisclosureRecord> = {}): DisclosureRecord {
  const base = archive.trades[0];
  return { ...base, id, politician: `Person ${id}`, chamber: "House", state: "VA", district: "VA05",
    ticker: "TEST", cik: "1", tickerResolution: "verified", status: "valid", type: "Buy", isOptions: false,
    transactionDate: "2026-08-15", filedDate: "2026-09-01",
    provenance: { ...base.provenance, reconciliationKey: id }, ...fields };
}
test("layer activity filters by transaction date and separates sales from distinct buyers", () => {
  const rows = [row("1", { politician: "John J Mr McGuire" }), row("2", { politician: "John McGuire" }),
    row("3", { type: "Sell" }), row("4", { transactionDate: "2026-02-01" }),
    row("5", { transactionDate: "2025-12-01" }), row("6", { ticker: "OTHER" })];
  const before = JSON.stringify(rows);
  const d = buildLayerActivity(rows, layers, asOf, asOf).byLayer.software;
  assert.equal(d.year.stocks[0].buyers, 2);
  assert.equal(d.year.stocks[0].purchases, 3);
  assert.equal(d.year.stocks[0].sellers, 1);
  assert.equal(d.month.stocks[0].buyers, 1);
  assert.equal(d.month.stocks[0].purchases, 2);
  assert.equal(d.month.start, "2026-08-10");
  assert.equal(JSON.stringify(rows), before);
});
test("bad chronology, options, unresolved issuers, duplicates and other chambers do not inflate activity", () => {
  const good = row("1");
  const d = buildLayerActivity([good, good, row("2", {isOptions: true}), row("3", {tickerResolution: "unknown"}),
    row("4", {transactionDate: "2026-12-01"}), row("5", {chamber: "Senate"}),
    row("6", {filedDate: "2026-09-09"})], layers, asOf, asOf).byLayer.software.year;
  assert.equal(d.stocks[0].purchases, 1);
  assert.equal(d.stocks[0].evidence.length, 1);
});
test("ambiguous issuers and absent records yield no invented activity", () => {
  assert.equal(buildLayerActivity([row("1"), row("2", {cik: "2"})], layers, asOf, asOf).byLayer.software.year.stocks.length, 0);
  assert.deepEqual(buildLayerActivity([], layers, asOf, asOf).byLayer.software.year.stocks, []);
  assert.throws(() => buildLayerActivity([], layers, asOf, "bad date"));
});
test("all layer stocks participate, not just four featured companies; sells-only rows remain visible", () => {
  const list = [{slug: "software", stocks: ["A", "B", "C", "D", "TEST"].map(ticker => ({ticker, name: ticker}))}];
  const d = buildLayerActivity([row("1", {type: "Sell"})], list, asOf, asOf).byLayer.software.year;
  assert.equal(d.stocks[0].ticker, "TEST");
  assert.equal(d.stocks[0].buyers, 0);
  assert.equal(d.stocks[0].sales, 1);
});
