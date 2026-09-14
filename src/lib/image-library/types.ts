/**
 * The shared image library: one catalog for company marks, ETF sponsor marks
 * and congressional portraits, keyed by durable identity rather than by the
 * label a page happens to show.
 *
 * Identity keys
 *   sec:cik:0001045810        an SEC issuer (companies)
 *   sec:class:C000017601      an SEC share class (ETFs — a ticker names a class)
 *   sponsor:<slug>            a fund sponsor with no SEC issuer of its own
 *   bioguide:P000197          a member of Congress
 *
 * Tickers, names and disclosure filer keys are *aliases* that point at an
 * identity. They are how a caller finds an entry, never what an entry is. Two
 * tickers can point at one issuer (GOOG, GOOGL); one ticker can point at two
 * identities across time (a retired symbol reassigned); a fund's mark can be
 * the sponsor's rather than its own. The shapes below keep those distinct.
 *
 * Nothing here implies clearance. Every asset carries the basis on which it
 * was accepted and what that basis does and does not establish, and the
 * lookup refuses to serve anything whose status is not `resolved`.
 */

export type EntryKind = "company" | "fund" | "sponsor" | "person";

export type AssetStatus =
  /** An approved file is on disk and may be displayed on the website. */
  | "resolved"
  /** No candidate file exists at any documented source. */
  | "missing"
  /** More than one candidate, or an identity that cannot be pinned to one file. */
  | "ambiguous"
  /** A fetch or validation failed; retry is possible. */
  | "failed"
  /** A candidate exists but its terms are not among those documented as acceptable. */
  | "awaiting_review";

export type AssetRole =
  /** The company's own mark. */
  | "company_mark"
  /** The mark of the fund's sponsor, shown beside a fund that has no own logo. */
  | "sponsor_mark"
  /** A mark unique to the fund itself. Not yet used by any documented source. */
  | "fund_logo"
  /** An official portrait. */
  | "portrait";

export type AliasType = "ticker" | "name" | "filer_key" | "person_name" | "wikidata" | "series" | "cik";

export interface Alias {
  type: AliasType;
  value: string;
  /** `retired` aliases are recognised but never preferred over a current one. */
  status?: "current" | "retired";
  /** Person aliases are scoped to a seat; a name alone never matches. */
  chamber?: string;
  state?: string;
  district?: string | null;
  source: string;
}

export interface AssetFile {
  /** Public path served by the site, e.g. /company-logos/msft.svg. */
  path: string;
  format: "svg" | "jpg" | "png";
  bytes: number;
  sha256: string;
  width?: number;
  height?: number;
}

export interface AssetSource {
  url: string;
  /** The page a reviewer reads to check the terms, e.g. a Commons file page. */
  evidenceUrl?: string;
  fetchedAt: string;
  /** The licence label as read from the source at fetch time. */
  license: string;
  /** Machine-read fields that justified acceptance (Commons extmetadata, etc.). */
  licenseEvidence?: Record<string, string>;
  /** `manual` entries were individually reviewed before this library existed. */
  reviewedBy: "manual" | "importer";
  reviewedOn: string;
}

export interface RightsNotes {
  /**
   * Website display is the only use this library is built for. `documented`
   * means the basis below was read from the source; it is not a warranty.
   */
  websiteDisplay: "documented" | "unknown";
  /**
   * Redistributing image files through an API is a separate right that no
   * documented source grants for these assets. Recorded per asset so the
   * answer cannot be inferred from the website answer.
   */
  apiRedistribution: "not_established";
  basis: string;
  /** e.g. "trademarked" as recorded by Commons. */
  restrictions?: string;
  attributionRequired?: boolean;
  /** For assets shipped under a licence with a notice, the notice file. */
  licenseNoticePath?: string;
}

export interface Asset {
  role: AssetRole;
  file: AssetFile;
  source: AssetSource;
  rights: RightsNotes;
  /** For `sponsor_mark`: the sponsor entry whose file this is. */
  sponsorIdentity?: string;
}

export interface IdentityEvidence {
  /** Where the identity itself was established (SEC master, EDGAR, legislators dataset). */
  source: string;
  checkedOn: string;
  /** Free-text specifics: CIK match, series/class ids, chamber/state/district. */
  detail: string;
}

export interface CatalogEntry {
  identity: string;
  kind: EntryKind;
  label: string;
  status: AssetStatus;
  aliases: Alias[];
  evidence: IdentityEvidence;
  /** Present when status is `resolved`; for funds it may point at a sponsor. */
  asset?: Asset;
  /** For funds without an own logo: which sponsor entry supplies the mark. */
  sponsorIdentity?: string;
  /** Why the status is what it is, written for the coverage report. */
  reason?: string;
  /** Candidate the importer found but did not accept, kept for review. */
  candidate?: { url: string; evidenceUrl?: string; license?: string; note: string };
  updatedAt: string;
}

export interface UniverseSummary {
  source: string;
  asOf: string;
  /** Distinct identities in the universe. */
  identities: number;
  /** For companies: tickers known for those identities; coverage is reported both ways. */
  tickers?: number;
  note?: string;
}

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  universes: Partial<Record<"companies" | "funds" | "congress", UniverseSummary>>;
  entries: CatalogEntry[];
}

/** What a page receives. Never a raw catalog entry. */
export type ImageResolution =
  | { status: "resolved"; src: string; role: AssetRole; identity: string; label: string; basis: string }
  | { status: "fallback"; reason: "missing" | "ambiguous" | "mismatch" | "unknown" | "not_resolved"; label: string };
