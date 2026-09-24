import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseForm4 } from "../src/lib/form4/parse.ts";
import { reconcileForm4Rows, reconcileForm4ByIssuer, type Form4CorrectionReview } from "../src/lib/form4/reconcile.ts";
import type { Form4Filing } from "../src/lib/form4/types.ts";

const fixtureDir = join(import.meta.dirname, "fixtures", "form4");
const manifest = JSON.parse(readFileSync(join(fixtureDir, "manifest.json"), "utf8"));
function fixture(accession: string): Form4Filing {
  const entry = manifest.filings.find((item: { accession: string }) => item.accession === accession);
  const parsed = parseForm4({
    xml: readFileSync(join(fixtureDir, "documents", entry.file), "utf8"),
    accessionNumber: entry.accession, documentUrl: entry.documentUrl,
    indexUrl: entry.indexUrl, documentName: entry.documentName,
    importRunId: "reconciliation-test", firstObservedAt: "2026-09-13T00:00:00.000Z",
  });
  assert.ok(parsed.ok);
  return parsed.filing;
}
const reviewMeta = {
  reviewedBy: "TEST ONLY — not a publication approval",
  reviewedAt: "2026-09-13T00:00:00.000Z",
  evidenceNote: "Synthetic row mapping to exercise reconciliation; not a source-reviewed correction.",
};
test("unresolved amendments hold their issuer but not an unrelated company's rows", () => {
  const original = fixture("0001045810-23-000006"), amendment = fixture("0001045810-23-000050"), other = fixture("0000789019-26-000157");
  const result = reconcileForm4ByIssuer([original, amendment, other]);
  assert.ok(result.blockers.length);
  assert.deepEqual(result.heldIssuers, [original.issuer.cik]);
  assert.ok(result.eligible.activeRows.length);
  assert.ok(result.eligible.activeRows.every(item => item.filing.id === other.id));
  assert.equal(result.heldRows, original.rows.length + amendment.rows.length);
});
function pair() {
  // Authentic related documents; the mapping below is deliberately test-only.
  const original = fixture("0001045810-23-000006");
  const amendment = fixture("0001045810-23-000050");
  const review: Form4CorrectionReview = {
    ...reviewMeta, originalFilingId: original.id, amendmentFilingId: amendment.id,
    corrections: [{ originalRowIds: [original.rows[0].id], replacementRowIds: [amendment.rows[0].id] }],
    additionalRowIds: amendment.rows.slice(1).map(row => row.id),
  };
  return { original, amendment, review };
}
function blocked(filings: Form4Filing[], reviews: Form4CorrectionReview[], prefix: string) {
  const result = reconcileForm4Rows(filings, reviews);
  assert.equal(result.ready, false);
  assert.ok(result.blockers.some(reason => reason.startsWith(prefix)), result.blockers.join("\n"));
  assert.deepEqual(result.activeRows, []);
  assert.deepEqual(result.supersessions, []);
}

test("unamended filings retain source rows, including non-trade events", () => {
  const { original } = pair();
  const result = reconcileForm4Rows([original], []);
  assert.equal(result.ready, true);
  assert.equal(result.activeRows.length, original.rows.length);
  assert.equal(result.activeRows[0].row, original.rows[0]);
});
test("related original and amendment never auto-supersede", () => {
  const { original, amendment } = pair();
  blocked([original, amendment], [], "unresolved_amendment:");
});
test("review removes only explicitly superseded rows and never mutates evidence", () => {
  const { original, amendment, review } = pair();
  const before = JSON.stringify([original, amendment]);
  const result = reconcileForm4Rows([original, amendment], [review]);
  assert.equal(result.ready, true, result.blockers.join("\n"));
  assert.equal(result.activeRows.length, original.rows.length + amendment.rows.length - 1);
  assert.ok(!result.activeRows.some(item => item.row.id === original.rows[0].id));
  for (const row of original.rows.slice(1)) assert.ok(result.activeRows.some(item => item.row.id === row.id));
  assert.equal(JSON.stringify([original, amendment]), before);
  assert.equal(result.supersessions[0].originalRowId, original.rows[0].id);
});
test("every amendment row needs explicit correction or addition review", () => {
  const { original, amendment, review } = pair();
  review.corrections = [];
  review.additionalRowIds = [];
  blocked([original, amendment], [review], "unreviewed_amendment_row:");
});
test("blank review evidence blocks reconciliation", () => {
  const { original, amendment, review } = pair();
  review.evidenceNote = " ";
  blocked([original, amendment], [review], "correction_unreviewed:");
});
test("missing or stale document IDs cannot reconcile changed source bytes", () => {
  const { original, amendment, review } = pair();
  review.originalFilingId += "stale";
  blocked([original, amendment], [review], "correction_document_not_selected:");
});
test("a review cannot discard a row from an unrelated filing", () => {
  const { original, amendment, review } = pair();
  review.corrections[0].originalRowIds = ["unrelated-row"];
  blocked([original, amendment], [review], "unknown_original_row:");
});
test("double replacement accounting is refused", () => {
  const { original, amendment, review } = pair();
  review.additionalRowIds.push(amendment.rows[0].id);
  blocked([original, amendment], [review], "duplicate_replacement_row:");
});
test("conflicting corrections and duplicate reviews are refused", () => {
  const { original, amendment, review } = pair();
  blocked([original, amendment], [review, review], "conflicting_supersession:");
});
test("a reviewed deletion can remove a row without inventing a replacement", () => {
  const { original, amendment, review } = pair();
  review.corrections[0].replacementRowIds = [];
  review.additionalRowIds = amendment.rows.map(row => row.id);
  const result = reconcileForm4Rows([original, amendment], [review]);
  assert.ok(result.ready);
  assert.deepEqual(result.supersessions[0].replacementRowIds, []);
});
test("cross-issuer amendments are refused", () => {
  const { original, amendment, review } = pair();
  amendment.issuer.cik = "0000000001";
  blocked([original, amendment], [review], "correction_issuer_conflict:");
});
test("self-referential correction cycles are refused", () => {
  const { amendment, review } = pair();
  review.originalFilingId = amendment.id;
  review.corrections = [];
  review.additionalRowIds = amendment.rows.map(row => row.id);
  blocked([amendment], [review], "correction_cycle:");
});
test("duplicate archive identities and quarantined rows block the whole result", () => {
  const { original } = pair();
  blocked([original, original], [], "duplicate_filing_id:");
  original.rows[0].validation = "quarantined";
  blocked([original], [], "quarantined_filing:");
});
test("multiple byte versions require a pinned, reviewed document selection", () => {
  const { original } = pair();
  const changed = structuredClone(original);
  changed.documentSha256 = "a".repeat(64);
  changed.id = `${changed.accessionNumber}::${changed.documentSha256}`;
  for (const row of changed.rows) {
    row.filingId = changed.id;
    row.documentSha256 = changed.documentSha256;
    row.id = `${changed.id}::${row.table}::${row.rowKind}::${row.sourceOrdinal}`;
  }
  blocked([original, changed], [], "unresolved_document_versions:");
  const result = reconcileForm4Rows([original, changed], [], [{
    ...reviewMeta, accessionNumber: changed.accessionNumber, filingId: changed.id,
  }]);
  assert.ok(result.ready);
  assert.ok(result.activeRows.every(item => item.filing.id === changed.id));
});
test("tampered row provenance is refused", () => {
  const { original } = pair();
  original.rows[0].filingId = "wrong";
  blocked([original], [], "row_identity_mismatch:");
});
