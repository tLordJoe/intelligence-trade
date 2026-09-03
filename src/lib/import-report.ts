/**
 * Human-readable import report.
 *
 * The August 2026 incident ran for eight days because "exit code 0" was the
 * only thing anyone saw. This renders what actually happened — what was
 * fetched, what was accepted, what was held back and whether production moved —
 * so the state of the pipeline can be read without opening the code.
 */

import type { ImportCounts } from "./congress-schema.ts";
import type { RunGateResult } from "./congress-gates.ts";

export interface ImportReportInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  sourceUrl: string;
  counts: ImportCounts;
  gates: RunGateResult;
  /** Whether the archive file was actually written. */
  productionUpdated: boolean;
  /** Warning codes across accepted records, most frequent first. */
  warningTally: Array<[string, number]>;
  /** Quarantined records, summarized for review. */
  quarantineSamples: Array<{ id: string; ticker: string; reasons: string[] }>;
}

function line(label: string, value: string | number): string {
  return `  ${label.padEnd(28)} ${value}`;
}

export function renderImportReport(input: ImportReportInput): string {
  const { counts, gates } = input;
  const out: string[] = [];

  out.push("=".repeat(64));
  out.push("OUTFOX HOUSE DISCLOSURE IMPORT");
  out.push("=".repeat(64));
  out.push(line("run id", input.runId));
  out.push(line("started", input.startedAt));
  out.push(line("finished", input.finishedAt));
  out.push(line("source", input.sourceUrl));
  out.push("");

  out.push("SOURCE AND PARSE");
  out.push(line("filings advertised", counts.sourceFilings));
  out.push(line("filings selected", counts.selectedFilings));
  out.push(
    line(
      "filings downloaded",
      `${counts.downloadedFilings}${
        counts.selectedFilings
          ? ` (${Math.round((counts.downloadedFilings / counts.selectedFilings) * 100)}%)`
          : ""
      }`
    )
  );
  out.push(
    line(
      "filings parsed",
      `${counts.parsedFilings}${
        counts.downloadedFilings
          ? ` (${Math.round((counts.parsedFilings / counts.downloadedFilings) * 100)}%)`
          : ""
      }`
    )
  );
  out.push(line("parse failures", counts.failedParses));
  out.push(line("filings with zero rows", counts.zeroRowFilings));
  out.push(line("  scanned / unreadable", counts.scannedFilings));
  out.push(line("  unexplained (blocking)", counts.suspiciousZeroRowFilings));
  out.push(line("transaction rows parsed", counts.parsedRecords));
  out.push(line("  rows from wrapped rows", counts.wrappedRows));
  out.push("");

  out.push("VALIDATION");
  out.push(line("accepted (clean)", counts.accepted - counts.warned));
  out.push(line("accepted with warnings", counts.warned));
  out.push(line("quarantined", counts.quarantined));
  out.push(line("duplicate ids collapsed", counts.duplicates));
  out.push(line("missing party", counts.missingParty));
  out.push(line("missing ticker", counts.missingTicker));
  out.push(line("missing filing url", counts.missingFilingUrl));
  out.push(line("amount not available", counts.amountsUnknown));
  out.push(line("  of which unreadable", counts.amountParseFailures));
  out.push("");

  out.push("ARCHIVE");
  out.push(line("records before", counts.archiveBefore));
  out.push(line("added", counts.added));
  out.push(line("refreshed (unchanged)", counts.refreshed));
  out.push(line("revised (corrected)", counts.revised));
  out.push(line("records after", counts.archiveAfter));
  out.push("");

  if (input.warningTally.length) {
    out.push("WARNING CODES");
    for (const [code, n] of input.warningTally) out.push(line(code, n));
    out.push("");
  }

  if (input.quarantineSamples.length) {
    out.push(`QUARANTINED (${counts.quarantined} total, showing up to 10)`);
    for (const q of input.quarantineSamples.slice(0, 10)) {
      out.push(`  ${q.id.padEnd(18)} ${q.ticker.padEnd(8)} ${q.reasons.join(", ")}`);
    }
    out.push("");
  }

  out.push("GATES");
  out.push(line("result", gates.passed ? "PASS" : "FAIL"));
  for (const f of gates.failures) out.push(`  FAILURE   ${f}`);
  for (const w of gates.warnings) out.push(`  warning   ${w}`);
  out.push("");

  out.push("OUTCOME");
  out.push(
    line(
      "production updated",
      input.productionUpdated
        ? "yes — archive written"
        : "no — previous known-good archive retained"
    )
  );
  out.push("=".repeat(64));

  return out.join("\n");
}

/** Count warning codes across records, most frequent first. */
export function tallyWarnings(
  records: Array<{ warnings: string[] }>
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const warning of record.warnings ?? []) {
      // Collapse parameterized codes so the tally stays readable.
      const code = warning.split(":")[0];
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
