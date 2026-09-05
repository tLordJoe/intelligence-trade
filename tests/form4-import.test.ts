import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Importer isolation.
 *
 * The importer must be incapable of disturbing anything that is already live.
 * These tests run it for real, offline against the committed fixtures, and
 * check the House production archive byte for byte afterwards — including when
 * the run is forced to fail.
 */

const ROOT = join(import.meta.dirname, "..");
const SCRIPT = join(ROOT, "scripts", "import-form4.ts");
const RUNS_DIR = join(ROOT, "data", "form4-runs");
const CANDIDATE = join(ROOT, "data", "form4-candidate.json");
const HOUSE_ARCHIVE = join(ROOT, "src", "lib", "congress-live.json");

function runImporter(args: string[]): { status: number; stdout: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      ["--experimental-strip-types", SCRIPT, ...args],
      { cwd: ROOT, stdio: "pipe", encoding: "utf8" }
    );
    return { status: 0, stdout };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** Snapshot everything the importer must not touch, and restore it afterwards. */
function withIsolation(body: () => void): void {
  const houseBefore = readFileSync(HOUSE_ARCHIVE, "utf8");
  const candidateBefore = existsSync(CANDIDATE) ? readFileSync(CANDIDATE, "utf8") : null;
  const runsBefore = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR) : [];
  try {
    body();
  } finally {
    // Leave the tree exactly as found: these are local run artifacts.
    if (existsSync(RUNS_DIR)) {
      for (const entry of readdirSync(RUNS_DIR)) {
        if (!runsBefore.includes(entry)) rmSync(join(RUNS_DIR, entry), { recursive: true, force: true });
      }
    }
    if (candidateBefore === null) rmSync(CANDIDATE, { force: true });
    else writeFileSync(CANDIDATE, candidateBefore);
    assert.equal(readFileSync(HOUSE_ARCHIVE, "utf8"), houseBefore, "House archive must be untouched");
  }
}

const latestRun = (): string => {
  const runs = readdirSync(RUNS_DIR).filter((d) => d.startsWith("form4_")).sort();
  assert.ok(runs.length > 0, "a run directory must exist");
  return join(RUNS_DIR, runs[runs.length - 1]);
};

test("fixtures mode parses the whole corpus offline and passes its gates", { timeout: 120_000 }, () => {
  withIsolation(() => {
    const { status, stdout } = runImporter(["--mode", "fixtures"]);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /result\s+PASS/);
    assert.match(stdout, /candidate updated\s+no/, "fixtures mode never promotes");
  });
});

test("regression: a dry run leaves House production byte-identical", { timeout: 120_000 }, () => {
  const before = readFileSync(HOUSE_ARCHIVE, "utf8");
  withIsolation(() => {
    runImporter(["--mode", "fixtures"]);
    assert.equal(readFileSync(HOUSE_ARCHIVE, "utf8"), before);
  });
});

test("a forced gate failure writes evidence, refuses promotion and exits non-zero", { timeout: 120_000 }, () => {
  withIsolation(() => {
    rmSync(CANDIDATE, { force: true });
    const { status, stdout } = runImporter([
      "--mode", "candidate", "--source", "fixtures", "--simulate-gate-failure",
    ]);

    assert.equal(status, 1, "a failed run must exit non-zero");
    assert.match(stdout, /result\s+FAIL/);
    assert.match(stdout, /simulated_gate_failure/);
    assert.equal(existsSync(CANDIDATE), false, "nothing may be promoted from a failed run");

    // Evidence for *this* run, not a previous one.
    const dir = latestRun();
    for (const file of ["summary.json", "report.txt", "manifest.json", "quarantine.json", "unsupported.json", "errors.json"]) {
      assert.ok(existsSync(join(dir, file)), `${file} must be retained`);
    }
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8"));
    assert.equal(summary.passed, false);
    assert.equal(summary.promoted, false);
    assert.deepEqual(summary.gateFailures, ["simulated_gate_failure"]);
    assert.ok(readdirSync(join(dir, "raw")).length > 0, "raw source bytes are archived");
  });
});

test("a clean candidate run promotes, and the candidate is replaced whole", { timeout: 120_000 }, () => {
  withIsolation(() => {
    rmSync(CANDIDATE, { force: true });
    const { status } = runImporter(["--mode", "candidate", "--source", "fixtures"]);
    assert.equal(status, 0);
    assert.ok(existsSync(CANDIDATE), "a passing run promotes");

    const promoted = JSON.parse(readFileSync(CANDIDATE, "utf8"));
    assert.equal(promoted.schemaVersion, 1);
    assert.ok(Array.isArray(promoted.filings) && promoted.filings.length > 0);
    // No partial write survived the atomic replace.
    assert.equal(
      readdirSync(join(ROOT, "data")).filter((f) => f.includes(".tmp")).length,
      0,
      "no temporary file is left behind"
    );
  });
});

test("each run writes its own evidence directory, never reusing an earlier one", { timeout: 180_000 }, () => {
  withIsolation(() => {
    runImporter(["--mode", "fixtures"]);
    const first = latestRun();
    runImporter(["--mode", "fixtures"]);
    const second = latestRun();
    assert.notEqual(first, second, "a second run must not write into the first run's directory");
  });
});

test("a held lock refuses a concurrent import rather than interleaving writes", { timeout: 120_000 }, () => {
  withIsolation(() => {
    mkdirSync(RUNS_DIR, { recursive: true });
    const lock = join(RUNS_DIR, ".import.lock");
    writeFileSync(lock, "someone_else 2026-09-04T00:00:00.000Z\n");
    try {
      const { status, stdout } = runImporter(["--mode", "fixtures"]);
      assert.equal(status, 1, "a second writer must be refused");
      assert.match(stdout, /holds the lock/);
    } finally {
      rmSync(lock, { force: true });
    }
  });
});

test("a networked mode refuses to run without a declared SEC contact", { timeout: 120_000 }, () => {
  withIsolation(() => {
    const { status, stdout } = runImporter(["--mode", "dry-run", "--from", "2026-08-28", "--to", "2026-09-03"]);
    assert.equal(status, 1);
    assert.match(stdout, /SEC_USER_AGENT is required/);
    // The error must not suggest a fabricated address.
    assert.doesNotMatch(stdout, /research@outfoxmarkets\.com/);
  });
});
