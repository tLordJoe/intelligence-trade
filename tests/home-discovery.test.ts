import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
import { archiveRecords, buildHomeDiscovery, disclosureFilerKey, displayFiler, queryArchive, validDisclosureDate } from "../src/lib/home-discovery.ts";

const archive = JSON.parse(readFileSync(new URL("../src/lib/congress-live.json", import.meta.url), "utf8"));
const asOf = "2026-09-08";
function record(id: string, overrides: Partial<DisclosureRecord> = {}): DisclosureRecord {
  const base = archive.trades[0] as DisclosureRecord;
  return { ...base, id, politician: `Person ${id}`, chamber: "House", status: "valid",
    ticker: "TEST", companyName: "Test company", cik: "1", tickerResolution: "verified",
    transactionDate: "2026-08-15", filedDate: "2026-09-01", type: "Buy", isOptions: false,
    provenance: { ...base.provenance, reconciliationKey: id }, ...overrides };
}

test("full archive is reachable page by page without dropping records", () => {
  const rows = archiveRecords(archive.trades, asOf);
  assert.equal(rows.length, 997);
  const all = Array.from({length: queryArchive(rows, {}).pages}, (_, i) => queryArchive(rows, {page: String(i + 1)}).records).flat();
  assert.equal(all.length, rows.length);
  assert.equal(new Set(all.map(r => r.id)).size, rows.length);
});
test("counts distinct named filers, not repeated purchase rows; sales remain separate", () => {
  const rows = [record("1", {politician: "Hon. Jane Doe"}), record("2", {politician: "Jane Doe"}),
    record("3", {politician: "John Roe"}), record("4", {politician: "Jane Doe", type: "Sell"})];
  const before = JSON.stringify(rows);
  const cluster = buildHomeDiscovery(rows, asOf, asOf).clusters[0];
  assert.equal(cluster.buyers, 2); assert.equal(cluster.purchases, 3);
  assert.equal(cluster.sales, 1); assert.equal(cluster.sellers, 1);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(displayFiler("Hondo Smith"), "Hondo Smith");
});
test("deduplicates identities and reconciliation keys", () => {
  const first = record("1");
  assert.equal(archiveRecords([first, {...first}, {...first, id: "alternate"}], asOf).length, 1);
});
test("reviewed McGuire alias counts one filer without merging arbitrary middle names or seat holders", () => {
  const first = record("alias-1", {politician: "John J Mr McGuire", state: "VA", district: "VA05"});
  const second = record("alias-2", {politician: "John McGuire", state: "VA", district: "VA05"});
  assert.equal(disclosureFilerKey(first), disclosureFilerKey(second));
  assert.equal(buildHomeDiscovery([first, second], asOf, asOf).clusters.length, 0);
  const other = record("alias-3", {politician: "Other Person", state: "VA", district: "VA05"});
  const cluster = buildHomeDiscovery([first, second, other, {...first, id: "sale", type: "Sell", provenance: {...first.provenance, reconciliationKey: "sale"}}], asOf, asOf).clusters[0];
  assert.equal(cluster.buyers, 2);
  assert.equal(cluster.purchases, 3);
  assert.equal(cluster.sellers, 1);
  assert.notEqual(disclosureFilerKey(first), disclosureFilerKey({...first, district: "VA06"}));
  assert.notEqual(disclosureFilerKey(first), disclosureFilerKey({...first, politician: "John K McGuire"}));
});
test("real archived McGuire name variants share one counting identity", () => {
  const rows = (archive.trades as DisclosureRecord[]).filter(r => r.ticker === "NVDA" && r.type === "Buy" && /McGuire/.test(r.politician));
  assert.ok(new Set(rows.map(r => r.politician)).size > 1);
  assert.equal(new Set(rows.map(disclosureFilerKey)).size, 1);
});
test("filing window is thirty inclusive calendar dates, not transaction dates", () => {
  const start = "2026-08-10";
  const rows = [record("1", {filedDate: start, transactionDate: "2026-01-01"}), record("2"),
    record("3", {filedDate: "2026-08-09", transactionDate: "2026-08-01"}),
    record("4", {filedDate: "2026-09-09"})];
  const result = buildHomeDiscovery(rows, asOf, asOf);
  assert.equal(result.periodStart, start); assert.equal(result.clusters[0].buyers, 2);
});
test("date anomalies stay in archive but not homepage calculations", () => {
  const bad = record("2", {transactionDate: "2026-12-01"});
  const result = buildHomeDiscovery([record("1"), bad], asOf, asOf);
  assert.equal(result.archiveCount, 2); assert.equal(result.clusters.length, 0);
  assert.equal(result.recentPurchases.length, 1);
  assert.equal(validDisclosureDate("2026-02-30"), false);
  assert.throws(() => archiveRecords([], "bad date"));
});
test("unsafe sources, quarantined records and non-House records are excluded", () => {
  assert.equal(archiveRecords([record("1", {source: "javascript:alert(1)"}),
    record("2", {status: "quarantined"}), record("3", {chamber: "Senate"})], asOf).length, 0);
});
test("options and unverified symbols remain inspectable but cannot inflate clusters", () => {
  const rows = [record("1"), record("2", {isOptions: true}), record("3", {tickerResolution: "unknown"})];
  const result = buildHomeDiscovery(rows, asOf, asOf);
  assert.equal(result.archiveCount, 3); assert.equal(result.clusters.length, 0);
});
test("conflicting issuer identities cannot combine into a ticker cluster", () => {
  assert.equal(buildHomeDiscovery([record("1"), record("2", {cik: "2"})], asOf, asOf).clusters.length, 0);
});
test("search supports name and symbol, exact ticker filters and clamped pagination", () => {
  const rows = [record("1", {politician: "Jane Doe"}), record("2", {ticker: "OTHER"})];
  assert.equal(queryArchive(rows, {q: "jane"}).total, 1);
  assert.equal(queryArchive(rows, {ticker: "test"}).total, 1);
  assert.equal(queryArchive(rows, {q: "test company"}).total, 2);
  assert.equal(queryArchive(rows, {page: "-3"}).page, 1);
  assert.equal(queryArchive(rows, {page: "999"}).page, 1);
  assert.equal(queryArchive(rows, {q: "no match"}).total, 0);
});
test("empty and stale data are explicit, not fabricated", () => {
  const result = buildHomeDiscovery([], "2026-01-01", asOf);
  assert.equal(result.stale, true); assert.deepEqual(result.clusters, []);
  assert.deepEqual(result.recentPurchases, []);
});
