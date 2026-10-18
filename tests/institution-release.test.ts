import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedInstitutions, payloadHash } from "../src/lib/institutions/release.ts";
import { readDisclosureRelease } from "../src/lib/disclosure-storage.ts";

test("available institutional filings match their source-bound review ledger without requiring a quarter pair", () => {
  const release = readDisclosureRelease(new URL("../src/lib/institutions-live.json", import.meta.url).pathname) as {payload:unknown;approval:{reviewedBy:string}};
  const audit = JSON.parse(readFileSync(new URL("../docs/available-institutions-release-2026-10-17.json", import.meta.url), "utf8"));
  const payload = approvedInstitutions(release)!;
  assert.ok(payload);
  assert.equal(release.approval.reviewedBy, "Codex");
  assert.equal(payloadHash(payload), audit.candidateSha256);
  assert.equal(payload.schemaVersion, 2);
  assert.equal(payload.filings.length, 47);
  assert.equal(new Set(payload.filings.map(f => f.reference.cik)).size, 20);
  assert.equal(payload.filings.reduce((sum, f) => sum + f.holdings.length, 0), 292522);
  assert.equal(audit.rowsChecked, 292522);
  assert.equal(audit.sourceReviews.length, payload.filings.length);
  const excluded = new Set(audit.excludedManagers.map((m: { cik: string }) => m.cik));
  const held = new Set(audit.heldFamilies.flatMap((f: { accessions: string[] }) => f.accessions));
  for (const filing of payload.filings) {
    const reviews = audit.sourceReviews.filter((r: { accession: string }) => r.accession === filing.reference.accession);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].sourceSha256, filing.sourceSha256);
    assert.equal(reviews[0].reviewedBy, "Codex");
    assert.equal(reviews[0].unitsVerified, true);
    assert.ok(reviews[0].evidenceNote);
    assert.ok(Number.isFinite(Date.parse(reviews[0].reviewedAt)));
    assert.ok(!excluded.has(filing.reference.cik));
    assert.ok(!held.has(filing.reference.accession));
    assert.equal(filing.valueUnit, "USD");
    assert.ok(["13F HOLDINGS REPORT", "13F COMBINATION REPORT"].includes(filing.reportType));
    assert.equal(filing.amendment, false);
    assert.equal(filing.confidentialOmitted, false);
    for (const row of filing.holdings) assert.equal(row.valueUsd, row.valueAsFiled);
  }
  const byCik=(cik:string)=>payload.filings.filter(f=>f.reference.cik===cik);
  assert.equal(byCik("0002026053").find(f=>f.period==="2026-06-30")?.holdings.length,15);
  assert.deepEqual(byCik("0001536411").map(f=>f.period),["2025-12-31"]);
  assert.deepEqual(byCik("0000019617").map(f=>f.period),["2026-06-30","2025-12-31"]); // Failed Q1 amendment does not hide Q2.
  assert.ok(!byCik("0000093751").some(f=>f.period==="2026-06-30")); // Unresolved amended quarter stays held.
  assert.equal(byCik("0000102909")[0].reportType,"13F COMBINATION REPORT");
});
