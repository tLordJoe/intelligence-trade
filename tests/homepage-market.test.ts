import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildHomeWindow, buildInsiderHomeWindow, buildSenateHomeWindow, homePeriodStart } from "../src/lib/homepage-market.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
import type { SenatePublicPayload } from "../src/lib/senate/public-view.ts";
import type { InsiderPayload } from "../src/lib/form4/public-view.ts";
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
test("Senate homepage portraits link to a stable individual profile", () => {
  const payload: SenatePublicPayload = { schemaVersion: 1, source: "senate-efd", windows: [{ from: "2026-01-01", to: "2026-09-15" }], limitations: "test", omitted: { paperOrUnparsedReports: 0, reconciliationIssues: 0, otherSourceRows: 0 }, records: [{
    id: "senate:test:row", reportId: "test", politician: "John Boozman", bioguide: "B001236", state: "AR", ticker: "FSLR", issuerName: "First Solar", cik: "0001274494", assetNameAsFiled: "First Solar", assetTypeAsFiled: "Stock", securityClassification: "unclassified_listed_security", type: "Buy", owner: "Self", amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, transactionDate: "2026-08-13", filedDate: "2026-09-11", receivedDate: "2026-09-11", sourceUrl: "https://efdsearch.senate.gov/search/view/ptr/test/", documentSha256: "a".repeat(64), sourceComment: null, filingNotes: [],
  }] };
  const result = buildSenateHomeWindow(payload, "ytd", "2026-09-17");
  assert.equal(result.recent[0].filer.href, "/senate/filers/B001236");
  assert.equal(result.companies[0].filers[0].href, "/senate/filers/B001236");
});
test("corporate insider windows count distinct reporting owners and keep sales separate", () => {
  const owner = (cik: string, name: string) => ({ cik, name, isDirector: true, isOfficer: false, isTenPercentOwner: false, isOther: false, officerTitle: null, otherText: null });
  const base = { issuerCik: "0001274494", issuerName: "First Solar", ticker: "FSLR", securityTitle: "Common Stock", transactionDate: "2026-08-13", filedDate: "2026-08-15", reportedShares: "100", reportedPrice: { value: "200", raw: "200", reason: null, footnoteIds: [] }, priceQuality: "exact" as const, ownership: "direct" as const, natureOfOwnership: { value: null, raw: null, reason: "not_present_in_source" as const, footnoteIds: [] }, filingPlanIndicator: false, accessionNumber: "0001274494-26-000001", sourceUrl: "https://www.sec.gov/Archives/edgar/data/1274494/000127449426000001/form4.xml", filingId: `0001274494-26-000001::${"a".repeat(64)}`, footnotes: {}, warnings: [], sourceDocumentSha256: "a".repeat(64), sourceRemarks: null };
  const payload = { schemaVersion: 1 as const, source: "sec-form4" as const, coverageThrough: "2026-09-17", universeSha256: "b".repeat(64), universeSize: 10000, windows: [{ from: "2026-01-01", to: "2026-09-17", expectedFilings: 2 }], limitations: "test", excluded: {}, heldIssuers: [], records: [
    { ...base, id: `${base.filingId}::nonDerivative::transaction::0`, classification: "reported_purchase" as const, reportingOwners: [owner("0000000001", "Alex Buyer")] },
    { ...base, id: `${base.filingId}::nonDerivative::transaction::1`, classification: "reported_purchase" as const, reportingOwners: [owner("0000000001", "Alex Buyer"), owner("0000000002", "Jordan Buyer")] },
    { ...base, id: `${base.filingId}::nonDerivative::transaction::2`, classification: "reported_sale" as const, reportingOwners: [owner("0000000002", "Jordan Buyer")] },
  ] } satisfies InsiderPayload;
  const result = buildInsiderHomeWindow(payload, "ytd", "2026-09-17");
  assert.equal(result.companies[0].buyers, 2); assert.equal(result.companies[0].purchases, 2); assert.equal(result.companies[0].sales, 1);
  assert.match(result.companies[0].filers[0].href ?? "", /^\/insiders\?/);
});
