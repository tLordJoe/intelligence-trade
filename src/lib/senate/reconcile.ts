import type { parseSenateReport } from "./parse.ts";
type Filing = ReturnType<typeof parseSenateReport>;

/** An explicit review of complete-report replacement, never inferred from similar rows. */
export interface SenateAmendmentReview {
  originalId: string;
  originalSha256: string;
  amendmentId: string;
  amendmentSha256: string;
  mode: "complete-report-replacement";
  reviewedBy: string;
  reviewedAt: string;
  evidenceNote: string;
}

export function reconcileSenateReports(filings: readonly Filing[], reviews: readonly SenateAmendmentReview[]) {
  const blockers: string[] = [];
  const byId = new Map<string, Filing>();
  for (const filing of filings) {
    if (byId.has(filing.reference.id)) blockers.push(`duplicate_or_multiple_document_versions:${filing.reference.id}`);
    byId.set(filing.reference.id, filing);
    if (filing.warnings.includes("index_document_filer_mismatch")) blockers.push(`filer_identity_conflict:${filing.reference.id}`);
    if (filing.rows.some(row => row.issues.length)) blockers.push(`unresolved_row_issues:${filing.reference.id}`);
  }
  const supersededBy = new Map<string, string>();
  const reviewedAmendments = new Set<string>();
  const name = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const reportDate = (f: Filing) => /\bfor\s+(\d{2}\/\d{2}\/\d{4})\b/i.exec(f.title)?.[1];
  for (const review of reviews) {
    const original = byId.get(review.originalId), amendment = byId.get(review.amendmentId);
    if (review.mode !== "complete-report-replacement" || !review.reviewedBy.trim() || !review.evidenceNote.trim() ||
        !Number.isFinite(Date.parse(review.reviewedAt))) {
      blockers.push(`incomplete_amendment_review:${review.amendmentId}`); continue;
    }
    if (!original || !amendment || original === amendment || !amendment.amendment) {
      blockers.push(`invalid_amendment_pair:${review.amendmentId}`); continue;
    }
    if (original.documentSha256 !== review.originalSha256 || amendment.documentSha256 !== review.amendmentSha256) {
      blockers.push(`reviewed_bytes_changed:${review.amendmentId}`); continue;
    }
    if (name(original.reference.firstName) !== name(amendment.reference.firstName) ||
        name(original.reference.lastName) !== name(amendment.reference.lastName) ||
        !reportDate(original) || reportDate(original) !== reportDate(amendment) ||
        amendment.reference.receivedDate < original.reference.receivedDate) {
      blockers.push(`incompatible_amendment_pair:${review.amendmentId}`); continue;
    }
    if (supersededBy.has(review.originalId) || reviewedAmendments.has(review.amendmentId)) {
      blockers.push(`conflicting_amendment_review:${review.amendmentId}`); continue;
    }
    supersededBy.set(review.originalId, review.amendmentId);
    reviewedAmendments.add(review.amendmentId);
  }
  for (const filing of filings) {
    if (filing.amendment && !reviewedAmendments.has(filing.reference.id)) blockers.push(`unreviewed_amendment:${filing.reference.id}`);
  }
  for (const start of supersededBy.keys()) {
    const seen = new Set<string>(); let next: string | undefined = start;
    while (next) {
      if (seen.has(next)) { blockers.push(`amendment_cycle:${start}`); break; }
      seen.add(next); next = supersededBy.get(next);
    }
  }
  const ready = blockers.length === 0;
  return { ready, blockers: [...new Set(blockers)],
    activeFilings: ready ? filings.filter(f => !supersededBy.has(f.reference.id)) : [],
    supersessions: ready ? [...supersededBy].map(([originalId, amendmentId]) => ({ originalId, amendmentId })) : [],
    // Reconciliation is not identity clearance, completeness certification or permission to publish.
    publicationApproved: false as const };
}
