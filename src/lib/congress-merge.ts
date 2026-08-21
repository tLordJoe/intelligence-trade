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
import { hasAmount } from "./amounts.ts";

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
  "amountStatus",
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
 * The economic core of a transaction with the amount deliberately omitted.
 *
 * Used only to reconcile a record whose amount was previously unreadable. The
 * document id keeps the key scoped to one filing, so this can never fuse rows
 * from different filings.
 */
function amountlessCore(record: DisclosureRecord): string {
  const norm = (v: unknown) => String(v ?? "").toUpperCase().trim();
  return [
    record.provenance?.docId ?? "",
    norm(record.ticker),
    norm(record.type),
    norm(record.transactionDate),
    norm(record.raw?.ownerText),
    String(record.provenance?.occurrence ?? 0),
  ].join("|");
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
  // Secondary index on the transaction's economic core, so a row whose issuer
  // name or ticker was corrected still resolves to the record it revises rather
  // than arriving as a duplicate.
  const byReconciliationKey = new Map<string, DisclosureRecord>();
  // Tertiary index for records stored without a readable amount.
  //
  // The reconciliation key includes the amount, because two rows of the same
  // stock on the same day differing only in amount are two transactions. That
  // is right for the general case and wrong for exactly one: a record whose
  // amount was never readable, later re-parsed with the amount recovered. Its
  // key necessarily changes, so it would arrive as a new record and the
  // amountless original would linger beside it as a duplicate.
  //
  // Keyed on the economic core minus the amount, and populated *only* from
  // records that have no amount, so a record with a known amount can never be
  // reconciled onto by a row carrying a different one.
  const byAmountlessCore = new Map<string, DisclosureRecord>();
  for (const record of existing) {
    if (!record?.id) continue;
    byId.set(record.id, record);
    const key = record.provenance?.reconciliationKey;
    if (key && !byReconciliationKey.has(key)) byReconciliationKey.set(key, record);
    if (!hasAmount(record)) {
      const core = amountlessCore(record);
      if (!byAmountlessCore.has(core)) byAmountlessCore.set(core, record);
    }
  }

  const seenThisRun = new Set<string>();
  let added = 0;
  let refreshed = 0;
  let revised = 0;
  let duplicates = 0;

  // Matching runs in two passes, and the order is load-bearing.
  //
  // The reconciliation key ends in an occurrence counted across rows that share
  // an economic core, and the core excludes the ticker. In one real filing five
  // different securities shared a core — same type, amount, date and owner — so
  // recovering a previously dropped row shifted every later occurrence by one.
  // A single-pass merge then handed the recovered row the *next* record's key:
  // IDEXX's values were written onto PTC's record, and the genuine PTC row was
  // discarded as a duplicate.
  //
  // Exact identity is never ambiguous, so every id match is resolved first and
  // its record marked claimed. Only then may the positional fallbacks run, and
  // only against records nothing has claimed.
  const pairs = new Map<DisclosureRecord, DisclosureRecord | undefined>();
  const claimed = new Set<string>();
  const unmatched: DisclosureRecord[] = [];

  // Pass 1 — exact identity.
  for (const record of incoming) {
    if (!record?.id) continue;
    if (seenThisRun.has(record.id)) {
      duplicates += 1;
      continue;
    }
    const priorById = byId.get(record.id);
    if (priorById) {
      seenThisRun.add(priorById.id);
      claimed.add(priorById.id);
      pairs.set(record, priorById);
    } else {
      unmatched.push(record);
    }
  }

  // Pass 2 — fallbacks, over what pass 1 left.
  for (const record of unmatched) {
    const reconciliationKey = record.provenance?.reconciliationKey;
    const byKey = reconciliationKey
      ? byReconciliationKey.get(reconciliationKey)
      : undefined;
    const priorByKey = byKey && !claimed.has(byKey.id) ? byKey : undefined;

    // Last resort: an amount recovered for a record that previously had none.
    const byCore = !priorByKey && hasAmount(record)
      ? byAmountlessCore.get(amountlessCore(record))
      : undefined;
    const priorByRecoveredAmount =
      byCore && !claimed.has(byCore.id) ? byCore : undefined;

    const prior = priorByKey ?? priorByRecoveredAmount;
    if (prior) {
      seenThisRun.add(prior.id);
      claimed.add(prior.id);
    } else {
      // Two rows in one run resolving to the same id means the parser produced
      // a collision — count it and keep the first.
      if (seenThisRun.has(record.id)) {
        duplicates += 1;
        continue;
      }
      seenThisRun.add(record.id);
    }
    pairs.set(record, prior);
  }

  for (const [record, prior] of pairs) {
    const reconciliationKey = record.provenance?.reconciliationKey;

    if (!prior) {
      byId.set(record.id, record);
      if (reconciliationKey) byReconciliationKey.set(reconciliationKey, record);
      added += 1;
      continue;
    }

    const changes = diffRecords(prior, record);
    // A record reached through the reconciliation key keeps the id it was
    // stored under; only its interpretation is updated.
    const merged: DisclosureRecord = {
      ...prior,
      // Interpretation may be corrected...
      ...Object.fromEntries(changes.map((c) => [c.field, record[c.field as keyof DisclosureRecord]])),
      warnings: record.warnings ?? prior.warnings,
      // ...but the source record and its history are immutable.
      raw: prior.raw,
      provenance: {
        ...prior.provenance,
        // Content hash follows the corrected interpretation so the audit trail
        // reflects what the parser now reads; identity itself does not move.
        contentHash: record.provenance?.contentHash ?? prior.provenance.contentHash,
        lastSeen: runTimestamp,
      },
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

    byId.set(merged.id, merged);
    const mergedKey = merged.provenance?.reconciliationKey;
    if (mergedKey) byReconciliationKey.set(mergedKey, merged);
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
