import test from "node:test";
import assert from "node:assert/strict";
import type { DisclosureArchive } from "../src/lib/congress-schema.ts";
import { allowedHousePatchPaths, checkHouseCandidate, houseRunPath, matchesHouseRelease } from "../scripts/house-refresh-release.ts";

const id = "run_2026-11-16T03-25-16-174Z_c2569350";
const date = "2026-11-16T03:25:37.834Z";
function fixture() {
  const before = {
    updatedAt: "2026-10-18T03:34:43.812Z",
    trades: [{ id: "original" }],
  } as DisclosureArchive;
  const after = {
    lastImportRunId: id,
    updatedAt: date,
    trades: [{ id: "original" }, { id: "new" }],
    counts: { archiveBefore: 1, archiveAfter: 2, added: 1, revised: 0, selectedFilings: 10, sourceFilings: 10 },
  } as DisclosureArchive;
  const receipt = {
    runId: id, passed: true, dryRun: false, productionUpdated: true, finishedAt: date,
    counts: { ...after.counts },
  };
  return { before, after, receipt };
}

test("House handoff accepts an append-only import with a matching receipt", () => {
  const { before, after, receipt } = fixture();
  assert.equal(checkHouseCandidate(before, after, receipt), true);
});

test("timestamp-only House refresh stays a no-op; a correction alone can publish", () => {
  const { before, after, receipt } = fixture();
  after.trades.pop();
  Object.assign(after.counts, { added: 0, archiveAfter: 1 });
  Object.assign(receipt.counts, after.counts);
  assert.equal(checkHouseCandidate(before, after, receipt), false);
  after.counts.revised = receipt.counts.revised = 1;
  assert.throws(() => checkHouseCandidate(before, after, receipt));
  after.trades[0].revisions = [{
    at: date, importRunId: id, changes: [{ field: "ticker", from: "OLD", to: "NEW" }],
  }];
  assert.equal(checkHouseCandidate(before, after, receipt), true);
});

test("House handoff rejects failed, dry-run, partial, substituted, duplicate and shrinking archives", () => {
  for (const change of ["failed", "dry-run", "partial", "substituted", "duplicate", "shrinking"]) {
    const { before, after, receipt } = fixture();
    if (change === "failed") receipt.passed = false;
    if (change === "dry-run") receipt.dryRun = true;
    if (change === "partial") receipt.counts.selectedFilings = after.counts.selectedFilings = 3;
    if (change === "substituted") after.lastImportRunId = "other";
    if (change === "duplicate") after.trades[1].id = "original";
    if (change === "shrinking") after.trades.shift();
    assert.throws(() => checkHouseCandidate(before, after, receipt), Error, change);
  }
});

test("House handoff paths are limited to data and this run's evidence", () => {
  const run = houseRunPath(id);
  const paths = ["src/lib/congress-live.json", `${run}/report.txt`, `${run}/summary.json`, `${run}/zero-row-filings.json`];
  assert.doesNotThrow(() => allowedHousePatchPaths(paths, id));
  assert.throws(() => allowedHousePatchPaths(paths.slice(0, -1), id));
  assert.throws(() => allowedHousePatchPaths([...paths, ".github/workflows/supervised-house-refresh.yml"], id));
  assert.throws(() => allowedHousePatchPaths([...paths, "data/import-runs/another-run/summary.json"], id));
  assert.throws(() => houseRunPath("../other"));
});

test("a matching House timestamp, count and source are all required on the public site", () => {
  const { after } = fixture();
  const live = { updatedAt: date, total: 2, coverage: "U.S. House of Representatives" };
  assert.equal(matchesHouseRelease(after, live), true);
  assert.equal(matchesHouseRelease(after, { ...live, total: 1 }), false);
  assert.equal(matchesHouseRelease(after, { ...live, updatedAt: "2026-10-18T03:34:43.812Z" }), false);
  assert.equal(matchesHouseRelease(after, { ...live, coverage: "U.S. Senate" }), false);
  assert.equal(matchesHouseRelease(after, null), false);
});
