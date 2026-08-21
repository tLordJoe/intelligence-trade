#!/usr/bin/env node --experimental-strip-types
/**
 * One-time archive migration and reconciliation.
 *
 * The archive predating this rebuild used ids of the form `${docId}-${n}`,
 * where `n` counted accepted rows. The new importer uses `${docId}#${n}`, where
 * `n` is the ordinal of the symbol-bearing block within the filing. Those
 * numbers coincide only when no row was skipped, so ids cannot simply be
 * rewritten — the mapping is not reliable.
 *
 * Instead this rebuilds the archive from the authoritative source and then
 * proves the result is a superset: every filing (docId) represented in the
 * frozen 203-record dataset must still be represented afterwards. Any docId
 * that fails that check is reported and the migration exits non-zero.
 *
 * Run once, reviewed as part of the pipeline rebuild. Routine imports remain
 * strictly append-only.
 *
 * Usage:
 *   node --experimental-strip-types scripts/migrate-archive.ts [--apply]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import type {
  DisclosureArchive,
  DisclosureRecord,
} from "../src/lib/congress-schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARCHIVE_PATH = join(ROOT, "src", "lib", "congress-live.json");
const FROZEN_TAG = "data-known-good-203";

const APPLY = process.argv.includes("--apply");

/** Read the frozen known-good dataset straight out of git. */
function readFrozenBaseline(): { trades: Array<Record<string, unknown>> } {
  const raw = execFileSync(
    "git",
    ["show", `${FROZEN_TAG}:src/lib/congress-live.json`],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(raw);
}

function docIdOf(record: { id?: string; provenance?: { docId?: string } }): string {
  if (record.provenance?.docId) return record.provenance.docId;
  // Legacy ids: `${docId}-${n}` — the docId is everything before the last dash.
  const id = String(record.id ?? "");
  const cut = id.lastIndexOf("-");
  return cut > 0 ? id.slice(0, cut) : id;
}

function main() {
  if (!existsSync(ARCHIVE_PATH)) {
    console.error("No archive present — run the importer first.");
    process.exit(1);
  }

  const current: DisclosureArchive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
  const baseline = readFrozenBaseline();

  const currentRecords = (current.trades ?? []) as DisclosureRecord[];
  const migrated = currentRecords.filter((r) => r.idStrategy === "filing-row");
  const legacy = currentRecords.filter((r) => r.idStrategy !== "filing-row");

  const baselineDocIds = new Set(baseline.trades.map(docIdOf));
  const migratedDocIds = new Set(migrated.map(docIdOf));

  const missing = [...baselineDocIds].filter((d) => !migratedDocIds.has(d));

  console.log("=".repeat(64));
  console.log("ARCHIVE MIGRATION RECONCILIATION");
  console.log("=".repeat(64));
  console.log(`  frozen baseline (${FROZEN_TAG})`);
  console.log(`    records                    ${baseline.trades.length}`);
  console.log(`    distinct filings (docId)   ${baselineDocIds.size}`);
  console.log("");
  console.log("  current archive");
  console.log(`    records total              ${currentRecords.length}`);
  console.log(`    new-format (filing-row)    ${migrated.length}`);
  console.log(`    legacy-format remaining    ${legacy.length}`);
  console.log(`    distinct filings (docId)   ${migratedDocIds.size}`);
  console.log("");
  console.log("  coverage check");
  console.log(`    baseline filings covered   ${baselineDocIds.size - missing.length}/${baselineDocIds.size}`);
  console.log(`    filings NOT covered        ${missing.length}`);

  if (missing.length) {
    console.log("");
    console.log("  MISSING FILINGS (first 20):");
    for (const d of missing.slice(0, 20)) console.log(`    ${d}`);
  }

  console.log("=".repeat(64));

  if (missing.length) {
    console.error(
      "\nReconciliation FAILED — the rebuild does not cover every baseline filing."
    );
    console.error("Legacy records retained. Nothing was changed.");
    process.exit(1);
  }

  if (!legacy.length) {
    console.log("\nNothing to migrate: archive already contains no legacy records.");
    return;
  }

  if (!APPLY) {
    console.log(
      `\nDry run. ${legacy.length} legacy record(s) would be removed as superseded.`
    );
    console.log("Re-run with --apply to write the migrated archive.");
    return;
  }

  const archive: DisclosureArchive = {
    ...current,
    updatedAt: new Date().toISOString(),
    counts: { ...current.counts, archiveAfter: migrated.length },
    trades: migrated,
  };
  writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(
    `\nMigrated. ${legacy.length} superseded legacy record(s) removed; ${migrated.length} retained.`
  );
}

main();
