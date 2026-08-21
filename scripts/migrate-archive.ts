#!/usr/bin/env node --experimental-strip-types
/**
 * One-time archive migration with record-level reconciliation.
 *
 * The pre-rebuild archive used positional ids (`{docId}-{n}`, later
 * `{docId}#{n}`). The rebuild uses content-addressed ids. Those cannot be
 * mapped onto each other arithmetically, because the old index counted accepted
 * rows while the new one hashes row content — so the archive is rebuilt from the
 * authoritative source and the old records are retired.
 *
 * Retiring records is exactly the operation that caused the August incident, so
 * it is not done on trust. Every legacy record must be shown to have a
 * counterpart in the rebuild before any of them are dropped:
 *
 *   Tier 1  same filing, ticker, direction, date and amount   — identical
 *   Tier 2  same filing, direction, date and amount           — ticker corrected
 *   Tier 3  no counterpart                                    — MIGRATION ABORTS
 *
 * Tier 2 exists because correcting tickers is one of the defects this rebuild
 * fixes: the Berkshire holding stored as CARR is the same disclosure, now
 * carrying BRK.B.
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
import { docIdFromRecordId } from "../src/lib/congress-identity.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARCHIVE_PATH = join(ROOT, "src", "lib", "congress-live.json");
const REPORT_PATH = join(ROOT, "data", "migration-reconciliation.txt");
const FROZEN_TAG = "data-known-good-203";

const APPLY = process.argv.includes("--apply");

interface LegacyRecord {
  id?: string;
  ticker?: string;
  type?: string;
  transactionDate?: string;
  amount?: string;
  politician?: string;
}

function readFrozenBaseline(): { trades: LegacyRecord[] } {
  const raw = execFileSync(
    "git",
    ["show", `${FROZEN_TAG}:src/lib/congress-live.json`],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(raw);
}

const norm = (v: unknown) => String(v ?? "").toUpperCase().replace(/\s+/g, " ").trim();

/** Same filing, ticker, direction, date and amount. */
function exactKey(r: { ticker?: string; type?: string; transactionDate?: string; amount?: string }, docId: string) {
  return [docId, norm(r.ticker), norm(r.type), norm(r.transactionDate), norm(r.amount)].join("|");
}

/** Same filing, direction, date and amount — ticker allowed to differ. */
function tickerAgnosticKey(r: { type?: string; transactionDate?: string; amount?: string }, docId: string) {
  return [docId, norm(r.type), norm(r.transactionDate), norm(r.amount)].join("|");
}

function main() {
  if (!existsSync(ARCHIVE_PATH)) {
    console.error("No archive present — run the importer first.");
    process.exit(1);
  }

  const current: DisclosureArchive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
  const baseline = readFrozenBaseline();

  const all = (current.trades ?? []) as DisclosureRecord[];
  const rebuilt = all.filter((r) => r.idStrategy === "content-row");
  const legacy = all.filter((r) => r.idStrategy !== "content-row");

  // Index the rebuild for lookup.
  const exactIndex = new Map<string, DisclosureRecord[]>();
  const looseIndex = new Map<string, DisclosureRecord[]>();
  for (const r of rebuilt) {
    const docId = r.provenance?.docId ?? docIdFromRecordId(r.id);
    for (const [index, key] of [
      [exactIndex, exactKey(r, docId)],
      [looseIndex, tickerAgnosticKey(r, docId)],
    ] as const) {
      const list = index.get(key) ?? [];
      list.push(r);
      index.set(key, list);
    }
  }

  let tier1 = 0;
  let tier2 = 0;
  const unmatched: LegacyRecord[] = [];
  const tickerCorrections: Array<{ docId: string; from: string; to: string }> = [];

  for (const legacyRecord of baseline.trades) {
    const docId = docIdFromRecordId(String(legacyRecord.id ?? ""));

    if (exactIndex.has(exactKey(legacyRecord, docId))) {
      tier1 += 1;
      continue;
    }
    const loose = looseIndex.get(tickerAgnosticKey(legacyRecord, docId));
    if (loose?.length) {
      tier2 += 1;
      const replacement = loose[0];
      if (norm(replacement.ticker) !== norm(legacyRecord.ticker)) {
        tickerCorrections.push({
          docId,
          from: String(legacyRecord.ticker),
          to: String(replacement.ticker),
        });
      }
      continue;
    }
    unmatched.push(legacyRecord);
  }

  const out: string[] = [];
  out.push("=".repeat(66));
  out.push("ARCHIVE MIGRATION — RECORD-LEVEL RECONCILIATION");
  out.push("=".repeat(66));
  out.push(`  frozen baseline (${FROZEN_TAG})`);
  out.push(`    records                          ${baseline.trades.length}`);
  out.push("");
  out.push("  current archive before migration");
  out.push(`    total                            ${all.length}`);
  out.push(`    rebuilt (content-addressed)      ${rebuilt.length}`);
  out.push(`    legacy (positional ids)          ${legacy.length}`);
  out.push("");
  out.push("  legacy record reconciliation");
  out.push(`    tier 1 — identical counterpart   ${tier1}`);
  out.push(`    tier 2 — ticker corrected        ${tier2}`);
  out.push(`    tier 3 — NO counterpart          ${unmatched.length}`);
  out.push(
    `    accounted for                    ${tier1 + tier2}/${baseline.trades.length}`
  );

  if (tickerCorrections.length) {
    out.push("");
    out.push("  ticker corrections applied by the rebuild (first 10):");
    for (const c of tickerCorrections.slice(0, 10)) {
      out.push(`    ${c.docId}  ${c.from} -> ${c.to}`);
    }
  }

  if (unmatched.length) {
    out.push("");
    out.push("  UNMATCHED LEGACY RECORDS (first 20):");
    for (const u of unmatched.slice(0, 20)) {
      out.push(
        `    ${u.id}  ${u.ticker}  ${u.type}  ${u.transactionDate}  ${u.amount}`
      );
    }
  }

  out.push("");
  out.push(
    `  arithmetic: ${all.length} total - ${legacy.length} superseded legacy = ${rebuilt.length} retained`
  );
  out.push("=".repeat(66));

  const report = out.join("\n");
  console.log(report);
  writeFileSync(REPORT_PATH, `${report}\n`);

  if (unmatched.length) {
    console.error(
      "\nRECONCILIATION FAILED — legacy disclosures have no counterpart in the rebuild."
    );
    console.error("Nothing was changed. The archive still contains both sets.");
    process.exit(1);
  }

  if (!legacy.length) {
    console.log("\nNothing to migrate: no legacy records remain.");
    return;
  }

  if (!APPLY) {
    console.log(
      `\nDry run. Every one of the ${baseline.trades.length} baseline disclosures is present in the rebuild.`
    );
    console.log(`${legacy.length} superseded legacy record(s) would be retired.`);
    console.log("Re-run with --apply to write the migrated archive.");
    return;
  }

  const archive: DisclosureArchive = {
    ...current,
    updatedAt: new Date().toISOString(),
    counts: { ...current.counts, archiveAfter: rebuilt.length },
    trades: rebuilt,
  };
  writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);
  console.log(
    `\nMigrated. ${legacy.length} superseded legacy record(s) retired; ${rebuilt.length} retained.`
  );
}

main();
