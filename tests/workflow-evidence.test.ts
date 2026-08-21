import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRunPointer } from "../src/lib/import-artifacts.ts";

/**
 * Proof that the supervised workflow can find and upload a failed run's
 * evidence.
 *
 * The workflow runs the importer with `continue-on-error`, then resolves the
 * run id and uploads `data/import-runs/{runId}/` under `if: always()`. Two
 * things have to hold for that to work when the importer exits non-zero:
 *
 *   1. the run id must be discoverable without parsing log output, and
 *   2. the evidence directory must already exist by the time the process exits.
 *
 * The importer publishes both before its exit path, which is what these tests
 * pin down.
 */

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "outfox-workflow-"));
}

test("regression: the run id is written to GITHUB_OUTPUT for CI to consume", () => {
  const dir = tempDir();
  const outputPath = join(dir, "github_output");
  writeFileSync(outputPath, "");

  publishRunPointer(dir, "run_abc123", "data/import-runs/run_abc123", outputPath);

  const written = readFileSync(outputPath, "utf8");
  assert.ok(written.includes("run_id=run_abc123"), "run id must be exported");
  assert.ok(
    written.includes("run_dir=data/import-runs/run_abc123"),
    "run directory must be exported"
  );
});

test("GITHUB_OUTPUT is appended, never truncated", () => {
  const dir = tempDir();
  const outputPath = join(dir, "github_output");
  writeFileSync(outputPath, "import_exit=1\n");

  publishRunPointer(dir, "run_abc123", "data/import-runs/run_abc123", outputPath);

  const written = readFileSync(outputPath, "utf8");
  assert.ok(
    written.includes("import_exit=1"),
    "an earlier step's output must survive"
  );
  assert.ok(written.includes("run_id=run_abc123"));
});

test("a pointer file is written even with no CI environment", () => {
  const dir = tempDir();
  publishRunPointer(dir, "run_local", "data/import-runs/run_local");
  const pointer = readFileSync(join(dir, "latest-run-id.txt"), "utf8").trim();
  assert.equal(pointer, "run_local", "the workflow's fallback lookup must work");
});

/**
 * End-to-end simulation of the workflow's failure path.
 *
 * Runs the real importer with a window small enough to trip the completeness
 * gate, then asserts the two things the upload steps depend on. Skipped when
 * the cached source data is unavailable, so the suite stays runnable offline.
 */
test("e2e: a failed importer still leaves uploadable evidence", { timeout: 120_000 }, (t) => {
  const root = join(import.meta.dirname, "..");
  const cache = join(root, "scripts", ".cache", "ptr-pdfs");
  if (!existsSync(cache)) {
    t.skip("no cached filings available offline");
    return;
  }

  const archivePath = join(root, "src", "lib", "congress-live.json");
  const before = readFileSync(archivePath, "utf8");
  const pointerPath = join(root, "data", "import-runs", "latest-run-id.txt");

  let exitCode = 0;
  try {
    execFileSync(
      process.execPath,
      ["--experimental-strip-types", "scripts/import-house.ts", "--limit", "3"],
      { cwd: root, stdio: "pipe" }
    );
  } catch (error) {
    exitCode = (error as { status?: number }).status ?? 0;
  }

  assert.equal(exitCode, 1, "a tripped gate must exit non-zero");

  // 1. Production is untouched.
  assert.equal(
    readFileSync(archivePath, "utf8"),
    before,
    "the archive must be byte-identical after a failed run"
  );

  // 2. The workflow's lookup path resolves.
  assert.ok(existsSync(pointerPath), "latest-run-id.txt must exist for the fallback");
  const runId = readFileSync(pointerPath, "utf8").trim();
  const runDir = join(root, "data", "import-runs", runId);
  assert.ok(existsSync(runDir), `evidence directory ${runId} must exist`);

  // 3. The files the workflow uploads are present and describe the failure.
  for (const file of ["report.txt", "summary.json", "quarantine.json"]) {
    assert.ok(existsSync(join(runDir, file)), `${file} must be uploadable`);
  }
  const summary = JSON.parse(readFileSync(join(runDir, "summary.json"), "utf8"));
  assert.equal(summary.passed, false);
  assert.equal(summary.productionUpdated, false);
  assert.ok(summary.failures.length > 0, "the failure reason must be recorded");

  // Leave the tree as we found it — this is a real run against the repo.
  rmSync(runDir, { recursive: true, force: true });
});
