import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRunPointer } from "../src/lib/import-artifacts.ts";

/**
 * Proof that the supervised workflow attaches the *current* run's evidence, and
 * never an earlier run's.
 *
 * The workflow runs the importer under `continue-on-error`, clears any
 * inherited pointer beforehand, then resolves the run id and uploads
 * `data/import-runs/{runId}/` under `if: always()`.
 *
 * Two properties have to hold:
 *
 *   1. when the importer produces evidence, the id is discoverable without
 *      scraping log output; and
 *   2. when it crashes before producing evidence, nothing is resolved at all —
 *      a stale pointer must never cause a previous run's directory to be
 *      uploaded as though it belonged to this one.
 *
 * These tests never mutate the repository. Anything that touches real files
 * does so inside a temporary directory, or snapshots and restores every
 * affected path in `finally`.
 */

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "outfox-workflow-"));
}

/**
 * The resolution rule the workflow implements, expressed once so it can be
 * tested directly rather than only in YAML.
 */
function resolveEvidence(
  runsDir: string,
  importerRunId: string | undefined
): { runId: string; hasEvidence: boolean } {
  let runId = importerRunId ?? "";
  if (!runId) {
    const pointer = join(runsDir, "latest-run-id.txt");
    if (existsSync(pointer)) runId = readFileSync(pointer, "utf8").trim();
  }
  if (!runId) return { runId: "", hasEvidence: false };
  return { runId, hasEvidence: existsSync(join(runsDir, runId)) };
}

// --- run identity published for CI -----------------------------------------

test("regression: the run id is written to GITHUB_OUTPUT for CI to consume", () => {
  const dir = tempDir();
  const outputPath = join(dir, "github_output");
  writeFileSync(outputPath, "");

  publishRunPointer(dir, "run_abc123", "data/import-runs/run_abc123", outputPath);

  const written = readFileSync(outputPath, "utf8");
  assert.ok(written.includes("run_id=run_abc123"));
  assert.ok(written.includes("run_dir=data/import-runs/run_abc123"));
});

test("GITHUB_OUTPUT is appended, never truncated", () => {
  const dir = tempDir();
  const outputPath = join(dir, "github_output");
  writeFileSync(outputPath, "import_exit=1\n");

  publishRunPointer(dir, "run_abc123", "data/import-runs/run_abc123", outputPath);

  const written = readFileSync(outputPath, "utf8");
  assert.ok(written.includes("import_exit=1"), "an earlier step's output survives");
  assert.ok(written.includes("run_id=run_abc123"));
});

test("a pointer file is written even with no CI environment", () => {
  const dir = tempDir();
  publishRunPointer(dir, "run_local", "data/import-runs/run_local");
  assert.equal(readFileSync(join(dir, "latest-run-id.txt"), "utf8").trim(), "run_local");
});

// --- stale pointer must never be adopted ------------------------------------

test("regression: a preexisting pointer is not used when the importer crashes early", () => {
  // The dangerous case. A previous run's pointer and evidence directory are
  // present from checkout; this run's importer dies before producing anything.
  // Resolution must report no evidence rather than uploading the old directory
  // labelled as the current run.
  const runsDir = tempDir();
  mkdirSync(join(runsDir, "run_OLD"), { recursive: true });
  writeFileSync(join(runsDir, "run_OLD", "report.txt"), "evidence from a previous run");
  writeFileSync(join(runsDir, "latest-run-id.txt"), "run_OLD\n");

  // What the workflow does before running the importer.
  rmSync(join(runsDir, "latest-run-id.txt"), { force: true });

  // Importer crashes: no GITHUB_OUTPUT value, no new pointer.
  const resolved = resolveEvidence(runsDir, undefined);

  assert.equal(resolved.runId, "", "no run id may be resolved");
  assert.equal(resolved.hasEvidence, false, "the old directory must not be adopted");
  assert.ok(
    existsSync(join(runsDir, "run_OLD", "report.txt")),
    "the earlier run's evidence is left intact, merely not claimed"
  );
});

test("without clearing the pointer, the stale id would have been adopted", () => {
  // Demonstrates why the clearing step exists: identical setup, minus the
  // removal, resolves to the previous run.
  const runsDir = tempDir();
  mkdirSync(join(runsDir, "run_OLD"), { recursive: true });
  writeFileSync(join(runsDir, "latest-run-id.txt"), "run_OLD\n");

  const resolved = resolveEvidence(runsDir, undefined);
  assert.equal(resolved.runId, "run_OLD");
  assert.equal(resolved.hasEvidence, true, "this is the bug the clearing step prevents");
});

test("a pointer written by this run is used", () => {
  const runsDir = tempDir();
  rmSync(join(runsDir, "latest-run-id.txt"), { force: true });

  mkdirSync(join(runsDir, "run_NEW"), { recursive: true });
  publishRunPointer(runsDir, "run_NEW", join(runsDir, "run_NEW"));

  const resolved = resolveEvidence(runsDir, undefined);
  assert.equal(resolved.runId, "run_NEW");
  assert.equal(resolved.hasEvidence, true);
});

test("the importer's own output takes precedence over any pointer", () => {
  const runsDir = tempDir();
  mkdirSync(join(runsDir, "run_FROM_OUTPUT"), { recursive: true });
  writeFileSync(join(runsDir, "latest-run-id.txt"), "run_SOMETHING_ELSE\n");

  const resolved = resolveEvidence(runsDir, "run_FROM_OUTPUT");
  assert.equal(resolved.runId, "run_FROM_OUTPUT");
  assert.equal(resolved.hasEvidence, true);
});

test("a resolved id with no directory reports no evidence", () => {
  const runsDir = tempDir();
  const resolved = resolveEvidence(runsDir, "run_MISSING");
  assert.equal(resolved.runId, "run_MISSING");
  assert.equal(resolved.hasEvidence, false);
});

// --- end to end, hermetically ----------------------------------------------

/**
 * Runs the real importer against a tripped gate.
 *
 * The repository is snapshotted and restored in `finally`, including when an
 * assertion fails, so the working tree is byte-identical afterwards. The
 * importer writes to several shared paths — the archive, the run index, the
 * report and the pointer — and every one of them is captured.
 */
test("e2e: a failed importer leaves uploadable evidence and no trace", { timeout: 120_000 }, (t) => {
  const root = join(import.meta.dirname, "..");
  if (!existsSync(join(root, "scripts", ".cache", "ptr-pdfs"))) {
    t.skip("no cached filings available offline");
    return;
  }

  const tracked = [
    join(root, "src", "lib", "congress-live.json"),
    join(root, "data", "congress-quarantine.json"),
    join(root, "data", "last-import-report.txt"),
    join(root, "data", "import-runs", "index.json"),
    join(root, "data", "import-runs", "latest-run-id.txt"),
  ];

  // Snapshot: contents when present, a null marker when absent, so files the
  // importer creates can be removed again.
  const snapshot = new Map<string, string | null>();
  for (const path of tracked) {
    snapshot.set(path, existsSync(path) ? readFileSync(path, "utf8") : null);
  }

  const runsBackup = tempDir();
  const runsDir = join(root, "data", "import-runs");
  if (existsSync(runsDir)) cpSync(runsDir, join(runsBackup, "import-runs"), { recursive: true });

  try {
    let exitCode = 0;
    try {
      execFileSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "scripts/import-house.ts",
          "--limit",
          "3",
          "--simulate-gate-failure",
        ],
        { cwd: root, stdio: "pipe" }
      );
    } catch (error) {
      exitCode = (error as { status?: number }).status ?? 0;
    }

    assert.equal(exitCode, 1, "an injected gate failure must exit non-zero");

    // Production untouched.
    assert.equal(
      readFileSync(join(root, "src", "lib", "congress-live.json"), "utf8"),
      snapshot.get(join(root, "src", "lib", "congress-live.json")),
      "the archive must be byte-identical after a failed run"
    );

    // Evidence resolvable exactly as the workflow does it.
    const resolved = resolveEvidence(runsDir, undefined);
    assert.ok(resolved.runId, "this run must publish a pointer");
    assert.equal(resolved.hasEvidence, true, "evidence must be uploadable");

    const runDir = join(runsDir, resolved.runId);
    for (const file of ["report.txt", "summary.json", "quarantine.json"]) {
      assert.ok(existsSync(join(runDir, file)), `${file} must be uploadable`);
    }

    const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
    assert.equal(summary.passed, false);
    assert.equal(summary.productionUpdated, false);
    assert.ok(
      summary.failures.includes("simulated_gate_failure"),
      "the injected failure must be named in the evidence"
    );
  } finally {
    // Restore unconditionally, including on assertion failure.
    rmSync(runsDir, { recursive: true, force: true });
    const backup = join(runsBackup, "import-runs");
    if (existsSync(backup)) cpSync(backup, runsDir, { recursive: true });
    rmSync(runsBackup, { recursive: true, force: true });

    for (const [path, contents] of snapshot) {
      if (contents === null) rmSync(path, { force: true });
      else writeFileSync(path, contents);
    }
  }
});

test("the simulation flag is deterministic — it fails on a healthy full run too", { timeout: 180_000 }, (t) => {
  const root = join(import.meta.dirname, "..");
  if (!existsSync(join(root, "scripts", ".cache", "ptr-pdfs"))) {
    t.skip("no cached filings available offline");
    return;
  }

  const archivePath = join(root, "src", "lib", "congress-live.json");
  const archiveBefore = readFileSync(archivePath, "utf8");
  const runsDir = join(root, "data", "import-runs");
  const runsBackup = tempDir();
  if (existsSync(runsDir)) cpSync(runsDir, join(runsBackup, "import-runs"), { recursive: true });
  const reportPath = join(root, "data", "last-import-report.txt");
  const reportBefore = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : null;

  try {
    let exitCode = 0;
    try {
      // A full window that would otherwise pass every gate.
      execFileSync(
        process.execPath,
        ["--experimental-strip-types", "scripts/import-house.ts", "--simulate-gate-failure"],
        { cwd: root, stdio: "pipe" }
      );
    } catch (error) {
      exitCode = (error as { status?: number }).status ?? 0;
    }

    assert.equal(
      exitCode,
      1,
      "simulation must fail regardless of what the source currently contains"
    );
    assert.equal(
      readFileSync(archivePath, "utf8"),
      archiveBefore,
      "simulation must never write production, even on an otherwise healthy run"
    );
  } finally {
    rmSync(runsDir, { recursive: true, force: true });
    const backup = join(runsBackup, "import-runs");
    if (existsSync(backup)) cpSync(backup, runsDir, { recursive: true });
    rmSync(runsBackup, { recursive: true, force: true });
    if (reportBefore === null) rmSync(reportPath, { force: true });
    else writeFileSync(reportPath, reportBefore);
    writeFileSync(archivePath, archiveBefore);
  }
});
