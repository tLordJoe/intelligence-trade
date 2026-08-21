/**
 * Per-run audit artifacts.
 *
 * Two things went wrong in the first version of this pipeline.
 *
 * Quarantine was written inside the `if (productionUpdated)` branch, so a run
 * that failed its gates discarded the very records that would explain the
 * failure. And the import report was written to a single fixed path, so the
 * next run overwrote the evidence from the last one.
 *
 * Every run now writes a complete, immutable artifact set under its own run id,
 * whether it passed or failed. Production data is a separate concern: a failed
 * run still leaves the archive and the live quarantine queue untouched.
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";

import type {
  DisclosureRecord,
  ImportCounts,
  QuarantineEntry,
  QuarantineFile,
} from "./congress-schema.ts";
import type { RunGateResult } from "./congress-gates.ts";

export interface RunArtifactInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  counts: ImportCounts;
  gates: RunGateResult;
  productionUpdated: boolean;
  dryRun: boolean;
  report: string;
  quarantined: DisclosureRecord[];
  /** Archived record ids absent from this run's source window. */
  unseenIds: string[];
}

export interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  passed: boolean;
  productionUpdated: boolean;
  dryRun: boolean;
  failures: string[];
  warnings: string[];
  counts: ImportCounts;
  quarantinedCount: number;
}

/**
 * Write the full evidence set for one run.
 *
 * Called unconditionally, before any decision about production, so the reason a
 * run failed survives the failure.
 */
export function writeRunArtifacts(
  runsDir: string,
  input: RunArtifactInput
): string {
  const dir = join(runsDir, input.runId);
  mkdirSync(dir, { recursive: true });

  const summary: RunSummary = {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    passed: input.gates.passed,
    productionUpdated: input.productionUpdated,
    dryRun: input.dryRun,
    failures: input.gates.failures,
    warnings: input.gates.warnings,
    counts: input.counts,
    quarantinedCount: input.quarantined.length,
  };

  writeFileSync(join(dir, "report.txt"), `${input.report}\n`);
  writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(
    join(dir, "quarantine.json"),
    `${JSON.stringify(
      { runId: input.runId, capturedAt: input.finishedAt, records: input.quarantined },
      null,
      2
    )}\n`
  );

  // Only meaningful on a failure, but cheap and occasionally useful otherwise.
  if (input.unseenIds.length) {
    writeFileSync(
      join(dir, "unseen-ids.json"),
      `${JSON.stringify({ runId: input.runId, ids: input.unseenIds }, null, 2)}\n`
    );
  }

  return dir;
}

/**
 * Append this run to the durable index of runs.
 *
 * Newest first, so the most recent failure is the first thing visible.
 */
export function appendRunIndex(indexPath: string, summary: RunSummary): void {
  let runs: RunSummary[] = [];
  if (existsSync(indexPath)) {
    try {
      const prior = JSON.parse(readFileSync(indexPath, "utf8"));
      runs = Array.isArray(prior?.runs) ? prior.runs : [];
    } catch {
      runs = [];
    }
  }
  runs = [summary, ...runs.filter((r) => r.runId !== summary.runId)];
  writeFileSync(
    indexPath,
    `${JSON.stringify({ updatedAt: summary.finishedAt, runs }, null, 2)}\n`
  );
}

/**
 * Fold this run's quarantined records into the live review queue.
 *
 * Pure so it can be tested directly, and called only on a passing run — a
 * failed run's quarantine is preserved in its own artifact directory instead,
 * to keep the live queue free of records produced by a run we do not trust.
 */
export function mergeQuarantine(
  prior: QuarantineEntry[],
  quarantined: DisclosureRecord[],
  runId: string,
  now: string
): QuarantineFile {
  const byId = new Map(prior.map((e) => [e.record.id, e]));

  for (const record of quarantined) {
    const existing = byId.get(record.id);
    if (existing) {
      byId.set(record.id, {
        ...existing,
        record,
        lastSeen: now,
        runIds: [...existing.runIds, runId],
      });
    } else {
      byId.set(record.id, {
        record,
        firstSeen: now,
        lastSeen: now,
        runIds: [runId],
        resolution: "open",
      });
    }
  }

  return {
    schemaVersion: 1,
    updatedAt: now,
    entries: [...byId.values()],
  };
}

/**
 * Publish the run's identity for a CI job to consume.
 *
 * The workflow has to upload and commit exactly one run's evidence, including
 * when the importer exited non-zero, so it needs the run id in a machine
 * readable form rather than scraped from log output. Written to GITHUB_OUTPUT
 * when running under Actions, and always to a pointer file so the same
 * information is available locally.
 */
export function publishRunPointer(
  runsDir: string,
  runId: string,
  runDir: string,
  githubOutputPath?: string
): void {
  writeFileSync(join(runsDir, "latest-run-id.txt"), `${runId}\n`);

  if (githubOutputPath) {
    // Appended, never truncated: other steps may already have written here.
    appendFileSync(
      githubOutputPath,
      `run_id=${runId}\nrun_dir=${runDir}\n`
    );
  }
}

export function summarizeRun(input: RunArtifactInput): RunSummary {
  return {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    passed: input.gates.passed,
    productionUpdated: input.productionUpdated,
    dryRun: input.dryRun,
    failures: input.gates.failures,
    warnings: input.gates.warnings,
    counts: input.counts,
    quarantinedCount: input.quarantined.length,
  };
}
