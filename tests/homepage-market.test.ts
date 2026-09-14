import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHomeWindow, homePeriodStart } from "../src/lib/homepage-market.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
const archive = JSON.parse(readFileSync(new URL("../src/lib/congress-live.json", import.meta.url), "utf8"));
function row(id: string, patch: Partial<DisclosureRecord> = {}): DisclosureRecord {
  const base = archive.trades[0];
  return { ...base, id, politician: `Person ${id}`, chamber: "House", status: "valid", ticker: "TEST", companyName: "Example",
    cik: "1", tickerResolution: "verified", type: "Buy", isOptions: false,
    transactionDate: "2026-08-15", filedDate: "2026-09-01", provenance: { ...base.provenance, reconciliationKey: id }, ...patch };
}
test("homepage windows are transaction-date based and inclusive", () => {
  assert.equal(homePeriodStart("ytd", "2026-09-13"), "2026-01-01");
  assert.equal(homePeriodStart("30", "2026-09-13"), "2026-08-15");
  assert.equal(homePeriodStart("90", "2026-09-13"), "2026-06-16");
  const records = [row("a"), row("b", { transactionDate: "2026-08-14" }), row("c", { filedDate: "2026-09-14" })];
  assert.equal(buildHomeWindow(records, "30", "2026-09-13").companies[0].buyers, 1);
  assert.equal(buildHomeWindow(records, "ytd", "2026-09-13").companies[0].buyers, 2);
});
test("homepage keeps real distinct filers and directions separate without mutating archive", () => {
  const records = [row("a", { politician: "Jane Doe" }), row("b", { politician: "Hon. Jane Doe" }), row("c"), row("d", { type: "Sell" })];
  const before = JSON.stringify(records);
  const company = buildHomeWindow(records, "ytd", "2026-09-13").companies[0];
  assert.equal(company.buyers, 2); assert.equal(company.purchases, 3); assert.equal(company.sales, 1);
  assert.equal(company.filers.length, 2); assert.equal(JSON.stringify(records), before);
});
test("homepage excludes unknown, conflicting, future and invalid records", () => {
  for (const patch of [{ isOptions: true }, { tickerResolution: "unknown" }, { status: "quarantined" },
    { transactionDate: "2026-09-02" }, { chamber: "Senate" }] as Partial<DisclosureRecord>[]) {
    assert.equal(buildHomeWindow([row("a", patch)], "ytd", "2026-09-13").companies.length, 0);
  }
  assert.equal(buildHomeWindow([row("a"), row("b", { cik: "2" })], "ytd", "2026-09-13").recent.length, 0);
  assert.throws(() => homePeriodStart("30", "2026-02-30"));
});
test("empty periods do not invent rows or keep stale sample purchases", () => {
  const result = buildHomeWindow([], "ytd", "2026-09-13");
  assert.deepEqual(result.companies, []); assert.deepEqual(result.recent, []);
});
