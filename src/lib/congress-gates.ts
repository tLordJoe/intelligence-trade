/**
 * Deterministic validation gates.
 *
 * These run before anything reaches the archive. They are assertions, not
 * judgement calls: every condition here is one the August 2026 incident either
 * produced or would have produced, and each is expressible as a rule that
 * either holds or does not.
 *
 * Two levels:
 *   - Record gates decide whether a single row is publishable, needs review, or
 *     must be quarantined.
 *   - Run gates decide whether the import as a whole is trustworthy enough to
 *     replace production. A failing run gate aborts the import; the previous
 *     known-good archive stays live.
 */

import type {
  DisclosureRecord,
  ImportCounts,
  RecordStatus,
} from "./congress-schema.ts";
import { isOfficialHouseFilingUrl } from "./congress-utils.ts";
import {
  issuerNameMatchesTicker,
  resolveTicker,
  type SecurityMaster,
} from "./security-master.ts";

/** Issuer names are truncated by the parser at this width. */
export const ISSUER_NAME_TRUNCATION_LENGTH = 60;

/** A run that loses more than this share of the archive is presumed broken. */
export const ARCHIVE_SHRINK_TOLERANCE = 0;

/** A run producing fewer than this share of the previous run's records warns. */
export const RECORD_DROP_WARN_RATIO = 0.9;

export interface RecordAssessment {
  status: RecordStatus;
  warnings: string[];
}

export interface RunGateResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

/**
 * Is this issuer name a truncation artifact rather than a real name?
 *
 * The old importer sliced names at 60 characters, producing values like
 * "Alphabet Inc. - Depositary Shares representing a 1/20th Inte". Length alone
 * is not proof — some issuer names are genuinely long — so we also require the
 * name to end mid-word.
 */
export function looksTruncated(issuerName: string): boolean {
  const name = String(issuerName ?? "");
  if (name.length < ISSUER_NAME_TRUNCATION_LENGTH) return false;
  if (name.length > ISSUER_NAME_TRUNCATION_LENGTH + 2) return false;
  // A complete name ends on a word boundary or closing punctuation.
  return !/[\s.,)\]]$/.test(name);
}

/** Does the value parse as a real calendar date in ISO form? */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/**
 * Assess one parsed record.
 *
 * Quarantine is reserved for defects that would put something false in front of
 * a reader: an unresolvable ticker, an issuer/ticker mismatch, a missing filing
 * link, or an unusable date. Everything else is published with a warning so the
 * record stays visible and correctable.
 */
export function assessRecord(
  record: DisclosureRecord,
  master: SecurityMaster
): RecordAssessment {
  const warnings: string[] = [];
  let quarantine = false;

  // --- ticker resolution -------------------------------------------------
  //
  // An unresolved symbol is flagged, not withheld. The SEC's company_tickers
  // feed is demonstrably incomplete — it omits listed issuers including BK,
  // EXAS, HOLX, CTRA and GTLS, and carries few foreign ADRs — so absence from
  // the master is evidence of a gap in the master, not proof the symbol is
  // wrong. Withholding on it would silently under-report real filings, which is
  // the failure mode this rebuild exists to prevent.
  const lookup = resolveTicker(record.raw.tickerText || record.ticker, master);
  if (lookup.resolution === "unknown") {
    warnings.push("unknown_ticker");
  } else if (lookup.resolution === "aliased") {
    warnings.push("ticker_aliased");
  }

  // --- issuer name vs ticker (the Berkshire/CARR gate) -------------------
  //
  // Only a hard conflict quarantines: the filed name explicitly contains a
  // *different* registered symbol, as in "Berkshire Hathaway Inc. (BRK.B)"
  // tagged CARR. A mere failure to match names is advisory, because issuer
  // names drift (GE now files as GE Aerospace while the master still reads
  // GENERAL ELECTRIC CO) and quarantining on that would reject good records.
  if (lookup.resolution !== "unknown") {
    const match = issuerNameMatchesTicker(record.raw.issuerName, lookup, master);
    if (!match.matches) {
      if (match.conflictingTicker) {
        warnings.push(`issuer_ticker_conflict:${match.conflictingTicker}`);
        quarantine = true;
      } else {
        warnings.push("issuer_ticker_mismatch");
      }
    }
  }

  // --- provenance --------------------------------------------------------
  if (!record.source || !isOfficialHouseFilingUrl(record.source)) {
    warnings.push("missing_or_unofficial_filing_url");
    quarantine = true;
  }
  if (!record.provenance?.docId) {
    warnings.push("missing_doc_id");
    quarantine = true;
  }

  // --- dates -------------------------------------------------------------
  if (!isIsoDate(record.transactionDate)) {
    warnings.push("invalid_transaction_date");
    quarantine = true;
  }
  if (!isIsoDate(record.filedDate)) {
    warnings.push("invalid_filed_date");
    quarantine = true;
  }

  // --- soft defects: published, but flagged ------------------------------
  if (looksTruncated(record.raw.issuerName)) warnings.push("truncated_issuer_name");
  if (!record.politician?.trim()) {
    warnings.push("missing_politician");
    quarantine = true;
  }
  // Party is never guessed. An unknown party is displayed as unknown.
  if (record.party !== "D" && record.party !== "R") warnings.push("unknown_party");
  if (!record.amountLow && !record.amountHigh) warnings.push("missing_amount");

  const status: RecordStatus = quarantine
    ? "quarantined"
    : warnings.length
      ? "warning"
      : "valid";

  return { status, warnings };
}

export interface RunGateInput {
  counts: ImportCounts;
  /** Accepted-record count from the previous successful run, if any. */
  previousAccepted?: number;
  /** Mean accepted count over recent runs, if any. */
  baselineAccepted?: number;
}

/**
 * Assess the run as a whole.
 *
 * The archive-shrink check is the gate that would have stopped the August
 * incident on day one: the published set fell 225 -> 182 while every run
 * reported success. An append-only archive must never lose records, so any
 * shrink is a hard failure rather than a warning.
 */
export function assessRun(input: RunGateInput): RunGateResult {
  const { counts, previousAccepted, baselineAccepted } = input;
  const failures: string[] = [];
  const warnings: string[] = [];

  if (counts.sourceFilings === 0) failures.push("source_returned_no_filings");
  if (counts.parsedFilings === 0) failures.push("no_filings_parsed");
  if (counts.parsedRecords === 0) failures.push("no_records_parsed");

  // Append-only invariant: the archive may grow or hold steady, never shrink.
  if (counts.archiveAfter < counts.archiveBefore - ARCHIVE_SHRINK_TOLERANCE) {
    failures.push(
      `archive_shrank:${counts.archiveBefore}->${counts.archiveAfter}`
    );
  }

  // Everything quarantined means the parser or the source format changed.
  if (counts.parsedRecords > 0 && counts.accepted === 0) {
    failures.push("all_records_rejected");
  }

  const quarantineRatio =
    counts.parsedRecords > 0 ? counts.quarantined / counts.parsedRecords : 0;
  if (quarantineRatio > 0.5) {
    failures.push(`quarantine_ratio_too_high:${quarantineRatio.toFixed(2)}`);
  } else if (quarantineRatio > 0.15) {
    warnings.push(`elevated_quarantine_ratio:${quarantineRatio.toFixed(2)}`);
  }

  // A sharp fall in what the source window yields is worth a human look even
  // though the archive itself is protected by the shrink gate.
  if (
    typeof previousAccepted === "number" &&
    previousAccepted > 0 &&
    counts.accepted < previousAccepted * RECORD_DROP_WARN_RATIO
  ) {
    warnings.push(
      `accepted_below_previous_run:${counts.accepted}<${previousAccepted}`
    );
  }
  if (
    typeof baselineAccepted === "number" &&
    baselineAccepted > 0 &&
    counts.accepted < baselineAccepted * RECORD_DROP_WARN_RATIO
  ) {
    warnings.push(
      `accepted_below_baseline:${counts.accepted}<${Math.round(baselineAccepted)}`
    );
  }

  if (counts.missingFilingUrl > 0) {
    warnings.push(`records_missing_filing_url:${counts.missingFilingUrl}`);
  }
  if (counts.duplicates > 0) {
    warnings.push(`duplicate_ids_collapsed:${counts.duplicates}`);
  }

  return { passed: failures.length === 0, failures, warnings };
}
