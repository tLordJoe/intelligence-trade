/**
 * Versioned record schema for congressional disclosure data.
 *
 * Two rules govern everything here:
 *
 *  1. Raw source values are never overwritten. Normalization writes to new
 *     fields; `raw` always holds exactly what the filing said. That is what
 *     makes a correction auditable after the fact.
 *  2. Identity comes from the source document, not from the record's content.
 *     Content-derived keys silently merge two legitimate transactions that
 *     happen to match on every visible field.
 */

export const SCHEMA_VERSION = 1;

/** Chambers this framework can ingest. Only House is wired up today. */
export type SourceChamber = "House" | "Senate";

export type TransactionType = "Buy" | "Sell" | "Exchange";

/** How confident we are that `ticker` names a real, current security. */
export type TickerResolution =
  | "verified" // exact match in the SEC security master
  | "aliased" // matched after normalizing punctuation, e.g. BRK.B -> BRK-B
  | "unknown"; // not in the master — quarantined, never published

/**
 * Validation outcome. `quarantined` records are written to a separate file and
 * are never served; they exist so a human can inspect what the parser produced
 * rather than having it silently dropped.
 */
export type RecordStatus = "valid" | "warning" | "quarantined";

/** How the record's stable id was derived. */
export type IdStrategy = "filing-row" | "fingerprint";

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
  /** Zero-based transaction row within that document. */
  rowIndex: number;
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
  /** Stable identity, `${docId}#${rowIndex}` for filing-row strategy. */
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
  /** Human-readable range, preserved for display. */
  amount: string;
  amountLow: number;
  amountHigh: number;
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
}

/** Per-run counts. Every stage is recorded so drops are visible, not inferred. */
export interface ImportCounts {
  /** Filings advertised by the source index. */
  sourceFilings: number;
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

/** Records held back from publication, with the reason. */
export interface QuarantineFile {
  schemaVersion: number;
  updatedAt: string;
  records: DisclosureRecord[];
}

export function emptyCounts(): ImportCounts {
  return {
    sourceFilings: 0,
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
    archiveBefore: 0,
    archiveAfter: 0,
  };
}

/** `${docId}#${rowIndex}` — stable across re-parses of the same filing. */
export function filingRowId(docId: string, rowIndex: number): string {
  return `${docId}#${rowIndex}`;
}
