import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readApprovedInsiderRelease, insiderCoverageReady } from "../src/lib/form4/public-view.ts";
import { readApprovedSenateRelease } from "../src/lib/senate/public-view.ts";
import { buildInsiderHomeWindow } from "../src/lib/homepage-market.ts";
const json = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
test("current insider publication is source-reviewed and never presented as complete YTD", () => {
  const release = json("../src/lib/insider-live.json"), evidence = json("../docs/insider-release-2026-10-17.json");
  const payload = readApprovedInsiderRelease(release)!;
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.records.length, evidence.publicRowsChecked);
  assert.equal(payload.coverageThrough, evidence.coverageThrough);
  assert.equal(release.approval.payloadSha256, evidence.payloadSha256);
  assert.equal(release.approval.reviewedBy, evidence.reviewer);
  assert.equal(payload.windows.reduce((n, window) => n + window.expectedFilings, 0), evidence.sourceDocumentsChecked);
  assert.equal(insiderCoverageReady(payload.windows.map(window => ({...window, universeSha256:payload.universeSha256, universeSize:payload.universeSize,missingAccessions:[]})),payload.coverageThrough),false);
  assert.throws(() => buildInsiderHomeWindow(payload,"ytd","2026-10-18"), /cannot populate/);
});
test("House and Senate published counts agree with the refreshed source-review record", () => {
  const evidence = json("../docs/current-disclosures-release-2026-10-17.json");
  const house = json("../src/lib/congress-live.json");
  const senateRelease = json("../src/lib/senate-live.json"), senate = readApprovedSenateRelease(senateRelease)!;
  assert.equal(house.trades.length,evidence.house.publishedRecords);
  assert.equal(senate.records.length,evidence.senate.publishedRecords);
  assert.equal(senateRelease.approval.payloadSha256,evidence.senate.payloadSha256);
  assert.equal(senate.windows.at(-1)?.to,evidence.senate.coverageThrough);
});
