import test from "node:test";
import assert from "node:assert/strict";
import { buildSenateCandidate, deduplicateSenateFilings, resolveSenatePerson, senateAmendmentWorklist, type SenateFiling, type SenatePerson, type SenateSecurityReview } from "../src/lib/senate/candidate.ts";
import { prepareSenatePublicRelease } from "../src/lib/senate/public-view.ts";
const row = { id: "senate:example:row:1", sourceRowNumber: "1", contentHash: "a".repeat(64),
  raw: { date: "08/01/2026", owner: "Spouse", tickerText: "ACME", assetName: "Acme Corporation", assetType: "Stock", typeText: "Purchase", amountText: "$1,001 - $15,000", comment: "Source comment" },
  transactionDate: "2026-08-01", owner: "Spouse", ticker: "ACME", assetName: "Acme Corporation", assetType: "Stock",
  direction: "Buy", amountLow: 1001, amountHigh: 15000, amountStatus: "disclosed_range", listedSecurityCandidate: true, issues: [] };
const filing: SenateFiling = { schemaVersion: 1, parserVersion: "test", reference: { id: "example", url: "https://efdsearch.senate.gov/search/view/ptr/example/", firstName: "Example", lastName: "Person", office: "Senator", reportTitle: "Periodic Transaction Report for 08/05/2026", receivedDate: "2026-08-05", format: "electronic" }, documentSha256: "b".repeat(64), filer: "Example Person", title: "Periodic Transaction Report for 08/05/2026", filedDate: "2026-08-05", filedTimestampRaw: "08/05/2026 @ 12 PM", amendment: false, warnings: [], rows: [row], publicationApproved: false };
const people: SenatePerson[] = [{ bioguide: "E000001", names: ["Example Person"], terms: [{ start: "2025-01-03", end: "2031-01-03", state: "CA", party: "Democrat" }] }];
const master = { updatedAt: "2026-09-14", entries: { ACME: { ticker: "ACME", cik: "0000000001", title: "Acme Corporation" } } };
test("identical re-downloads are counted once without collapsing distinct source rows", () => {
  const repeatedRow = { ...row, id: "senate:example:row:2", sourceRowNumber: "2" };
  const source = { ...filing, rows: [row, repeatedRow] };
  const result = buildSenateCandidate([source, source], people, master);
  assert.equal(result.repeatedReports, 1); assert.equal(result.rows.length, 2);
  assert.equal(result.publicationApproved, false);
});
test("changed source bytes and contradictory reference metadata are held", () => {
  assert.deepEqual(deduplicateSenateFilings([filing, { ...filing, documentSha256: "changed" }]).conflicts, ["example"]);
  assert.deepEqual(deduplicateSenateFilings([filing, { ...filing, reference: { ...filing.reference, lastName: "Other" } }]).conflicts, ["example"]);
});
test("person identity requires exact alias, valid ID and active Senate term", () => {
  assert.equal(resolveSenatePerson(filing, people)?.bioguide, "E000001");
  assert.equal(resolveSenatePerson({ ...filing, reference: { ...filing.reference, firstName: "Another" } }, people), null);
  assert.equal(resolveSenatePerson({ ...filing, filedDate: "2031-01-03" }, people), null);
  assert.equal(resolveSenatePerson(filing, [...people, { ...people[0], bioguide: "E000002" }]), null);
});
test("official office label can link a formal filer name only when original header corroborates it", () => {
  const formal = { ...filing, reference: { ...filing.reference, firstName: "Formal", office: "Person, Example (Senator)" }, filer: "Formal Person (Person, Example)" };
  assert.equal(resolveSenatePerson(formal, people)?.bioguide, "E000001");
  assert.equal(resolveSenatePerson({ ...formal, filer: "Formal Person" }, people), null);
  assert.equal(resolveSenatePerson({ ...formal, reference: { ...formal.reference, office: "Other, Example (Senator)" } }, people), null);
});
test("linked issuer is not silently classified as stock, and owner and source dates survive", () => {
  const result = buildSenateCandidate([filing], people, master);
  assert.equal(result.identityLinkedRows, 1); assert.equal(result.securityLinkedRows, 1);
  assert.ok(result.rows[0].holds.includes("security_type_review_required"));
  assert.equal(result.rows[0].owner, "Spouse"); assert.equal(result.rows[0].transactionDate, "2026-08-01");
  assert.equal(result.rows[0].filedDate, "2026-08-05"); assert.deepEqual(result.rows[0].raw, row.raw);
});
test("public projection preserves row qualifiers and separately scoped filing notes", () => {
  const advisorNote = "Advisor initiated transactions for a jointly held account.";
  const result = buildSenateCandidate([{ ...filing, rows: [row, { ...row, id: "senate:example:row:2", raw: { ...row.raw, comment: advisorNote } }] }], people, master);
  const prepared = prepareSenatePublicRelease({ ...result, runs: [{ runId: "synthetic", from: "2026-01-01", to: "2026-09-15", reports: 1 }],
    skippedRuns: [], unresolved: [], rosterAvailable: true, amendmentWorklist: [], from: "2026-01-01", to: "2026-09-15" });
  assert.equal(prepared.approval, null);
  assert.equal(prepared.payload.records[0].sourceComment, "Source comment");
  assert.equal(prepared.payload.records[1].sourceComment, advisorNote);
  assert.deepEqual(prepared.payload.records[0].filingNotes, ["Source comment", advisorNote]);
});
test("issuer mismatch and unknown fund ticker remain visible but held", () => {
  for (const changed of [{ ...row, assetName: "Other Company" }, { ...row, raw: { ...row.raw, tickerText: "FUND" } }]) {
    const result = buildSenateCandidate([{ ...filing, rows: [changed] }], people, master);
    assert.equal(result.rows.length, 1); assert.equal(result.securityLinkedRows, 0);
    assert.ok(result.rows[0].holds.includes("security_identity_unresolved_or_conflicting"));
  }
});
test("unresolved amendments never produce a reconciled activity projection", () => {
  const amendment = { ...filing, reference: { ...filing.reference, id: "amendment" }, amendment: true };
  const result = buildSenateCandidate([filing, amendment], people, master);
  assert.ok(result.blockers.length); assert.ok(result.rows.every(row => row.holds.includes("report_reconciliation_required")));
});
test("an older amendment holds its family, not an unrelated verified disclosure", () => {
  const older = { ...filing, reference: { ...filing.reference, id: "older" }, title: "Periodic Transaction Report for 01/05/2025 (Amendment 1)", amendment: true };
  const result = buildSenateCandidate([filing, older], people, master);
  assert.equal(result.disclosureRows.length, 1); assert.equal(result.disclosureRows[0].reportId, "example");
  assert.equal(result.activityRows.length, 0); assert.equal(result.publicationApproved, false);
});
test("paper/unparsed report in the same family also holds electronic originals", () => {
  const result = buildSenateCandidate([filing], people, master, [], [], [{ ...filing.reference, id: "paper", format: "paper" }]);
  assert.equal(result.disclosureRows.length, 0);
});
test("security classification requires exact row, document, issuer and review evidence", () => {
  const review: SenateSecurityReview = { rowId: row.id, documentSha256: filing.documentSha256, cik: "0000000001", kind: "company_stock", reviewedBy: "Synthetic unit test", reviewedAt: "2026-09-14", evidenceNote: "Synthetic test evidence", evidenceUrl: "https://example.com/test-only" };
  assert.equal(buildSenateCandidate([filing], people, master, [], [review]).activityRows.length, 1);
  for (const invalid of [{ ...review, documentSha256: "changed" }, { ...review, cik: "0000000002" }, { ...review, evidenceNote: "" }])
    assert.equal(buildSenateCandidate([filing], people, master, [], [invalid]).activityRows.length, 0);
  assert.equal(buildSenateCandidate([filing], people, master, [], [review, review]).activityRows.length, 0);
});
test("amendment comparison preserves repeated equal rows and does not approve replacement", () => {
  const original = { ...filing, rows: [row, { ...row, id: "repeated" }] };
  const amendment = { ...filing, reference: { ...filing.reference, id: "amendment" }, amendment: true };
  const queue = senateAmendmentWorklist([original, amendment]);
  assert.equal(queue[0].candidates[0].unchangedRows, 1); assert.equal(queue[0].candidates[0].removedOrChangedRows, 1);
  assert.equal(queue[0].reason, "complete_replacement_review_required");
});
