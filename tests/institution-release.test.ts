import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { approvedInstitutions, payloadHash } from "../src/lib/institutions/release.ts";

test("the first published institutional snapshot matches its source-bound review ledger", () => {
  const release = JSON.parse(readFileSync(new URL("../src/lib/institutions-live.json", import.meta.url), "utf8"));
  const audit = JSON.parse(readFileSync(new URL("../docs/institution-release-2026-10-17.json", import.meta.url), "utf8"));
  const payload = approvedInstitutions(release)!;
  assert.ok(payload);
  assert.equal(release.approval.reviewedBy, "Codex");
  assert.equal(payloadHash(payload), audit.candidateSha256);
  assert.equal(payload.filings.length, 28);
  assert.equal(new Set(payload.filings.map(f => f.reference.cik)).size, 10);
  assert.equal(payload.filings.reduce((sum, f) => sum + f.holdings.length, 0), 41367);
  assert.equal(audit.negativeTests, 3);
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
    assert.equal(filing.reportType, "13F HOLDINGS REPORT");
    assert.equal(filing.amendment, false);
    assert.equal(filing.confidentialOmitted, false);
    for (const row of filing.holdings) assert.equal(row.valueUsd, row.valueAsFiled);
  }
});
