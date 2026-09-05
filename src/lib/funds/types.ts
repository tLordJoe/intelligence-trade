/**
 * Domain types for fund comparison.
 *
 * Written so that connecting a licensed data provider later is a matter of
 * adding an adapter, not rewriting the interface. Nothing here names a vendor:
 * a source identifies itself through `SourceProvenance`, and components consume
 * the domain shapes rather than any provider's payload.
 *
 * Two rules run through the whole file.
 *
 * **Unavailable is not zero.** Every value a source may not supply is an
 * `Availability<T>` carrying a reason, so a missing expense ratio can never be
 * rendered as 0.00% and a missing weight can never be counted as absent
 * exposure.
 *
 * **Partial holdings stay partial.** A snapshot that covers 62% of a portfolio
 * describes 62% of a portfolio. `HoldingsSnapshot` keeps known, unmapped and
 * unavailable weight as separate quantities that sum to 100 — normalising the
 * known slice up to 100 would turn "we can see two thirds of this fund" into
 * "this is the whole fund", which is the single most misleading thing this
 * model could do.
 */

// --- availability ------------------------------------------------------------

export type UnavailableReason =
  | "source_not_connected"
  | "not_published_by_issuer"
  | "outside_snapshot_coverage"
  | "licensing_restricted"
  | "stale_beyond_threshold"
  | "parse_failed";

export type Availability<T> =
  | { status: "available"; value: T; asOf: string; sourceId: string }
  | { status: "unavailable"; reason: UnavailableReason; detail?: string };

export const unavailable = <T,>(
  reason: UnavailableReason,
  detail?: string
): Availability<T> => ({ status: "unavailable", reason, detail });

export const available = <T,>(
  value: T,
  asOf: string,
  sourceId: string
): Availability<T> => ({ status: "available", value, asOf, sourceId });

export function isAvailable<T>(
  value: Availability<T>
): value is { status: "available"; value: T; asOf: string; sourceId: string } {
  return value.status === "available";
}

/** Human text for an absence. Never returns an empty string or a number. */
export function describeUnavailable(reason: UnavailableReason): string {
  switch (reason) {
    case "source_not_connected": return "Unavailable — data source not connected yet";
    case "not_published_by_issuer": return "Unavailable — not published by the issuer";
    case "outside_snapshot_coverage": return "Unavailable — outside the coverage of this snapshot";
    case "licensing_restricted": return "Unavailable — licensing does not permit display";
    case "stale_beyond_threshold": return "Unavailable — the latest snapshot is too old to show";
    case "parse_failed": return "Unavailable — the source value could not be read";
  }
}

// --- provenance --------------------------------------------------------------

export interface SourceProvenance {
  /** Stable identifier for the source, e.g. `yahoo-chart-unofficial`. */
  sourceId: string;
  sourceName: string;
  /** Whether the data is used under a licence permitting this display. */
  licensed: boolean;
  /** When this particular data was captured. */
  capturedAt: string;
  /** How it was obtained, so a reader can audit the path. */
  capturedBy?: string;
  note?: string;
}

/** How completely a dataset covers what it claims to describe. */
export interface Coverage {
  /** Earliest and latest observation actually present. */
  firstDate: string | null;
  lastDate: string | null;
  observations: number;
  /** Gaps a caller should know about, e.g. a suspended listing. */
  gaps?: Array<{ from: string; to: string; reason: string }>;
}

// --- return methodology ------------------------------------------------------

/**
 * What a return series does and does not account for.
 *
 * Carried alongside every series so a page cannot describe a price series as
 * total return by accident.
 */
export interface ReturnMethodology {
  basis: "price_return" | "total_return";
  /** True when prior prices are restated across share splits. */
  splitAdjusted: boolean;
  /** True when distributions are reflected in the series. */
  dividendAdjusted: boolean;
  /** What the basis leaves out, for display next to any figure derived from it. */
  excludes: string[];
  /** Evidence for the adjustment claims, so they are checkable rather than asserted. */
  splitAdjustmentEvidence?: string;
  dividendAdjustmentEvidence?: string;
}

// --- fund identity -----------------------------------------------------------

export interface FundIdentity {
  /** Exchange ticker, used as the stable key across the app and in URLs. */
  symbol: string;
  name: string;
  /** The firm that issues the fund, not the index provider. */
  issuer: string;
  /** Short, neutral description of what the fund holds. Not a rating. */
  exposure: string;
  /** Editorial grouping for the comparison UI. Not an industry classification. */
  category: "Broad market" | "Growth" | "Sector" | "Industry" | "Utilities";
  /** Present only when a source supplies it. Never inferred from the ticker. */
  isin?: Availability<string>;
}

// --- price history -----------------------------------------------------------

/**
 * A daily close series.
 *
 * Dates and closes are parallel arrays in ascending date order, which keeps the
 * committed dataset compact and the lookups direct.
 */
export interface PriceSeries {
  symbol: string;
  dates: string[];
  closes: number[];
  methodology: ReturnMethodology;
  provenance: SourceProvenance;
  coverage: Coverage;
}

// --- expenses ----------------------------------------------------------------

export interface ExpenseData {
  symbol: string;
  /** Annual expense ratio as a percentage, e.g. 0.03 for three basis points. */
  expenseRatioPercent: Availability<number>;
  provenance?: SourceProvenance;
}

// --- holdings ----------------------------------------------------------------

export interface Holding {
  /** Ticker when the position is a listed equity we could map. */
  symbol: string | null;
  name: string;
  /** Percentage of the fund's portfolio. Never rescaled. */
  weightPercent: number;
}

/**
 * A holdings snapshot as at one date.
 *
 * The three weight buckets are the point of this type. They are recorded
 * separately and always sum to 100:
 *
 *   knownWeightPercent      positions we have, with weights
 *   unmappedWeightPercent   positions the source gave but we could not map
 *   unavailableWeightPercent  portfolio the source did not disclose to us
 *
 * A caller computing concentration or overlap must decide explicitly what to do
 * with the last two rather than having them silently folded into the first.
 */
export interface HoldingsSnapshot {
  symbol: string;
  asOf: string;
  holdings: Holding[];
  knownWeightPercent: number;
  unmappedWeightPercent: number;
  unavailableWeightPercent: number;
  /** True only when the source supplied the entire portfolio. */
  complete: boolean;
  provenance: SourceProvenance;
}

/** Holdings for one fund across however many snapshot dates exist. */
export interface HoldingsHistory {
  symbol: string;
  snapshots: HoldingsSnapshot[];
  latest: Availability<HoldingsSnapshot>;
}

/** Guard against the normalisation this model exists to prevent. */
export function holdingsWeightsAreConsistent(snapshot: HoldingsSnapshot): boolean {
  const total =
    snapshot.knownWeightPercent +
    snapshot.unmappedWeightPercent +
    snapshot.unavailableWeightPercent;
  return Math.abs(total - 100) < 0.01;
}

// --- disclosure overlays -----------------------------------------------------

/**
 * Disclosed activity touching a fund's holdings.
 *
 * Defined now, unpopulated in this stage. The lanes stay separate: House
 * disclosures, Form 4 insider activity and institutional holdings arrive on
 * different clocks and mean different things, and a combined count would imply
 * they are comparable.
 */
export type DisclosureLane = "house" | "insider" | "institutional";

export interface DisclosureOverlay {
  symbol: string;
  lane: DisclosureLane;
  /** Records touching this fund's holdings, by lane. Never summed across lanes. */
  matches: Availability<number>;
  asOfLane: Availability<string>;
  provenance?: SourceProvenance;
}

// --- the assembled view ------------------------------------------------------

/** Everything the comparison page knows about one fund. */
export interface FundRecord {
  identity: FundIdentity;
  prices: PriceSeries;
  expenses: ExpenseData;
  holdings: Availability<HoldingsHistory>;
  overlays: DisclosureOverlay[];
}
