import type { Form4Filing, Form4Row } from "./types.ts";

/** Decisions refer to immutable document/row IDs, never dates or ticker matches. */
export interface Form4CorrectionReview {
  originalFilingId: string;
  amendmentFilingId: string;
  reviewedBy: string;
  reviewedAt: string;
  evidenceNote: string;
  corrections: {
    /** An amendment can split one reported row into several, or combine rows. */
    originalRowIds: string[];
    replacementRowIds: string[];
  }[];
  /** Rows newly reported by the amendment, explicitly reviewed as additions. */
  additionalRowIds: string[];
}

export interface Form4DocumentSelection {
  accessionNumber: string;
  filingId: string;
  reviewedBy: string;
  reviewedAt: string;
  evidenceNote: string;
}

export interface Form4Reconciliation {
  ready: boolean;
  blockers: string[];
  /** Empty on ANY failure: callers cannot accidentally total unresolved data. */
  activeRows: { filing: Form4Filing; row: Form4Row }[];
  supersessions: { originalRowId: string; replacementRowIds: string[]; amendmentFilingId: string }[];
}

const reviewed = (review: { reviewedBy: string; reviewedAt: string; evidenceNote: string }) =>
  typeof review.reviewedBy === "string" && review.reviewedBy.trim().length > 0 &&
  typeof review.evidenceNote === "string" && review.evidenceNote.trim().length > 0 &&
  typeof review.reviewedAt === "string" &&
  /^\d{4}-\d{2}-\d{2}T/.test(review.reviewedAt) && Number.isFinite(Date.parse(review.reviewedAt));

/**
 * Produces a derived active-row view without changing the append-only archive.
 * This is a reconciliation gate, NOT approval to publish a dataset. Import
 * completeness, source review, identity resolution and release checks still apply.
 * Never infer replacement from shared owner, date, symbol or submission date.
 */
export function reconcileForm4Rows(
  archive: Form4Filing[],
  reviews: Form4CorrectionReview[],
  selections: Form4DocumentSelection[] = [],
): Form4Reconciliation {
  const blockers: string[] = [];
  const supersessions: Form4Reconciliation["supersessions"] = [];
  const byId = new Map<string, Form4Filing>();
  const byAccession = new Map<string, Form4Filing[]>();
  const rowIds = new Set<string>();
  for (const filing of archive) {
    if (byId.has(filing.id)) blockers.push(`duplicate_filing_id:${filing.id}`);
    byId.set(filing.id, filing);
    byAccession.set(filing.accessionNumber, [...(byAccession.get(filing.accessionNumber) ?? []), filing]);
    if (filing.id !== `${filing.accessionNumber}::${filing.documentSha256}`) {
      blockers.push(`filing_identity_mismatch:${filing.id}`);
    }
    for (const row of filing.rows) {
      if (rowIds.has(row.id)) blockers.push(`duplicate_row_id:${row.id}`);
      rowIds.add(row.id);
      if (row.filingId !== filing.id || row.documentSha256 !== filing.documentSha256 ||
          row.accessionNumber !== filing.accessionNumber ||
          row.id !== `${filing.id}::${row.table}::${row.rowKind}::${row.sourceOrdinal}`) {
        blockers.push(`row_identity_mismatch:${row.id}`);
      }
    }
  }

  const selected = new Map<string, Form4DocumentSelection>();
  for (const selection of selections) {
    if (!reviewed(selection)) blockers.push(`document_selection_unreviewed:${selection.accessionNumber}`);
    if (selected.has(selection.accessionNumber)) blockers.push(`duplicate_document_selection:${selection.accessionNumber}`);
    if (byId.get(selection.filingId)?.accessionNumber !== selection.accessionNumber) {
      blockers.push(`unknown_document_selection:${selection.filingId}`);
    }
    selected.set(selection.accessionNumber, selection);
  }
  const filings: Form4Filing[] = [];
  for (const [accession, versions] of byAccession) {
    const selection = selected.get(accession);
    if (versions.length > 1 && !selection) {
      blockers.push(`unresolved_document_versions:${accession}`);
      continue;
    }
    const filing = selection ? versions.find(item => item.id === selection.filingId) : versions[0];
    if (filing) filings.push(filing);
  }
  const activeFilings = new Map(filings.map(filing => [filing.id, filing]));
  const reviewedAmendments = new Set<string>();
  const removed = new Set<string>();
  const parents = new Map<string, string>();

  for (const review of reviews) {
    const original = activeFilings.get(review.originalFilingId);
    const amendment = activeFilings.get(review.amendmentFilingId);
    if (!reviewed(review)) blockers.push(`correction_unreviewed:${review.amendmentFilingId}`);
    if (reviewedAmendments.has(review.amendmentFilingId)) blockers.push(`duplicate_amendment_review:${review.amendmentFilingId}`);
    reviewedAmendments.add(review.amendmentFilingId);
    if (!original || !amendment) {
      blockers.push(`correction_document_not_selected:${review.amendmentFilingId}`);
      continue;
    }
    if (original.id === amendment.id || amendment.documentType !== "4/A") {
      blockers.push(`invalid_correction_target:${amendment.id}`);
    }
    if (original.issuer.cik !== amendment.issuer.cik) blockers.push(`correction_issuer_conflict:${amendment.id}`);
    parents.set(amendment.id, original.id);
    const originals = new Set(original.rows.map(row => row.id));
    const replacements = new Set(amendment.rows.map(row => row.id));
    const accounted = new Set<string>();
    const account = (id: string) => {
      if (!replacements.has(id)) blockers.push(`unknown_replacement_row:${id}`);
      if (accounted.has(id)) blockers.push(`duplicate_replacement_row:${id}`);
      accounted.add(id);
    };
    for (const correction of review.corrections) {
      // A deletion is allowed, but must identify the original row explicitly.
      if (!correction.originalRowIds.length) blockers.push(`empty_correction:${amendment.id}`);
      for (const id of correction.originalRowIds) {
        if (!originals.has(id)) blockers.push(`unknown_original_row:${id}`);
        if (removed.has(id)) blockers.push(`conflicting_supersession:${id}`);
        removed.add(id);
        supersessions.push({ originalRowId: id, replacementRowIds: [...correction.replacementRowIds], amendmentFilingId: amendment.id });
      }
      correction.replacementRowIds.forEach(account);
    }
    review.additionalRowIds.forEach(account);
    for (const id of replacements) {
      if (!accounted.has(id)) blockers.push(`unreviewed_amendment_row:${id}`);
    }
  }

  for (const filing of filings) {
    if (filing.documentType === "4/A" && !reviewedAmendments.has(filing.id)) {
      blockers.push(`unresolved_amendment:${filing.id}`);
    }
    if (filing.validation === "quarantined" || filing.rows.some(row => row.validation === "quarantined")) {
      blockers.push(`quarantined_filing:${filing.id}`);
    }
    const seen = new Set<string>();
    let id: string | undefined = filing.id;
    while (id !== undefined) {
      if (seen.has(id)) { blockers.push(`correction_cycle:${filing.id}`); break; }
      seen.add(id);
      id = parents.get(id);
    }
  }

  const uniqueBlockers = [...new Set(blockers)].sort();
  return {
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    activeRows: uniqueBlockers.length ? [] : filings.flatMap(filing =>
      filing.rows.filter(row => !removed.has(row.id)).map(row => ({ filing, row }))),
    supersessions: uniqueBlockers.length ? [] : supersessions,
  };
}

/** Hold the whole issuer when a correction is unresolved; unrelated issuers can be reviewed. */
export function reconcileForm4ByIssuer(archive: Form4Filing[], reviews: Form4CorrectionReview[] = [], selections: Form4DocumentSelection[] = []) {
  const ids = new Set(archive.map(filing => filing.id));
  if (reviews.some(review => !ids.has(review.originalFilingId) || !ids.has(review.amendmentFilingId)) || selections.some(selection => !ids.has(selection.filingId))) throw new Error("Correction ledger references absent source documents");
  const eligible: Form4Reconciliation = { ready: true, blockers: [], activeRows: [], supersessions: [] };
  const blockers: string[] = [], heldIssuers: string[] = [];
  let heldRows = 0;
  for (const cik of new Set(archive.map(filing => filing.issuer.cik))) {
    const group = archive.filter(filing => filing.issuer.cik === cik);
    const groupIds = new Set(group.map(filing => filing.id));
    const accessions = new Set(group.map(filing => filing.accessionNumber));
    const result = reconcileForm4Rows(group, reviews.filter(review => groupIds.has(review.originalFilingId) || groupIds.has(review.amendmentFilingId)), selections.filter(selection => accessions.has(selection.accessionNumber)));
    if (!result.ready) { heldIssuers.push(cik); heldRows += group.reduce((n, filing) => n + filing.rows.length, 0); blockers.push(...result.blockers); }
    else { eligible.activeRows.push(...result.activeRows); eligible.supersessions.push(...result.supersessions); }
  }
  return { eligible, blockers, heldIssuers, heldRows };
}
