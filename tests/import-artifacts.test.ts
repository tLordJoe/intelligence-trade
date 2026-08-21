import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendRunIndex,
  mergeQuarantine,
  summarizeRun,
  writeRunArtifacts,
  type RunArtifactInput,
} from "../src/lib/import-artifacts.ts";
import type {
  DisclosureRecord,
  QuarantineEntry,
} from "../src/lib/congress-schema.ts";
import { emptyCounts } from "../src/lib/congress-schema.ts";

/**
 * Evidence from a failed run has to survive the failure.
 *
 * The first version of the pipeline wrote quarantine inside the
 * `if (productionUpdated)` branch, so the records explaining a failure were
 * discarded precisely when they mattered, and a single fixed report path meant
 * the next run overwrote what the last one found.
 */

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "outfox-artifacts-"));
}

function record(id: string, over: Partial<DisclosureRecord> = {}): DisclosureRecord {
  return {
    id,
    idStrategy: "content-row",
    politician: "Jane Doe",
    party: "D",
    chamber: "House",
    state: "CA",
    district: "CA11",
    ticker: "ZZZZQ",
    companyName: "Unlisted Co",
    type: "Buy",
    amount: "$1,001 - $15,000",
    amountLow: 1001,
    amountHigh: 15000,
    amountStatus: "disclosed_range",
    transactionDate: "2026-07-01",
    filedDate: "2026-08-05",
    isOptions: false,
    source: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/DOC1.pdf",
    raw: {
      issuerName: "Unlisted Co",
      tickerText: "ZZZZQ",
      amountText: "$1,001 - $15,000",
      typeText: "P",
      ownerText: "SP",
      transactionDateText: "07/01/2026",
      filedDateText: "08/05/2026",
    },
    provenance: {
      sourceChamber: "House",
      filingUrl: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/DOC1.pdf",
      docId: "DOC1",
      rowIndex: 0,
      contentHash: "hash0000",
      occurrence: 0,
      reconciliationKey: "DOC1::core::0",
      firstSeen: "2026-08-01T00:00:00.000Z",
      lastSeen: "2026-08-01T00:00:00.000Z",
      importRunId: "run_old",
      schemaVersion: 1,
    },
    status: "quarantined",
    warnings: ["issuer_ticker_conflict:BRK-B"],
    tickerResolution: "unknown",
    ...over,
  };
}

function failedRun(over: Partial<RunArtifactInput> = {}): RunArtifactInput {
  return {
    runId: "run_2026-08-21T09-00-00Z_failed01",
    startedAt: "2026-08-21T09:00:00.000Z",
    finishedAt: "2026-08-21T09:00:30.000Z",
    counts: {
      ...emptyCounts(),
      sourceFilings: 359,
      selectedFilings: 359,
      downloadedFilings: 12,
      parsedFilings: 12,
      parsedRecords: 30,
      accepted: 28,
      quarantined: 2,
      archiveBefore: 945,
      archiveAfter: 945,
    },
    gates: {
      passed: false,
      failures: ["download_completion_too_low:12/359"],
      warnings: [],
    },
    productionUpdated: false,
    dryRun: false,
    report: "OUTFOX HOUSE DISCLOSURE IMPORT\nGATES  result  FAIL",
    quarantined: [record("DOC1::aaa::0"), record("DOC2::bbb::0")],
    unseenIds: ["DOC9::zzz::0"],
    zeroRowFilings: [],
    ...over,
  };
}

// --- failed runs keep their evidence ----------------------------------------

test("regression: a failed run still writes its quarantine records", () => {
  const dir = tempDir();
  const input = failedRun();
  const runDir = writeRunArtifacts(dir, input);

  const quarantinePath = join(runDir, "quarantine.json");
  assert.ok(existsSync(quarantinePath), "quarantine must be written on failure");

  const written = JSON.parse(readFileSync(quarantinePath, "utf8"));
  assert.equal(written.records.length, 2);
  assert.equal(written.runId, input.runId);
  assert.ok(
    written.records[0].warnings.includes("issuer_ticker_conflict:BRK-B"),
    "the reason the record was held back must survive"
  );
});

test("a failed run writes its report and summary", () => {
  const dir = tempDir();
  const input = failedRun();
  const runDir = writeRunArtifacts(dir, input);

  assert.ok(existsSync(join(runDir, "report.txt")));
  const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
  assert.equal(summary.passed, false);
  assert.equal(summary.productionUpdated, false);
  assert.deepEqual(summary.failures, ["download_completion_too_low:12/359"]);
  assert.equal(summary.counts.downloadedFilings, 12);
  assert.equal(summary.quarantinedCount, 2);
});

test("artifacts are addressed by run id, so runs cannot overwrite each other", () => {
  const dir = tempDir();
  const first = failedRun({ runId: "run_A" });
  const second = failedRun({
    runId: "run_B",
    quarantined: [record("DOC3::ccc::0")],
  });

  writeRunArtifacts(dir, first);
  writeRunArtifacts(dir, second);

  const a = JSON.parse(readFileSync(join(dir, "run_A", "quarantine.json"), "utf8"));
  const b = JSON.parse(readFileSync(join(dir, "run_B", "quarantine.json"), "utf8"));
  assert.equal(a.records.length, 2, "the earlier run's evidence is intact");
  assert.equal(b.records.length, 1);
});

test("unseen archive ids are captured when present", () => {
  const dir = tempDir();
  const runDir = writeRunArtifacts(dir, failedRun());
  const unseen = JSON.parse(readFileSync(join(runDir, "unseen-ids.json"), "utf8"));
  assert.deepEqual(unseen.ids, ["DOC9::zzz::0"]);
});

test("a successful run writes the same artifact set", () => {
  const dir = tempDir();
  const runDir = writeRunArtifacts(
    dir,
    failedRun({
      runId: "run_ok",
      gates: { passed: true, failures: [], warnings: [] },
      productionUpdated: true,
    })
  );
  for (const f of ["report.txt", "summary.json", "quarantine.json"]) {
    assert.ok(existsSync(join(runDir, f)), `${f} must exist on success too`);
  }
});

// --- run index --------------------------------------------------------------

test("the run index accumulates newest first", () => {
  const dir = tempDir();
  const indexPath = join(dir, "index.json");

  appendRunIndex(indexPath, summarizeRun(failedRun({ runId: "run_1" })));
  appendRunIndex(indexPath, summarizeRun(failedRun({ runId: "run_2" })));

  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  assert.equal(index.runs.length, 2);
  assert.equal(index.runs[0].runId, "run_2", "newest first");
  assert.equal(index.runs[1].runId, "run_1");
});

test("re-running the same id replaces its entry rather than duplicating", () => {
  const dir = tempDir();
  const indexPath = join(dir, "index.json");
  appendRunIndex(indexPath, summarizeRun(failedRun({ runId: "run_1" })));
  appendRunIndex(
    indexPath,
    summarizeRun(
      failedRun({ runId: "run_1", gates: { passed: true, failures: [], warnings: [] } })
    )
  );
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  assert.equal(index.runs.length, 1);
  assert.equal(index.runs[0].passed, true);
});

test("a corrupt index does not lose the current run", () => {
  const dir = tempDir();
  const indexPath = join(dir, "index.json");
  writeFileSync(indexPath, "{ not json");
  appendRunIndex(indexPath, summarizeRun(failedRun({ runId: "run_1" })));
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  assert.equal(index.runs.length, 1);
  assert.equal(index.runs[0].runId, "run_1");
});

// --- the live queue stays clean ---------------------------------------------

test("mergeQuarantine accumulates history across runs", () => {
  const first = mergeQuarantine([], [record("DOC1::aaa::0")], "run_1", "2026-08-21T09:00:00.000Z");
  assert.equal(first.entries.length, 1);
  assert.deepEqual(first.entries[0].runIds, ["run_1"]);
  assert.equal(first.entries[0].resolution, "open");

  const second = mergeQuarantine(
    first.entries as QuarantineEntry[],
    [record("DOC1::aaa::0")],
    "run_2",
    "2026-08-22T09:00:00.000Z"
  );
  assert.equal(second.entries.length, 1, "same record, not a second entry");
  assert.deepEqual(second.entries[0].runIds, ["run_1", "run_2"], "recurrence is visible");
  assert.equal(second.entries[0].firstSeen, "2026-08-21T09:00:00.000Z", "firstSeen is stable");
  assert.equal(second.entries[0].lastSeen, "2026-08-22T09:00:00.000Z");
});

test("a new quarantined record joins the queue without disturbing existing entries", () => {
  const first = mergeQuarantine([], [record("DOC1::aaa::0")], "run_1", "2026-08-21T09:00:00.000Z");
  const second = mergeQuarantine(
    first.entries as QuarantineEntry[],
    [record("DOC2::bbb::0")],
    "run_2",
    "2026-08-22T09:00:00.000Z"
  );
  assert.equal(second.entries.length, 2);
  const ids = second.entries.map((e) => e.record.id).sort();
  assert.deepEqual(ids, ["DOC1::aaa::0", "DOC2::bbb::0"]);
});
