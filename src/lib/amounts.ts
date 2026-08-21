/**
 * Amount arithmetic and presentation.
 *
 * One rule, enforced in one place: a record with no disclosed amount carries
 * `null` bounds and is *excluded* from every aggregate, never counted as zero.
 *
 * The defect this exists to prevent: two records — Wasserman Schultz / ICHR and
 * Pelosi / VSNT — were stored as `amountLow: 0, amountHigh: 0` because the
 * parser recognised only ranges and both filings disclosed an exact figure.
 * Nothing in the pipeline distinguished "$0" from "not disclosed", so both
 * would have depressed every average they appeared in.
 *
 * Aggregates therefore return an explicit `excluded` count alongside the value.
 * A caller that renders a total without saying how many records it could not
 * include is hiding the same problem in a different place.
 */

import type { AmountStatus } from "./congress-schema.ts";

/** The minimum an amount-bearing record must expose to be aggregated. */
export interface AmountBearing {
  amountLow: number | null;
  amountHigh: number | null;
  amountStatus: AmountStatus;
}

/** Statuses that carry usable numeric bounds. */
const NUMERIC_STATUSES: ReadonlySet<AmountStatus> = new Set<AmountStatus>([
  "disclosed_range",
  "disclosed_exact",
]);

/**
 * Whether a record's amount can take part in arithmetic.
 *
 * Checks the bounds as well as the status: a record whose status claims a
 * number but whose bounds are null is not usable, and is treated as unknown
 * rather than trusted.
 */
export function hasAmount(record: AmountBearing): boolean {
  return (
    NUMERIC_STATUSES.has(record.amountStatus) &&
    typeof record.amountLow === "number" &&
    typeof record.amountHigh === "number" &&
    Number.isFinite(record.amountLow) &&
    Number.isFinite(record.amountHigh)
  );
}

/** Records usable in arithmetic, in input order. */
export function withAmount<T extends AmountBearing>(records: readonly T[]): T[] {
  return records.filter(hasAmount);
}

/** Records excluded from arithmetic because no amount is known. */
export function withoutAmount<T extends AmountBearing>(
  records: readonly T[]
): T[] {
  return records.filter((r) => !hasAmount(r));
}

/**
 * The midpoint of a disclosed range, used as the representative value.
 *
 * `null` for any record without an amount, so callers cannot accidentally
 * treat "unknown" as a number.
 */
export function midpoint(record: AmountBearing): number | null {
  if (!hasAmount(record)) return null;
  return (record.amountLow! + record.amountHigh!) / 2;
}

export interface Aggregate {
  /** `null` when no record in the input carried an amount. */
  value: number | null;
  /** Records that contributed. */
  included: number;
  /** Records skipped because no amount is known. */
  excluded: number;
}

function aggregate(
  records: readonly AmountBearing[],
  reduce: (values: number[]) => number
): Aggregate {
  const values: number[] = [];
  let excluded = 0;
  for (const record of records) {
    const mid = midpoint(record);
    if (mid === null) excluded += 1;
    else values.push(mid);
  }
  return {
    value: values.length ? reduce(values) : null,
    included: values.length,
    excluded,
  };
}

/** Sum of midpoints. Records without an amount are excluded, not zeroed. */
export function totalAmount(records: readonly AmountBearing[]): Aggregate {
  return aggregate(records, (v) => v.reduce((a, b) => a + b, 0));
}

/** Mean of midpoints over records that actually have one. */
export function averageAmount(records: readonly AmountBearing[]): Aggregate {
  return aggregate(records, (v) => v.reduce((a, b) => a + b, 0) / v.length);
}

/** Sum of lower bounds — the defensible floor of disclosed activity. */
export function totalLowerBound(records: readonly AmountBearing[]): Aggregate {
  const usable = withAmount(records);
  return {
    value: usable.length
      ? usable.reduce((sum, r) => sum + (r.amountLow as number), 0)
      : null,
    included: usable.length,
    excluded: records.length - usable.length,
  };
}

/**
 * Sort by amount, descending by default.
 *
 * Records without an amount always sort last regardless of direction: they are
 * not "small", they are unknown, and ranking them as zero would misrepresent
 * them at whichever end of the list zero happens to fall.
 */
export function sortByAmount<T extends AmountBearing>(
  records: readonly T[],
  direction: "asc" | "desc" = "desc"
): T[] {
  const sign = direction === "desc" ? -1 : 1;
  return [...records].sort((a, b) => {
    const av = midpoint(a);
    const bv = midpoint(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return sign * (av - bv);
  });
}

/**
 * Filter to records whose amount falls within a bound.
 *
 * Records without an amount never match, in either direction. They are not
 * silently included and not silently treated as zero.
 */
export function filterByAmount<T extends AmountBearing>(
  records: readonly T[],
  opts: { min?: number; max?: number }
): T[] {
  return records.filter((r) => {
    const mid = midpoint(r);
    if (mid === null) return false;
    if (opts.min !== undefined && mid < opts.min) return false;
    if (opts.max !== undefined && mid > opts.max) return false;
    return true;
  });
}

/** Labels shown to readers when no numeric amount exists. */
const STATUS_LABELS: Record<AmountStatus, string> = {
  disclosed_range: "",
  disclosed_exact: "",
  not_disclosed: "Not disclosed",
  not_applicable: "Not applicable",
  parse_failed: "Amount unreadable",
};

/**
 * What to print for a record's amount.
 *
 * Returns the disclosed text when there is one, and an honest label otherwise.
 * Never returns an empty string, so a missing amount cannot render as a blank
 * cell that reads as zero.
 */
export function formatAmount(
  record: AmountBearing & { amount: string }
): string {
  if (hasAmount(record) && record.amount) return record.amount;
  return STATUS_LABELS[record.amountStatus] || "Not disclosed";
}

/**
 * A short explanation of why a record has no amount, for tooltips and
 * methodology copy.
 */
export function amountExplanation(status: AmountStatus): string | null {
  switch (status) {
    case "not_disclosed":
      return "The filing discloses no amount for this transaction.";
    case "not_applicable":
      return "The filing marks an amount as not applicable for this transaction.";
    case "parse_failed":
      return "An amount appears in the filing but could not be read reliably. It is excluded from all totals.";
    default:
      return null;
  }
}
