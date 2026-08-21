/**
 * Append-only merge.
 *
 * The August 2026 incident had a single root cause: the importer read a rolling
 * window of the 40 most recent filings and wrote it over the archive. Anything
 * outside that window disappeared. The archive fell from 225 records to 182
 * while every run reported success.
 *
 * The fix is structural rather than procedural. Merging can add records and
 * refresh `lastSeen` on ones it sees again. It has no path that removes a
 * record, so a short source window can no longer erase history.
 */

import type { DisclosureRecord, ImportCounts } from "./congress-schema.ts";

export interface MergeResult {
  records: DisclosureRecord[];
  added: number;
  refreshed: number;
  duplicates: number;
  /** Ids present in the archive but absent from this run's source window. */
  unseenIds: string[];
}

/**
 * Merge freshly parsed records into the existing archive.
 *
 * Existing records win on identity: if a record is seen again we keep the
 * original `firstSeen` and the raw values captured at that time, refreshing
 * only `lastSeen`. Re-parsing a filing therefore cannot rewrite history.
 */
export function mergeRecords(
  existing: DisclosureRecord[],
  incoming: DisclosureRecord[],
  runTimestamp: string
): MergeResult {
  const byId = new Map<string, DisclosureRecord>();
  for (const record of existing) {
    if (record?.id) byId.set(record.id, record);
  }

  const seenThisRun = new Set<string>();
  let added = 0;
  let refreshed = 0;
  let duplicates = 0;

  for (const record of incoming) {
    if (!record?.id) continue;

    // Two rows in one run resolving to the same id means the parser produced a
    // collision — count it and keep the first.
    if (seenThisRun.has(record.id)) {
      duplicates += 1;
      continue;
    }
    seenThisRun.add(record.id);

    const prior = byId.get(record.id);
    if (prior) {
      byId.set(record.id, {
        ...prior,
        provenance: { ...prior.provenance, lastSeen: runTimestamp },
      });
      refreshed += 1;
    } else {
      byId.set(record.id, record);
      added += 1;
    }
  }

  const unseenIds = [...byId.keys()].filter((id) => !seenThisRun.has(id));

  // Newest transaction first, with id as a stable tiebreaker so the committed
  // file does not churn between runs.
  const records = [...byId.values()].sort((a, b) => {
    const delta =
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
    if (delta !== 0 && !Number.isNaN(delta)) return delta;
    return a.id.localeCompare(b.id);
  });

  return { records, added, refreshed, duplicates, unseenIds };
}

/** Tally the per-field quality counters that feed the run gates and report. */
export function tallyCounts(
  records: DisclosureRecord[],
  base: ImportCounts
): ImportCounts {
  const counts = { ...base };
  counts.missingParty = records.filter(
    (r) => r.party !== "D" && r.party !== "R"
  ).length;
  counts.missingTicker = records.filter((r) => !r.ticker?.trim()).length;
  counts.missingFilingUrl = records.filter((r) => !r.source?.trim()).length;
  return counts;
}
