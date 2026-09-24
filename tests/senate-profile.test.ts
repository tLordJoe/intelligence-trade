import test from "node:test";
import assert from "node:assert/strict";
import type { SenatePublicPayload } from "../src/lib/senate/public-view.ts";
import { buildSenateProfile, senateBioguideFromRoute, senateProfilePath } from "../src/lib/senate-profile.ts";

const payload: SenatePublicPayload = { schemaVersion: 1, source: "senate-efd", windows: [{ from: "2026-01-01", to: "2026-09-15" }], limitations: "test", omitted: { paperOrUnparsedReports: 0, reconciliationIssues: 0, otherSourceRows: 0 }, records: [
  { id: "senate:r1:1", reportId: "r1", politician: "John Boozman", bioguide: "B001236", state: "AR", ticker: "FSLR", issuerName: "First Solar", cik: "0001274494", assetNameAsFiled: "First Solar", assetTypeAsFiled: "Stock", securityClassification: "unclassified_listed_security", type: "Buy", owner: "Self", amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, transactionDate: "2026-08-13", filedDate: "2026-09-11", receivedDate: "2026-09-11", sourceUrl: "https://efdsearch.senate.gov/search/view/ptr/r1/", documentSha256: "a".repeat(64), sourceComment: null, filingNotes: [] },
  { id: "senate:r2:1", reportId: "r2", politician: "Other Senator", bioguide: "O000001", state: "OR", ticker: "TEST", issuerName: "Test", cik: "0000000001", assetNameAsFiled: "Test", assetTypeAsFiled: "Stock", securityClassification: "unclassified_listed_security", type: "Sell", owner: "Self", amount: "$1,001 - $15,000", amountLow: 1001, amountHigh: 15000, transactionDate: "2026-08-12", filedDate: "2026-09-10", receivedDate: "2026-09-10", sourceUrl: "https://efdsearch.senate.gov/search/view/ptr/r2/", documentSha256: "b".repeat(64), sourceComment: null, filingNotes: [] },
] };

test("Senate profile is scoped by Bioguide and has a stable route", () => {
  assert.equal(senateProfilePath("B001236"), "/senate/filers/B001236");
  assert.equal(senateBioguideFromRoute("B001236"), "B001236");
  assert.equal(senateBioguideFromRoute("bad%escape"), null);
  const profile = buildSenateProfile(payload, "B001236", "2026-09-17");
  assert.equal(profile?.name, "John Boozman");
  assert.equal(profile?.records.length, 1);
  assert.ok(profile?.records.every(row => row.bioguide === "B001236"));
  assert.equal(buildSenateProfile(payload, "X000000", "2026-09-17"), null);
});
