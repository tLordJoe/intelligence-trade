import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCandidateFile } from "../src/lib/form4/candidate-storage.ts";
import { insiderUniverseHash, type InsiderUniverse } from "../src/lib/form4/universe.ts";

test("backfill resumes checkpoints and respects locks in the configured data directory", () => {
  const data = mkdtempSync(join(tmpdir(), "outfox-backfill-test-"));
  try {
    const universe: InsiderUniverse = { schemaVersion: 1, source: "sec-company-tickers",
      sourceSha256: "a".repeat(64), capturedAt: "2026-01-01T00:00:00Z",
      entries: [{cik: "0000000001", ticker: "TEST", title: "Synthetic issuer"}] };
    const universePath = join(data, "universe.json"), runId = "form4_completed";
    writeFileSync(universePath, JSON.stringify(universe));
    writeCandidateFile(join(data, "form4-candidate.json"), {schemaVersion: 1, updatedAt: "2026-03-14", runIds: [runId], filings: []});
    const runs = join(data, "form4-runs"), run = join(runs, runId);
    mkdirSync(run, {recursive: true});
    writeFileSync(join(run, "selection.json"), JSON.stringify({universeSha256: insiderUniverseHash(universe), allAccessions: [], batchAccessions: []}));
    writeFileSync(join(run, "summary.json"), JSON.stringify({source: "edgar", selection: {from: "2026-03-12", to: "2026-03-13"}, enumeration: {complete: true}, passed: true, promoted: true}));
    const script = join(import.meta.dirname, "../scripts/backfill-insiders.ts");
    const args = ["--experimental-strip-types", script, "--from", "2026-03-12", "--to", "2026-03-13", "--universe", universePath];
    const options = {encoding: "utf8" as const, stdio: "pipe" as const, env: {...process.env, OUTFOX_FORM4_DATA_DIR: data, SEC_USER_AGENT: ""}};
    const result = execFileSync(process.execPath, args, options);
    assert.match(result, /Complete source selection 2026-03-12–2026-03-13: 0 filings/);
    assert.doesNotMatch(result, /Collecting/);
    writeFileSync(join(runs, ".import.lock"), "held");
    assert.throws(() => execFileSync(process.execPath, args, options), /Another import is active/);
  } finally {
    rmSync(data, {recursive: true, force: true});
  }
});
