import test from "node:test";
import assert from "node:assert/strict";
import { insiderCoverageReady, insiderPayloadHash, readApprovedInsiderRelease, queryInsiders, type InsiderPayload } from "../src/lib/form4/public-view.ts";
const coverage = { from: "2026-01-01", to: "2026-09-14", universeSha256: "a".repeat(64), universeSize: 8010, expectedFilings: 1, missingAccessions: [] as string[] };
const payload: InsiderPayload = { schemaVersion: 1, source: "sec-form4", coverageThrough: "2026-09-14", universeSha256: coverage.universeSha256, universeSize: coverage.universeSize,
  windows: [{ from: coverage.from, to: coverage.to, expectedFilings: 1 }], limitations: "Synthetic test only", heldIssuers: [], excluded: {}, records: [] };
const approve = (data: InsiderPayload) => ({ payload: data, approval: { reviewedBy: "Test reviewer", reviewedAt: "2026-09-15T00:00:00Z", payloadSha256: insiderPayloadHash(data), boundedCoverageAcknowledged: true } });
test("insider release needs continuous YTD windows for one broad universe", () => {
  assert.equal(insiderCoverageReady([coverage], "2026-09-14"), true);
  assert.equal(insiderCoverageReady([{ ...coverage, from: "2026-09-08" }], "2026-09-14"), false);
  assert.equal(insiderCoverageReady([{ ...coverage, universeSize: 11 }], "2026-09-14"), false);
  assert.equal(insiderCoverageReady([{ ...coverage, missingAccessions: ["missing"] }], "2026-09-14"), false);
  assert.equal(insiderCoverageReady([coverage, { ...coverage, universeSha256: "b".repeat(64) }], "2026-09-14"), false);
  assert.equal(insiderCoverageReady([{ ...coverage, to: "2026-02-01" }, { ...coverage, from: "2026-03-01" }], "2026-09-14"), false);
});
test("latest replay of a window cannot hide newly discovered missing filings", () => {
  assert.equal(insiderCoverageReady([coverage, { ...coverage, expectedFilings: 2, missingAccessions: ["new"] }], "2026-09-14"), false);
});
test("pending and altered insider payloads cannot activate a public page", () => {
  assert.equal(readApprovedInsiderRelease({ payload, approval: null }), null);
  assert.deepEqual(readApprovedInsiderRelease(approve(payload)), payload);
  assert.throws(() => readApprovedInsiderRelease({ ...approve(payload), payload: { ...payload, universeSize: 500 } }));
  assert.throws(() => readApprovedInsiderRelease(approve({ ...payload, windows: [{ from: "2026-09-01", to: "2026-09-14", expectedFilings: 1 }] })));
});
test("empty insider query is explicit and query values are bounded", () => {
  const result = queryInsiders(payload, { period: "bad", q: "x".repeat(300), page: "99999" }, "2026-09-15");
  assert.equal(result.period, "ytd"); assert.equal(result.from, "2026-01-01"); assert.equal(result.q.length, 100);
  assert.equal(result.page, 1); assert.equal(result.total, 0);
  assert.throws(() => queryInsiders(payload, {}, "2026-02-31"));
});
