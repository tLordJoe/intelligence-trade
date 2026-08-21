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
  TickerResolution,
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

/** Below this share of the comparable previous run, a drop warns. */
export const RECORD_DROP_WARN_RATIO = 0.95;

/**
 * Below this share of the comparable previous run, a drop blocks.
 *
 * Append-only storage protects records already held, but it cannot notice that
 * a run failed to collect disclosures it should have collected. A materially
 * smaller harvest is treated as a broken run rather than a quiet one.
 */
export const RECORD_DROP_FAIL_RATIO = 0.85;

/** Share of selected filings that must download for the run to be trusted. */
export const DOWNLOAD_COMPLETION_MIN = 0.9;

/** Share of downloaded filings that must parse for the run to be trusted. */
export const PARSE_COMPLETION_MIN = 0.9;

export interface RecordAssessment {
  status: RecordStatus;
  warnings: string[];
  /**
   * The resolved security, returned so the caller can persist it.
   *
   * Resolution was previously computed here to raise warnings and then thrown
   * away, leaving every archived record marked `unknown` with no CIK. The
   * lookup is the useful part; the warning is a by-product.
   */
  tickerResolution: TickerResolution;
  /** Canonical SEC symbol when resolved, otherwise the ticker as filed. */
  resolvedTicker: string;
  /** SEC Central Index Key when resolved. */
  cik?: string;
  /** Issuer name as registered with the SEC, when resolved. */
  registeredName?: string;
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

/**
 * Does the value name a real calendar date in ISO form?
 *
 * A plain Date parse is not enough: JavaScript silently rolls impossible dates
 * forward, so `2026-02-31` becomes 3 March and `2025-02-29` becomes 1 March —
 * both would pass a NaN check while denoting a day that never existed. The
 * components are therefore compared against the parsed date, which only
 * round-trips when the date is genuine.
 */
export function isIsoDate(value: string): boolean {
  const text = String(value ?? "");
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
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
  // Distinguished by status, not by falsiness. `!record.amountLow` was also
  // true for a legitimately disclosed $0, and said nothing about *why* an
  // amount was absent.
  if (record.amountStatus === "parse_failed") {
    warnings.push("amount_parse_failed");
  } else if (record.amountStatus === "not_disclosed") {
    warnings.push("amount_not_disclosed");
  } else if (record.amountStatus === "not_applicable") {
    warnings.push("amount_not_applicable");
  }

  const status: RecordStatus = quarantine
    ? "quarantined"
    : warnings.length
      ? "warning"
      : "valid";

  return {
    status,
    warnings,
    tickerResolution: lookup.resolution,
    resolvedTicker: lookup.ticker,
    cik: lookup.cik,
    registeredName: lookup.title,
  };
}

export interface RunGateInput {
  counts: ImportCounts;
  /**
   * Records accepted per parsed filing in the previous successful run.
   *
   * A rate rather than a total, because the import window legitimately varies:
   * a backfill may cover 359 filings and a routine run 150. Comparing absolute
   * counts across different window sizes would fail every routine run after a
   * backfill.
   */
  previousYieldPerFiling?: number;
  /** Mean records per parsed filing across recent runs, if any. */
  baselineYieldPerFiling?: number;
  /**
   * Documents that produced at least one row in the previous archive. A filing
   * that parsed before and yields nothing now indicates parser regression.
   */
  previouslyProductiveDocIds?: Set<string>;
  /** Documents that parsed this run but produced no rows. */
  zeroRowDocIds?: string[];
  /**
   * Explicit reviewed override for a completeness drop.
   *
   * Set only by a human who has looked at the numbers and accepts them — for
   * instance when the source genuinely published fewer filings. Recorded in the
   * import report so the override is never invisible.
   */
  allowCompletenessDrop?: boolean;
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
  const {
    counts,
    previousYieldPerFiling,
    baselineYieldPerFiling,
    previouslyProductiveDocIds,
    zeroRowDocIds,
    allowCompletenessDrop,
  } = input;
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

  // --- filing completion ---------------------------------------------------
  //
  // A run that quietly fetched a fraction of what it selected looks identical
  // to a healthy run once the archive is append-only, because nothing is lost —
  // it simply fails to gain what it should have.
  if (counts.selectedFilings > 0) {
    const downloadRatio = counts.downloadedFilings / counts.selectedFilings;
    if (downloadRatio < DOWNLOAD_COMPLETION_MIN) {
      failures.push(
        `download_completion_too_low:${counts.downloadedFilings}/${counts.selectedFilings}`
      );
    }
  }
  if (counts.downloadedFilings > 0) {
    const parseRatio = counts.parsedFilings / counts.downloadedFilings;
    if (parseRatio < PARSE_COMPLETION_MIN) {
      failures.push(
        `parse_completion_too_low:${counts.parsedFilings}/${counts.downloadedFilings}`
      );
    }
  }

  // A filing that yielded rows before and yields none now is a parser
  // regression, regardless of how healthy the totals look.
  if (previouslyProductiveDocIds?.size && zeroRowDocIds?.length) {
    const regressed = zeroRowDocIds.filter((d) => previouslyProductiveDocIds.has(d));
    if (regressed.length) {
      failures.push(
        `previously_productive_filings_now_empty:${regressed.length}:${regressed.slice(0, 5).join(",")}`
      );
    }
  }

  // --- zero-row filings ----------------------------------------------------
  //
  // A filing that has always been empty is not therefore healthy. Each empty
  // filing is classified, and the classification that means "we found a
  // security we support and produced nothing from it" blocks the run — that is
  // the signature of silent row loss, which is exactly how twelve real
  // transactions went missing before this check existed.
  if (counts.suspiciousZeroRowFilings > 0) {
    failures.push(
      `unexplained_zero_row_filings:${counts.suspiciousZeroRowFilings}`
    );
  }

  // Scanned filings extract as nothing. They are a known, stable population of
  // paper submissions, so they warn rather than block — but they are never
  // silent, because their contents are genuinely unread.
  if (counts.scannedFilings > 0) {
    warnings.push(`scanned_filings_unreadable:${counts.scannedFilings}`);
  }

  // An amount present in the source that we could not read is a defect, not an
  // absence. Surfaced separately from amounts the filer never disclosed.
  if (counts.amountParseFailures > 0) {
    warnings.push(`amount_parse_failures:${counts.amountParseFailures}`);
  }

  // --- completeness --------------------------------------------------------
  //
  // Measured as yield per parsed filing rather than an absolute count. The
  // window size is a scheduling decision — a backfill covers the whole annual
  // index, a routine run covers a recent slice — and comparing totals across
  // different windows would fail every routine run following a backfill.
  const yieldPerFiling =
    counts.parsedFilings > 0 ? counts.accepted / counts.parsedFilings : 0;

  const dropChecks: Array<[string, number]> = [];
  if (typeof previousYieldPerFiling === "number" && previousYieldPerFiling > 0) {
    dropChecks.push(["previous_run", previousYieldPerFiling]);
  }
  if (typeof baselineYieldPerFiling === "number" && baselineYieldPerFiling > 0) {
    dropChecks.push(["baseline", baselineYieldPerFiling]);
  }

  const fmt = (n: number) => n.toFixed(2);
  for (const [label, reference] of dropChecks) {
    if (yieldPerFiling < reference * RECORD_DROP_FAIL_RATIO) {
      const code = `yield_far_below_${label}:${fmt(yieldPerFiling)}<${fmt(reference)}_per_filing`;
      if (allowCompletenessDrop) {
        warnings.push(`${code}:override_accepted`);
      } else {
        failures.push(code);
      }
    } else if (yieldPerFiling < reference * RECORD_DROP_WARN_RATIO) {
      warnings.push(
        `yield_below_${label}:${fmt(yieldPerFiling)}<${fmt(reference)}_per_filing`
      );
    }
  }

  if (counts.missingFilingUrl > 0) {
    warnings.push(`records_missing_filing_url:${counts.missingFilingUrl}`);
  }
  if (counts.duplicates > 0) {
    warnings.push(`duplicate_ids_collapsed:${counts.duplicates}`);
  }

  return { passed: failures.length === 0, failures, warnings };
}
