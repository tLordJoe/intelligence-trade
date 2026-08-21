/**
 * Party bucketing for disclosure summaries.
 *
 * 148 of 945 archived records have no resolvable party. Party comes from a
 * lookup of known House members and is never inferred, so "unknown" is a real
 * and common state rather than an edge case.
 *
 * The rule this module exists to enforce: an unknown party is never counted as
 * Democratic or Republican. Any summary that reports partisan figures must also
 * report how many records it could not attribute, so a reader can tell the
 * difference between "Republicans traded less" and "we could not identify these
 * filers".
 *
 * Outfox does not invest red or blue. It should not silently colour data
 * either.
 */

export type PartyValue = "D" | "R" | null | undefined | string;

export interface PartyBreakdown {
  democrat: number;
  republican: number;
  unknown: number;
  /** democrat + republican + unknown */
  total: number;
  /** True when any record could not be attributed. */
  hasUnknown: boolean;
  /** Share of records that could be attributed, 0-1. */
  attributedShare: number;
}

/**
 * Normalize any stored or serialized party value to a strict bucket.
 *
 * The API historically substitutes "?" for null, so both forms — plus empty
 * strings and unexpected values — resolve to unknown rather than defaulting
 * into a party.
 */
export function normalizeParty(party: PartyValue): "D" | "R" | "unknown" {
  if (party === "D") return "D";
  if (party === "R") return "R";
  return "unknown";
}

/** Count records into D / R / unknown without ever inferring a party. */
export function partyBreakdown(
  records: Array<{ party?: PartyValue }>
): PartyBreakdown {
  let democrat = 0;
  let republican = 0;
  let unknown = 0;

  for (const record of records) {
    const bucket = normalizeParty(record?.party);
    if (bucket === "D") democrat += 1;
    else if (bucket === "R") republican += 1;
    else unknown += 1;
  }

  const total = democrat + republican + unknown;
  return {
    democrat,
    republican,
    unknown,
    total,
    hasUnknown: unknown > 0,
    attributedShare: total ? (democrat + republican) / total : 0,
  };
}

/**
 * Filter by party bucket.
 *
 * Selecting "D" or "R" must never return unattributed records, and "unknown"
 * has to be reachable — otherwise those filings are invisible rather than
 * merely uncounted.
 */
export function filterByParty<T extends { party?: PartyValue }>(
  records: T[],
  filter: "all" | "D" | "R" | "unknown"
): T[] {
  if (filter === "all") return records;
  return records.filter((r) => normalizeParty(r?.party) === filter);
}

/**
 * Sentence disclosing what a partisan summary leaves out.
 *
 * Returns null when everything is attributed, so callers can omit the note
 * entirely rather than printing "0 unknown".
 */
export function unknownPartyDisclosure(
  breakdown: PartyBreakdown
): string | null {
  if (!breakdown.hasUnknown) return null;
  const pct = Math.round((breakdown.unknown / breakdown.total) * 100);
  return `${breakdown.unknown} of ${breakdown.total} filings (${pct}%) are from members whose party Outfox has not verified. They are excluded from party figures, not assigned to one.`;
}
