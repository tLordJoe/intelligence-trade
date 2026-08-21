/**
 * Append-only merge with recorded revisions.
 *
 * The August 2026 incident had a single root cause: the importer read a rolling
 * window of the 40 most recent filings and wrote it over the archive. Anything
 * outside that window disappeared. The archive fell from 225 records to 182
 * while every run reported success.
 *
 * The fix is structural rather than procedural. Merging can add records and
 * update ones it sees again. It has no path that removes a record, so a short
 * source window can no longer erase history.
 *
 * Seeing a record again is not a no-op, though. A parser improvement changes
 * how a row is *interpreted* — a name parsed more completely, a ticker resolved
 * differently, a warning cleared. Those corrections must reach readers, so
 * normalized values are updated and the change is written to a revision log.
 * Raw source values and `firstSeen` are never touched.
 */

import type {
  DisclosureRecord,
  FieldChange,
  ImportCounts,
} from "./congress-schema.ts";

export interface MergeResult {
  records: DisclosureRecord[];
  added: number;
  refreshed: number;
  revised: number;
  duplicates: number;
  /** Ids present in the archive but absent from this run's source window. */
  unseenIds: string[];
}

/**
 * Normalized fields that a re-parse is allowed to correct.
 *
 * Deliberately excludes `raw`, `provenance`, and identity. Those are the record
 * of what the source said and when we first saw it; only interpretation is
 * revisable.
 */
const REVISABLE_FIELDS = [
  "politician",
  "party",
  "ticker",
  "companyName",
  "type",
  "amount",
  "amountLow",
  "amountHigh",
  "transactionDate",
  "filedDate",
  "isOptions",
  "status",
  "tickerResolution",
  "cik",
] as const;

function asComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

/** Fields whose interpretation changed between the stored and re-parsed record. */
export function diffRecords(
  prior: DisclosureRecord,
  next: DisclosureRecord
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of REVISABLE_FIELDS) {
    const from = asComparable(prior[field]);
    const to = asComparable(next[field]);
    if (from !== to) changes.push({ field, from, to });
  }

  // Warnings are compared as a set so ordering churn is not a revision.
  const priorWarnings = [...(prior.warnings ?? [])].sort().join(",");
  const nextWarnings = [...(next.warnings ?? [])].sort().join(",");
  if (priorWarnings !== nextWarnings) {
    changes.push({ field: "warnings", from: priorWarnings, to: nextWarnings });
  }

  return changes;
}

/**
 * Merge freshly parsed records into the existing archive.
 *
 * Records are matched on identity. An existing record keeps its `firstSeen`,
 * its raw values, and its provenance; its normalized fields are updated only
 * when the re-parse actually disagrees, and every such change is logged.
 */
export function mergeRecords(
  existing: DisclosureRecord[],
  incoming: DisclosureRecord[],
  runTimestamp: string,
  importRunId = "unknown"
): MergeResult {
  const byId = new Map<string, DisclosureRecord>();
  for (const record of existing) {
    if (record?.id) byId.set(record.id, record);
  }

  const seenThisRun = new Set<string>();
  let added = 0;
  let refreshed = 0;
  let revised = 0;
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
    if (!prior) {
      byId.set(record.id, record);
      added += 1;
      continue;
    }

    const changes = diffRecords(prior, record);
    const merged: DisclosureRecord = {
      ...prior,
      // Interpretation may be corrected...
      ...Object.fromEntries(changes.map((c) => [c.field, record[c.field as keyof DisclosureRecord]])),
      warnings: record.warnings ?? prior.warnings,
      // ...but the source record and its history are immutable.
      raw: prior.raw,
      provenance: { ...prior.provenance, lastSeen: runTimestamp },
    };

    if (changes.length) {
      merged.revisions = [
        ...(prior.revisions ?? []),
        { at: runTimestamp, importRunId, changes },
      ];
      revised += 1;
    } else {
      refreshed += 1;
    }

    byId.set(record.id, merged);
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

  return { records, added, refreshed, revised, duplicates, unseenIds };
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
