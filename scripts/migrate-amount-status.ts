#!/usr/bin/env node --experimental-strip-types
/**
 * One-time migration of the published archive to schema version 2.
 *
 * Version 2 makes `amountLow`/`amountHigh` nullable and adds `amountStatus`, so
 * a record with no disclosed amount is no longer stored as `$0`.
 *
 * What this does:
 *
 *   - derives `amountStatus` for every record from the amount text it already
 *     holds, and
 *   - rewrites the two records stored as `amountLow: 0, amountHigh: 0` so their
 *     bounds are `null`.
 *
 * What this deliberately does *not* do: invent the amounts those two records
 * are missing. Both are known parser failures with a real figure in the source
 * (filings 20034999 and 20033725), and the fixed parser reads them. Correcting
 * them here by hand would put a number in the archive that no run produced. The
 * next supervised import derives them from the filings and records the change
 * as a revision, which is the auditable path.
 *
 * Idempotent: running it twice is a no-op.
 *
 * Usage:
 *   node --experimental-strip-types scripts/migrate-amount-status.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_VERSION,
  type AmountStatus,
  type DisclosureArchive,
  type DisclosureRecord,
} from "../src/lib/congress-schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHIVE_PATH = join(__dirname, "..", "src", "lib", "congress-live.json");

const DRY_RUN = process.argv.includes("--dry-run");

const RANGE_RE = /^\$([\d,]+(?:\.\d{2})?)\s*-\s*\$([\d,]+(?:\.\d{2})?)$/;
const EXACT_RE = /^\$([\d,]+(?:\.\d{2})?)$/;

const money = (raw: string): number => Number(raw.replace(/,/g, ""));

interface Migrated {
  record: DisclosureRecord;
  changed: boolean;
}

/**
 * Derive the amount fields for one stored record.
 *
 * Reads the disclosed text rather than the stored numbers, because the stored
 * numbers are exactly what cannot be trusted: `0`/`0` meant "no amount" and
 * "zero dollars" indistinguishably.
 */
function migrate(record: DisclosureRecord): Migrated {
  const text = String(record.amount ?? "").trim();

  let status: AmountStatus;
  let low: number | null;
  let high: number | null;

  const range = text.match(RANGE_RE);
  const exact = text.match(EXACT_RE);

  if (range) {
    status = "disclosed_range";
    low = money(range[1]);
    high = money(range[2]);
  } else if (exact) {
    status = "disclosed_exact";
    low = money(exact[1]);
    high = low;
  } else {
    // No readable amount text. These are the records the fixed parser now reads
    // an exact figure for, so the honest status is "we failed to read it",
    // not "the filer disclosed none".
    status = "parse_failed";
    low = null;
    high = null;
  }

  const changed =
    record.amountStatus !== status ||
    record.amountLow !== low ||
    record.amountHigh !== high;

  return { record: { ...record, amountLow: low, amountHigh: high, amountStatus: status }, changed };
}

function main(): void {
  const archive: DisclosureArchive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
  const records = (archive.trades ?? []) as DisclosureRecord[];

  const migrated = records.map(migrate);
  const changedCount = migrated.filter((m) => m.changed).length;

  const byStatus = new Map<AmountStatus, number>();
  for (const { record } of migrated) {
    byStatus.set(record.amountStatus, (byStatus.get(record.amountStatus) ?? 0) + 1);
  }

  console.log(`records            ${records.length}`);
  console.log(`records changed    ${changedCount}`);
  console.log(`schemaVersion      ${archive.schemaVersion} -> ${SCHEMA_VERSION}`);
  for (const [status, n] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(18)} ${n}`);
  }

  const nulled = migrated.filter((m) => m.record.amountLow === null);
  if (nulled.length) {
    console.log(`\nbounds set to null (were 0/0):`);
    for (const { record } of nulled) {
      console.log(
        `  ${record.politician} | ${record.ticker} | ${record.type} | ${record.transactionDate}`
      );
      console.log(`    ${record.source}`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const next: DisclosureArchive = {
    ...archive,
    schemaVersion: SCHEMA_VERSION,
    trades: migrated.map((m) => m.record),
  };
  writeFileSync(ARCHIVE_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nWrote ${ARCHIVE_PATH}`);
}

main();
