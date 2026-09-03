import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildZeroRowFile,
  writeRunArtifacts,
  type RunArtifactInput,
} from "../src/lib/import-artifacts.ts";
import { assessRun } from "../src/lib/congress-gates.ts";
import { emptyCounts, type ZeroRowFiling } from "../src/lib/congress-schema.ts";

/**
 * A filing that produces no rows must say why.
 *
 * 145 of 359 filings yielded nothing, and the pipeline reported only the
 * number. Inside that number were twelve real transactions the parser dropped
 * on a page break — invisible, because "zero rows" and "zero rows expected"
 * looked identical. Every empty filing is now classified, written to evidence,
 * and the classification that cannot be explained blocks the run.
 */

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "outfox-zerorow-"));
}

function filing(over: Partial<ZeroRowFiling> = {}): ZeroRowFiling {
  return {
    docId: "20035000",
    filingUrl: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/20035000.pdf",
    filer: "Jane Doe",
    filedDate: "2026-08-01",
    classification: "no_ticker_present",
    textLength: 1200,
    symbolBlocks: 0,
    unsupportedAssetTypes: [],
    previouslyProductive: false,
    ...over,
  };
}

function runInput(over: Partial<RunArtifactInput> = {}): RunArtifactInput {
  return {
    runId: "run_test",
    startedAt: "2026-08-21T09:00:00.000Z",
    finishedAt: "2026-08-21T09:00:30.000Z",
    counts: { ...emptyCounts(), zeroRowFilings: 1 },
    gates: { passed: true, failures: [], warnings: [] },
    productionUpdated: false,
    dryRun: true,
    report: "report",
    quarantined: [],
    unseenIds: [],
    zeroRowFilings: [filing()],
    ...over,
  };
}

// --- evidence is written and uploadable -------------------------------------

test("zero-row evidence is written to the run's artifact directory", () => {
  const dir = tempDir();
  const runDir = writeRunArtifacts(dir, runInput());

  const path = join(runDir, "zero-row-filings.json");
  assert.ok(existsSync(path), "zero-row-filings.json must be uploadable");

  const written = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(written.filings.length, 1);
  assert.equal(written.filings[0].docId, "20035000");
  assert.match(written.filings[0].filingUrl, /^https:\/\/disclosures-clerk\.house\.gov\//);
  assert.equal(written.filings[0].filer, "Jane Doe");
  assert.equal(written.filings[0].classification, "no_ticker_present");
});

test("the file is written even when no filing was empty", () => {
  // Absence of the file must mean "no evidence produced", never "nothing to
  // report" — otherwise a missing file is ambiguous exactly when it matters.
  const dir = tempDir();
  const runDir = writeRunArtifacts(dir, runInput({ zeroRowFilings: [] }));

  const path = join(runDir, "zero-row-filings.json");
  assert.ok(existsSync(path));
  const written = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(written.filings, []);
  assert.equal(written.counts.parser_suspicious, 0, "categories are still reported");
});

test("a failed run keeps its zero-row evidence", () => {
  const dir = tempDir();
  const runDir = writeRunArtifacts(
    dir,
    runInput({
      gates: { passed: false, failures: ["unexplained_zero_row_filings:2"], warnings: [] },
    })
  );
  assert.ok(existsSync(join(runDir, "zero-row-filings.json")));
});

test("every classification appears in counts, including the zeroes", () => {
  const file = buildZeroRowFile("run_x", "2026-08-21T09:00:00.000Z", [
    filing({ classification: "empty_text_extraction" }),
    filing({ classification: "empty_text_extraction", docId: "2" }),
    filing({ classification: "no_ticker_present", docId: "3" }),
  ]);

  assert.equal(file.counts.empty_text_extraction, 2);
  assert.equal(file.counts.no_ticker_present, 1);
  assert.equal(file.counts.parser_suspicious, 0);
  assert.equal(file.counts.unsupported_layout, 0);
  assert.equal(
    Object.keys(file.counts).length,
    5,
    "a reader can tell 'none occurred' from 'not measured'"
  );
});

test("previously productive filings are listed first", () => {
  const file = buildZeroRowFile("run_x", "2026-08-21T09:00:00.000Z", [
    filing({ docId: "new", filedDate: "2026-08-20" }),
    filing({ docId: "regressed", filedDate: "2026-01-01", previouslyProductive: true }),
  ]);
  assert.equal(file.filings[0].docId, "regressed", "the alarming case leads");
});

test("unsupported asset codes are named in the evidence", () => {
  const file = buildZeroRowFile("run_x", "2026-08-21T09:00:00.000Z", [
    filing({
      classification: "no_supported_security_transaction",
      unsupportedAssetTypes: ["CT"],
    }),
  ]);
  assert.deepEqual(file.filings[0].unsupportedAssetTypes, ["CT"]);
});

// --- gates -------------------------------------------------------------------

function healthyCounts() {
  return {
    ...emptyCounts(),
    sourceFilings: 359,
    selectedFilings: 359,
    downloadedFilings: 359,
    parsedFilings: 359,
    parsedRecords: 957,
    accepted: 957,
    archiveBefore: 945,
    archiveAfter: 957,
  };
}

test("a previously productive filing becoming empty still blocks the run", () => {
  const result = assessRun({
    counts: healthyCounts(),
    previouslyProductiveDocIds: new Set(["20033725"]),
    zeroRowDocIds: ["20033725"],
  });

  assert.equal(result.passed, false);
  assert.ok(
    result.failures.some((f) => f.startsWith("previously_productive_filings_now_empty")),
    `expected a regression failure, got ${JSON.stringify(result.failures)}`
  );
  assert.ok(
    result.failures.some((f) => f.includes("20033725")),
    "the offending document is named"
  );
});

test("an unexplained zero-row filing blocks the run", () => {
  // The signature of silent row loss: a supported security that produced
  // nothing. This is a failure, not a warning.
  const result = assessRun({
    counts: { ...healthyCounts(), zeroRowFilings: 3, suspiciousZeroRowFilings: 1 },
  });

  assert.equal(result.passed, false);
  assert.ok(
    result.failures.includes("unexplained_zero_row_filings:1"),
    `expected a blocking failure, got ${JSON.stringify(result.failures)}`
  );
});

test("zero-row filings are not healthy merely by being numerous", () => {
  // 145 empty filings pass only because every one of them is explained.
  const explained = assessRun({
    counts: { ...healthyCounts(), zeroRowFilings: 145, scannedFilings: 42 },
  });
  assert.equal(explained.passed, true, "explained emptiness passes");
  assert.ok(
    explained.warnings.includes("scanned_filings_unreadable:42"),
    "but unreadable filings are still surfaced, never silent"
  );

  const unexplained = assessRun({
    counts: {
      ...healthyCounts(),
      zeroRowFilings: 145,
      scannedFilings: 42,
      suspiciousZeroRowFilings: 1,
    },
  });
  assert.equal(unexplained.passed, false, "one unexplained filing is enough to block");
});

test("an amount present but unreadable is surfaced as a warning", () => {
  const result = assessRun({
    counts: { ...healthyCounts(), amountParseFailures: 2 },
  });
  assert.ok(result.warnings.includes("amount_parse_failures:2"));
  assert.equal(result.passed, true, "it warns rather than blocking a whole run");
});

test("a clean run raises none of the new signals", () => {
  const result = assessRun({ counts: healthyCounts() });
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.warnings.filter(
      (w) => w.startsWith("scanned_") || w.startsWith("amount_parse_")
    ),
    []
  );
});
