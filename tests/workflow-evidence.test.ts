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
  statSync,
  symlinkSync,
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
 * does so inside a temporary directory, never the production data checkout.
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

/** Run the actual importer in an isolated source/data tree with pinned PDFs.
 * The preload refuses every unmocked network request. No real archive, cached
 * source, run pointer or evidence directory is ever changed by these tests.
 */
function isolatedImporter() {
  const sourceRoot = join(import.meta.dirname, "..");
  const root = tempDir();
  mkdirSync(join(root, "scripts", ".cache", "ptr-pdfs"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  cpSync(join(sourceRoot, "scripts", "import-house.ts"), join(root, "scripts", "import-house.ts"));
  cpSync(join(sourceRoot, "src", "lib"), join(root, "src", "lib"), {
    recursive: true,
    filter: path => statSync(path).isDirectory() || path.endsWith(".ts"),
  });
  symlinkSync(join(sourceRoot, "node_modules"), join(root, "node_modules"), "dir");
  const archivePath = join(root, "src", "lib", "congress-live.json");
  const archiveBefore = JSON.stringify({ schemaVersion: 1, trades: [] });
  writeFileSync(archivePath, archiveBefore);
  writeFileSync(join(root, "data", "house-party-map.json"), JSON.stringify({ "Cleo Fields": "D" }));
  const entries = Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [
    `TEST${i}`, { ticker: `TEST${i}`, cik: String(i + 1).padStart(10, "0"), title: `Synthetic issuer ${i}` },
  ]));
  entries.NVDA = { ticker: "NVDA", cik: "0001045810", title: "NVIDIA CORP" };
  writeFileSync(join(root, "data", "security-master.json"), JSON.stringify({ updatedAt: "2026-08-01", entries }));
  cpSync(join(sourceRoot, "tests", "fixtures", "house-recovery", "20034894.pdf"),
    join(root, "scripts", ".cache", "ptr-pdfs", "20034894.pdf"));
  const preload = join(root, "offline.mjs");
  writeFileSync(preload, `
    globalThis.fetch = async url => {
      if (!/^https:\\/\\/disclosures-clerk\\.house\\.gov\\/public_disc\\/financial-pdfs\\/\\d{4}FD\\.xml$/.test(String(url)))
        throw new Error("Unexpected network access: " + url);
      return new Response("<Member><First>Cleo</First><Last>Fields</Last><StateDst>LA06</StateDst><FilingDate>08/01/2026</FilingDate><FilingType>P</FilingType><DocID>20034894</DocID></Member>");
    };
  `);
  const runsDir = join(root, "data", "import-runs");
  function run(extra: string[]) {
    let status = 0;
    try {
      execFileSync(process.execPath, ["--import", preload, "--experimental-strip-types", "scripts/import-house.ts", ...extra],
        { cwd: root, stdio: "pipe", env: { ...process.env, GITHUB_OUTPUT: "" } });
    } catch (error) { status = (error as { status?: number }).status ?? -1; }
    const resolved = resolveEvidence(runsDir, undefined);
    assert.equal(resolved.hasEvidence, true, "this isolated run must produce its own evidence");
    const runDir = join(runsDir, resolved.runId);
    const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
    return { status, summary, runDir, runId: resolved.runId };
  }
  return { root, archivePath, archiveBefore, run };
}

test("e2e: a failed importer leaves uploadable evidence without touching production", { timeout: 120_000 }, () => {
  const fixture = isolatedImporter();
  try {
    const { status, summary, runDir } = fixture.run(["--limit", "3", "--simulate-gate-failure"]);
    assert.equal(status, 1);
    assert.equal(readFileSync(fixture.archivePath, "utf8"), fixture.archiveBefore);
    for (const file of ["report.txt", "summary.json", "quarantine.json"])
      assert.ok(existsSync(join(runDir, file)), `${file} must be uploadable`);
    assert.equal(summary.passed, false);
    assert.equal(summary.productionUpdated, false);
    assert.ok(summary.failures.includes("simulated_gate_failure"));
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test("the simulation flag fails on an otherwise healthy full run", { timeout: 120_000 }, () => {
  const fixture = isolatedImporter();
  try {
    const healthy = fixture.run(["--dry-run"]);
    assert.equal(healthy.status, 0, JSON.stringify(healthy.summary.failures));
    assert.equal(healthy.summary.passed, true);
    const simulated = fixture.run(["--simulate-gate-failure"]);
    assert.equal(simulated.status, 1);
    assert.notEqual(simulated.runId, healthy.runId, "never adopt the previous successful run");
    assert.equal(simulated.summary.passed, false);
    assert.deepEqual(simulated.summary.failures, ["simulated_gate_failure"]);
    assert.equal(readFileSync(fixture.archivePath, "utf8"), fixture.archiveBefore);
  } finally { rmSync(fixture.root, { recursive: true, force: true }); }
});
