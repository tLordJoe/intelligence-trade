import test from "node:test";
import assert from "node:assert/strict";
import { readApprovedSenateRelease, senatePayloadHash, senateCoverageReady, querySenateDisclosures, type SenatePublicPayload, type SenatePublicRelease } from "../src/lib/senate/public-view.ts";
const reportId = "00000000-0000-0000-0000-000000000001";
const payload: SenatePublicPayload = { schemaVersion: 1, source: "senate-efd", windows: [{ from: "2026-01-01", to: "2026-09-15" }],
  limitations: "Synthetic test; partial source coverage; unclassified listed security", omitted: { paperOrUnparsedReports: 1, reconciliationIssues: 1, otherSourceRows: 2 },
  records: [{ id: `senate:${reportId}:row:1`, reportId, politician: "Example Senator", bioguide: "E000001", state: "CA",
    ticker: "ACME", issuerName: "Acme Corporation", cik: "0000000001", assetNameAsFiled: "Acme Corporation", assetTypeAsFiled: "Stock", securityClassification: "unclassified_listed_security",
    type: "Buy", owner: "Spouse", amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, transactionDate: "2026-08-01", filedDate: "2026-09-02", receivedDate: "2026-09-02",
    sourceUrl: `https://efdsearch.senate.gov/search/view/ptr/${reportId}/`, documentSha256: "a".repeat(64), sourceComment: null, filingNotes: [] }] };
const approve = (data: SenatePublicPayload): SenatePublicRelease => ({ payload: data, approval: { reviewedBy: "Synthetic test reviewer", reviewedAt: "2026-09-14", payloadSha256: senatePayloadHash(data), partialCoverageAcknowledged: true } });
test("pending Senate payload never activates public display", () => { assert.equal(readApprovedSenateRelease({ payload, approval: null }), null); });
test("reviewed partial disclosure payload is available without pretending it is a stock ranking", () => {
  const result = readApprovedSenateRelease(approve(payload)); assert.equal(result?.records.length, 1); assert.equal(result?.records[0].securityClassification, "unclassified_listed_security");
});
test("changed records or coverage after review invalidate public release", () => {
  const release = approve(payload); assert.throws(() => readApprovedSenateRelease({ ...release, payload: { ...payload, limitations: "changed" } }), /review/);
});
test("bad dates, external sources, duplicate records and changed instrument labels fail closed", () => {
  for (const record of [{ ...payload.records[0], transactionDate: "2027-01-01" }, { ...payload.records[0], sourceUrl: "https://example.com/search/view/ptr/test/" },
    { ...payload.records[0], receivedDate: "2025-12-31" }, { ...payload.records[0], amountLow: -1 }, { ...payload.records[0], securityClassification: "stock" }]) {
    assert.throws(() => readApprovedSenateRelease(approve({ ...payload, records: [record] } as SenatePublicPayload)));
  }
  assert.throws(() => readApprovedSenateRelease(approve({ ...payload, records: [payload.records[0], payload.records[0]] })));
});
test("publication requires continuous source windows from January 1", () => {
  assert.equal(senateCoverageReady([{ from: "2026-04-01", to: "2026-09-13" }]), false);
  assert.equal(senateCoverageReady([{ from: "2026-01-01", to: "2026-01-31" }, { from: "2026-03-01", to: "2026-09-13" }]), false);
  assert.equal(senateCoverageReady([{ from: "2026-01-01", to: "2026-01-31" }, { from: "2026-02-01", to: "2026-09-15" }]), true);
  assert.equal(senateCoverageReady([{ from: "2026-01-01", to: "2026-09-13" }]), false);
  assert.throws(() => readApprovedSenateRelease(approve({ ...payload, windows: [{ from: "2026-04-01", to: "2026-09-13" }] })), /January 1/);
});
test("YTD and rolling ranges filter transaction dates, not received dates", () => {
  const data = { ...payload, records: [...payload.records, { ...payload.records[0], id: "older", transactionDate: "2025-12-31" }] };
  assert.equal(querySenateDisclosures(data, { period: "ytd" }, "2026-09-15").total, 1);
  assert.equal(querySenateDisclosures(data, { period: "30" }, "2026-09-15").total, 0);
  assert.equal(querySenateDisclosures(data, { period: "90" }, "2026-09-15").total, 1);
  assert.equal(querySenateDisclosures(data, { period: "invalid", q: "missing" }, "2026-09-15").total, 0);
});
