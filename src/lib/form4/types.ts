/**
 * Form 4 record contract.
 *
 * Two rules run through every type here.
 *
 * Unknown is not zero, false, or an invented date. Every field the source may
 * omit is nullable, and several carry a reason alongside the null so a reader
 * can tell "the filing did not say" from "we could not read what it said".
 *
 * Raw source text is preserved beside every normalized interpretation. A
 * corrected parser changes the interpretation and leaves the raw alone, which
 * is what makes a correction checkable against the document afterwards.
 */

export const FORM4_SCHEMA_VERSION = 1;

/**
 * Bumped whenever parsing or classification changes how a document is read.
 * Stored on every row so a stored interpretation can be traced to the code
 * that produced it.
 */
export const FORM4_PARSER_VERSION = 1;

export type Form4DocumentType = "4" | "4/A";

/** Why a value is absent, when absence is itself information. */
export type AbsenceReason =
  | "not_present_in_source"
  | "footnote_instead_of_value"
  | "unparseable";

export interface Nullable<T> {
  value: T | null;
  /** Exactly what the document said, before normalization. */
  raw: string | null;
  /** Present only when `value` is null. */
  reason: AbsenceReason | null;
  /** Footnote ids attached to this field. Coexist with a value; do not replace it. */
  footnoteIds: string[];
}

/** A decimal held as a string. Money and share counts never touch binary floats. */
export type DecimalString = string;

export interface Issuer {
  /** Zero-padded to ten digits. Identifies an entity, not a share class. */
  cik: string;
  name: string | null;
  tradingSymbol: string | null;
  /**
   * Resolution of the raw symbol against a security master. Null until a
   * mapping exists; the raw symbol is never promoted to a resolved ticker.
   */
  resolvedTicker: string | null;
  tickerResolution: "unresolved" | "matched_symbol" | "ambiguous";
  tickerResolutionSource: string | null;
}

/**
 * One reporting owner on the filing.
 *
 * Flags are true/false/null — an absent flag is not false. `name` may be an
 * entity rather than a person; nothing here infers a human from it.
 */
export interface ReportingOwner {
  cik: string;
  name: string | null;
  isDirector: boolean | null;
  isOfficer: boolean | null;
  isTenPercentOwner: boolean | null;
  isOther: boolean | null;
  officerTitle: string | null;
  otherText: string | null;
}

export type OwnershipForm = "direct" | "indirect" | "unknown";
export type Form4Table = "nonDerivative" | "derivative";
export type Form4RowKind = "transaction" | "holding";

/**
 * How a row should be treated by anything that aggregates.
 *
 * Deliberately descriptive. None of these values asserts sentiment, conviction,
 * or that a transaction was discretionary or open-market — the code alone does
 * not establish any of that.
 */
export type Form4Classification =
  | "reported_purchase"
  | "reported_sale"
  | "award"
  | "exercise_or_conversion"
  | "withholding_or_exercise_cost"
  | "disposition_to_issuer"
  | "expiration_or_cancellation"
  | "gift"
  | "inheritance"
  | "voting_trust"
  | "other_reported"
  | "holding"
  | "unknown_code";

/** A transaction or holding row, as reported. */
export interface Form4Row {
  /**
   * `{accession}::{documentSha256}::{table}::{rowKind}::{ordinal}` — tied to
   * the archived bytes it came from, so re-parsing the same document yields the
   * same id even when the interpretation changes.
   */
  id: string;
  filingId: string;
  accessionNumber: string;
  documentSha256: string;
  table: Form4Table;
  rowKind: Form4RowKind;
  /** Zero-based position within its table in the source XML. */
  sourceOrdinal: number;

  securityTitle: Nullable<string>;
  /** Derivative rows only. */
  underlyingSecurityTitle: Nullable<string>;
  underlyingShares: Nullable<DecimalString>;
  conversionOrExercisePrice: Nullable<DecimalString>;
  exerciseDate: Nullable<string>;
  expirationDate: Nullable<string>;

  transactionDate: Nullable<string>;
  deemedExecutionDate: Nullable<string>;

  transactionCodeRaw: string | null;
  acquiredDisposedRaw: string | null;
  equitySwapInvolved: boolean | null;
  /** `V` — voluntary/timeliness. A modifier, never a trade event of its own. */
  transactionTimeliness: string | null;

  shares: Nullable<DecimalString>;
  pricePerShare: Nullable<DecimalString>;
  sharesOwnedFollowingTransaction: Nullable<DecimalString>;

  ownership: OwnershipForm;
  natureOfOwnership: Nullable<string>;

  classification: Form4Classification;
  /** Machine-readable notes; never rendered as a conclusion. */
  warnings: string[];
  validation: "valid" | "warning" | "quarantined";
  parserVersion: number;
}

/** Timestamps, kept separate because they answer different questions. */
export interface Form4Timestamps {
  /** As reported by the regulator. */
  filedDate: Nullable<string>;
  /** Nullable, with provenance. Never derived from a cutoff rule. */
  acceptedAt: Nullable<string>;
  acceptedAtSource: string | null;
  /** Never fabricated. Null unless the source states it. */
  publiclyAvailableAt: Nullable<string>;
  /** Immutable UTC timestamp of our first fetch. */
  firstObservedAt: string;
  lastObservedAt: string;
  observationMode: "live" | "backfill";
}

export interface Form4Filing {
  /** `{accession}::{documentSha256}`. */
  id: string;
  source: "sec-form4";
  accessionNumber: string;
  documentType: Form4DocumentType;
  /** Version string as the document declares it, e.g. `X0609`. */
  sourceSchemaVersion: string | null;

  indexUrl: string;
  documentUrl: string;
  documentName: string;
  documentSha256: string;
  /** Path of the archived raw bytes, relative to the run's evidence directory. */
  rawArtifactPath: string | null;

  issuer: Issuer;
  reportingOwners: ReportingOwner[];

  periodOfReport: Nullable<string>;
  dateOfOriginalSubmission: Nullable<string>;
  timestamps: Form4Timestamps;

  /**
   * The filing-level 10b5-1 checkbox, raw and normalized.
   *
   * Filing level only. It is never copied onto individual rows: a filing may
   * carry the indication while only some rows were executed under the plan.
   */
  aff10b5OneRaw: string | null;
  aff10b5One: boolean | null;

  notSubjectToSection16: boolean | null;
  footnotes: Record<string, string>;
  remarks: string | null;

  rows: Form4Row[];

  /** Amendment linkage. Never assumed. */
  amendment: AmendmentLink | null;

  parserVersion: number;
  schemaVersion: number;
  importRunId: string;
  warnings: string[];
  validation: "valid" | "warning" | "quarantined";
}

/**
 * Link from a 4/A to the filing it amends.
 *
 * A 4/A has its own accession and its own immutable rows. Original submission
 * date, issuer, owners and period are candidate evidence, not identity, so the
 * default state is unresolved and supersession is a recorded decision rather
 * than an inference.
 */
export interface AmendmentLink {
  status: "unresolved" | "ambiguous" | "confirmed";
  originalAccession: string | null;
  method: string | null;
  evidence: string[];
  candidateAccessions: string[];
}

/** A document we recognised but do not support. Never parsed as a Form 4. */
export interface UnsupportedDocument {
  accessionNumber: string;
  documentUrl: string;
  documentSha256: string;
  declaredType: string | null;
  reason:
    | "not_an_ownership_document"
    | "unsupported_form_type"
    | "unsupported_schema_version"
    | "xml_refused";
  detail: string;
}
