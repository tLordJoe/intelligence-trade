import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTickers, percentagePerformance } from "../src/lib/market-data.ts";
import { dedupeById, isOfficialHouseFilingUrl } from "../src/lib/congress-utils.ts";
import { assessHouseDataset } from "../src/lib/data-health.ts";
import { clampIndex, nearestTimestampIndex } from "../src/lib/chart-interaction.ts";

test("normalizeTickers trims, uppercases, deduplicates, and rejects invalid symbols", () => {
  assert.deepEqual(
    normalizeTickers([" nvda ", "NVDA", "brk.b", "bad-symbol", "TOOLONG"]),
    ["NVDA", "BRK.B"]
  );
});

test("normalizeTickers enforces a request limit", () => {
  assert.deepEqual(normalizeTickers(["A", "B", "C"], 2), ["A", "B"]);
});

test("percentagePerformance calculates gain and loss from the first close", () => {
  assert.equal(percentagePerformance(100, 125), 25);
  assert.ok(Math.abs(percentagePerformance(100, 80) - (-20)) < 1e-10);
});

test("percentagePerformance rejects invalid base prices", () => {
  assert.throws(() => percentagePerformance(0, 100));
  assert.throws(() => percentagePerformance(Number.NaN, 100));
});

test("dedupeById keeps the first unique disclosure record", () => {
  assert.deepEqual(
    dedupeById([{ id: "a", value: 1 }, { id: "a", value: 2 }, { id: "b", value: 3 }]),
    [{ id: "a", value: 1 }, { id: "b", value: 3 }]
  );
});

test("official filing links are restricted to House PTR PDFs", () => {
  assert.equal(
    isOfficialHouseFilingUrl("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035136.pdf"),
    true
  );
  assert.equal(isOfficialHouseFilingUrl("https://example.com/filing.pdf"), false);
  assert.equal(isOfficialHouseFilingUrl("javascript:alert(1)"), false);
});

test("House dataset health rejects empty or unverified disclosure data", () => {
  const empty = assessHouseDataset([], "2026-08-07T00:00:00.000Z", Date.parse("2026-08-07T12:00:00.000Z"));
  assert.equal(empty.status, "error");
  assert.ok(empty.issues.includes("dataset is empty"));

  const unverified = assessHouseDataset(
    [{
      id: "example-1",
      transactionDate: "2026-08-01",
      filedDate: "2026-08-02",
      source: "https://example.com/report.pdf",
    }],
    "2026-08-07T00:00:00.000Z",
    Date.parse("2026-08-07T12:00:00.000Z")
  );
  assert.equal(unverified.status, "error");
  assert.ok(unverified.issues.includes("unverified source: example-1"));
});

test("House dataset health accepts recent records with official sources", () => {
  const health = assessHouseDataset(
    [{
      id: "20034736-0",
      transactionDate: "2026-07-21",
      filedDate: "2026-07-27",
      source: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20034736.pdf",
    }],
    "2026-08-06T00:00:00.000Z",
    Date.parse("2026-08-07T12:00:00.000Z")
  );
  assert.deepEqual(health, {
    status: "ok",
    recordCount: 1,
    updatedAt: "2026-08-06T00:00:00.000Z",
    issues: [],
  });
});

test("chart inspection snaps to the nearest timestamp", () => {
  const timestamps = [100, 200, 300, 400];
  assert.equal(nearestTimestampIndex(timestamps, 110), 0);
  assert.equal(nearestTimestampIndex(timestamps, 249), 1);
  assert.equal(nearestTimestampIndex(timestamps, 251), 2);
  assert.equal(nearestTimestampIndex(timestamps, 999), 3);
});

test("chart keyboard navigation stays inside the available series", () => {
  assert.equal(clampIndex(-1, 4), 0);
  assert.equal(clampIndex(2, 4), 2);
  assert.equal(clampIndex(9, 4), 3);
  assert.equal(clampIndex(0, 0), -1);
});
