/**
 * Versioned record schema for congressional disclosure data.
 *
 * Two rules govern everything here:
 *
 *  1. Raw source values are never overwritten. Normalization writes to new
 *     fields; `raw` always holds exactly what the filing said. That is what
 *     makes a correction auditable after the fact.
 *  2. Identity is content-addressed within its source document, so it survives
 *     parser changes. See congress-identity.ts for why positional identity was
 *     abandoned.
 */

/**
 * Bumped to 2: `amountLow`/`amountHigh` became nullable and `amountStatus` was
 * added, so a missing amount is no longer indistinguishable from a $0 one.
 */
export const SCHEMA_VERSION = 2;

/** Chambers this framework can ingest. Only House is wired up today. */
export type SourceChamber = "House" | "Senate";

export type TransactionType = "Buy" | "Sell" | "Exchange";

/**
 * How much is known about a record's amount.
 *
 * `disclosed_range` and `disclosed_exact` are the only values that carry
 * numeric bounds. Everything else has `null` bounds and must be excluded from
 * totals, averages, sorting and amount filters — never coerced to zero.
 */
export type AmountStatus =
  | "disclosed_range"
  | "disclosed_exact"
  | "not_disclosed"
  | "not_applicable"
  | "parse_failed";

/** Why a filing produced no transaction rows. */
export type ZeroRowClassification =
  | "no_ticker_present"
  | "no_supported_security_transaction"
  | "empty_text_extraction"
  | "unsupported_layout"
  | "parser_suspicious";

/**
 * One filing that yielded no rows, recorded so the outcome can be audited.
 *
 * Written for every run. A filing that has always been empty is not assumed
 * healthy: the classification says *why* it is empty, and the unexplained
 * classification blocks the run.
 */
export interface ZeroRowFiling {
  docId: string;
  filingUrl: string;
  filer: string;
  /** ISO date (YYYY-MM-DD) when the filing was filed. */
  filedDate: string;
  classification: ZeroRowClassification;
  /** Characters of text extracted. Near-zero means a scanned document. */
  textLength: number;
  /** Symbol-bearing blocks seen, whether or not they produced a row. */
  symbolBlocks: number;
  /** Asset-type codes present but not supported, e.g. `CT` for cryptocurrency. */
  unsupportedAssetTypes: string[];
  /** True when this filing has produced rows in a previous run. */
  previouslyProductive: boolean;
}

export interface ZeroRowFile {
  schemaVersion: number;
  runId: string;
  capturedAt: string;
  counts: Record<ZeroRowClassification, number>;
  filings: ZeroRowFiling[];
}

/** How confident we are that `ticker` names a real, current security. */
export type TickerResolution =
  | "verified" // exact match in the SEC security master
  | "aliased" // matched after normalizing punctuation, e.g. BRK.B -> BRK-B
  | "unknown"; // absent from the master — flagged for review, still published

/**
 * Validation outcome. `quarantined` records are written to a review queue and
 * are never served; they exist so a human can inspect what the parser produced
 * rather than having it silently dropped.
 */
export type RecordStatus = "valid" | "warning" | "quarantined";

/**
 * How the record's stable id was derived.
 *
 * `content-row` is the current strategy: document id plus a hash of the row's
 * canonical content plus an occurrence counter. `filing-row` is the superseded
 * positional strategy, retained only so older archives can be recognized during
 * reconciliation.
 */
export type IdStrategy = "content-row" | "filing-row" | "fingerprint";

/** One field changed by a reviewed re-interpretation of the same filing row. */
export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

/**
 * A recorded correction.
 *
 * Raw source values and provenance are immutable. When a parser improvement
 * changes how a row is *interpreted*, the new normalized values are applied and
 * the change is logged here, so a correction is always visible rather than
 * silent.
 */
export interface RecordRevision {
  at: string;
  importRunId: string;
  changes: FieldChange[];
}

/** Exactly what the filing said, before any cleanup. Never mutated. */
export interface RawDisclosureValues {
  issuerName: string;
  tickerText: string;
  amountText: string;
  typeText: string;
  ownerText: string;
  transactionDateText: string;
  filedDateText: string;
}

/** Where the record came from and when we first saw it. */
export interface RecordProvenance {
  sourceChamber: SourceChamber;
  /** Canonical URL of the official filing document. */
  filingUrl: string;
  /** Source document identifier, e.g. the House Clerk DocID. */
  docId: string;
  /** Zero-based transaction row within that document, in document order. */
  rowIndex: number;
  /** Hash of the row's canonical content — the stable part of its identity. */
  contentHash: string;
  /** Which occurrence of identical content within the document this is. */
  occurrence: number;
  /**
   * Identity of the transaction's economic core, independent of the fields a
   * parser may correct. Used to recognize a corrected row as a revision of an
   * existing record rather than a new one.
   */
  reconciliationKey: string;
  /** ISO timestamp, set on first ingest and never changed afterwards. */
  firstSeen: string;
  /** ISO timestamp, refreshed each time the record is seen again. */
  lastSeen: string;
  /** Identifier of the import run that first produced this record. */
  importRunId: string;
  schemaVersion: number;
}

/**
 * A single disclosed transaction.
 *
 * Field order matters for review: identity, then the normalized values the site
 * renders, then the audit trail.
 */
export interface DisclosureRecord {
  /** Stable identity: `{docId}::{contentHash}::{occurrence}`. */
  id: string;
  idStrategy: IdStrategy;

  // --- normalized values rendered by the site ---
  politician: string;
  /** null when the filer's party could not be resolved. Never guessed. */
  party: "D" | "R" | null;
  chamber: SourceChamber;
  state: string;
  district: string;
  ticker: string;
  companyName: string;
  type: TransactionType;
  /** Human-readable amount as disclosed, or `""` when none was disclosed. */
  amount: string;
  /**
   * Amount bounds in dollars, or `null` when no amount is known.
   *
   * Never zero for a missing amount. An absent amount previously stored as
   * `0`/`0` would have contributed silently to any total or average; `null`
   * forces every consumer to exclude it. Use the helpers in `amounts.ts`.
   */
  amountLow: number | null;
  amountHigh: number | null;
  /** How much is known about the amount. See `AmountStatus`. */
  amountStatus: AmountStatus;
  /** ISO date (YYYY-MM-DD). */
  transactionDate: string;
  /** ISO date (YYYY-MM-DD). */
  filedDate: string;
  isOptions: boolean;
  /** Official filing URL. Mirrors provenance.filingUrl for API compatibility. */
  source: string;

  // --- audit trail ---
  raw: RawDisclosureValues;
  provenance: RecordProvenance;
  status: RecordStatus;
  /** Machine-readable warning codes, e.g. "truncated_issuer_name". */
  warnings: string[];
  tickerResolution: TickerResolution;
  /** SEC Central Index Key when the ticker resolved. */
  cik?: string;
  /** Corrections applied to normalized fields, oldest first. */
  revisions?: RecordRevision[];
}

/** Per-run counts. Every stage is recorded so drops are visible, not inferred. */
export interface ImportCounts {
  /** Filings advertised by the source index. */
  sourceFilings: number;
  /** Filings this run intended to process. */
  selectedFilings: number;
  /** Filings whose document downloaded successfully. */
  downloadedFilings: number;
  /** Filings that downloaded but could not be parsed. */
  failedParses: number;
  /** Filings that parsed but yielded no transaction rows. */
  zeroRowFilings: number;
  /** Zero-row filings whose text extraction produced essentially nothing. */
  scannedFilings: number;
  /** Zero-row filings holding a supported symbol that produced no row. */
  suspiciousZeroRowFilings: number;
  /** Rows whose amount could not be read though one is present in the source. */
  amountParseFailures: number;
  /** Rows carrying no numeric amount, for any reason. */
  amountsUnknown: number;
  /** Rows reassembled from a wrapped layout. */
  wrappedRows: number;
  /** Filings actually fetched and parsed. */
  parsedFilings: number;
  /** Transaction rows extracted from those filings. */
  parsedRecords: number;
  accepted: number;
  warned: number;
  quarantined: number;
  duplicates: number;
  missingParty: number;
  missingTicker: number;
  missingFilingUrl: number;
  /** Records added to the archive this run. */
  added: number;
  /** Existing records whose lastSeen was refreshed. */
  refreshed: number;
  /** Existing records whose normalized fields were corrected. */
  revised: number;
  /** Archive size before and after the merge. */
  archiveBefore: number;
  archiveAfter: number;
}

/**
 * The published archive.
 *
 * `trades` keeps its historical key name so existing API routes and components
 * continue to work without modification.
 */
export interface DisclosureArchive {
  schemaVersion: number;
  updatedAt: string;
  source: string;
  coverage: string;
  limitations: string;
  /** Counts from the most recent successful import. */
  counts: ImportCounts;
  /** Identifier of the most recent import run that modified the archive. */
  lastImportRunId: string;
  trades: DisclosureRecord[];
}

/** Whether a quarantined record has been dealt with. */
export type QuarantineResolution = "open" | "resolved" | "dismissed";

/**
 * A quarantined record and its history.
 *
 * Quarantine is a review queue, not a bin. Entries accumulate across runs with
 * their own first/last-seen timestamps so a recurring problem is visible as
 * recurring, and a resolved one keeps its record.
 */
export interface QuarantineEntry {
  record: DisclosureRecord;
  firstSeen: string;
  lastSeen: string;
  /** Import runs in which this record was quarantined, oldest first. */
  runIds: string[];
  resolution: QuarantineResolution;
}

export interface QuarantineFile {
  schemaVersion: number;
  updatedAt: string;
  entries: QuarantineEntry[];
}

export function emptyCounts(): ImportCounts {
  return {
    sourceFilings: 0,
    selectedFilings: 0,
    downloadedFilings: 0,
    failedParses: 0,
    zeroRowFilings: 0,
    scannedFilings: 0,
    suspiciousZeroRowFilings: 0,
    amountParseFailures: 0,
    amountsUnknown: 0,
    wrappedRows: 0,
    parsedFilings: 0,
    parsedRecords: 0,
    accepted: 0,
    warned: 0,
    quarantined: 0,
    duplicates: 0,
    missingParty: 0,
    missingTicker: 0,
    missingFilingUrl: 0,
    added: 0,
    refreshed: 0,
    revised: 0,
    archiveBefore: 0,
    archiveAfter: 0,
  };
}

/**
 * Superseded positional id. Retained for reconciling older archives only —
 * new records use content-addressed identity from congress-identity.ts.
 */
export function filingRowId(docId: string, rowIndex: number): string {
  return `${docId}#${rowIndex}`;
}
