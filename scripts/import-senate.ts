#!/usr/bin/env node --experimental-strip-types
/** Source evidence collector only. Never writes congress-live.json or activates a source tab. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { SenateSession, SENATE_NOTICE_SHA256, isoDate, paperScanUrls, fetchSenateScan, type SenateReportReference } from "../src/lib/senate/source.ts";
import { parseSenateReport } from "../src/lib/senate/parse.ts";

const args = process.argv.slice(2);
const option = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  if (!args.includes("--acknowledge-source-use")) throw new Error("Source-use acceptance must be explicitly authorized; pass --acknowledge-source-use only after approval");
  const from = isoDate(option("--from") ?? ""); const to = isoDate(option("--to") ?? "");
  if (from > to || from < "2012-01-01" || to > new Date().toISOString().slice(0, 10)) throw new Error("Invalid filing window");
  const runId = `senate_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const directory = resolve(root, "data/senate-runs", runId);
  mkdirSync(resolve(directory, "raw"), { recursive: true });
  const write = (path: string, value: unknown) => writeFileSync(resolve(directory, path), JSON.stringify(value, null, 2));
  const session = new SenateSession();
  const reports: SenateReportReference[] = []; const failures: { id: string; reason: string }[] = [];
  const filings: ReturnType<typeof parseSenateReport>[] = [];
  let expected: number | null = null; let complete = false; let fatal: string | null = null;
  write("request.json", { runId, source: "senate-efd", from, to, filerTypes: ["Senator"], reportTypes: ["Periodic Transactions"],
    accessAcknowledgmentSupplied: true, noticeSha256: SENATE_NOTICE_SHA256, websitePublicationApproved: false, apiRedistributionApproved: false });
  try {
    await session.acceptAccess(true);
    const ids = new Set<string>();
    for (let start = 0; start < 100_000; start += 100) {
      const page = await session.searchPage(from, to, start, raw => writeFileSync(resolve(directory, `search-${start}.json`), raw));
      if (expected !== null && expected !== page.total) throw new Error("Senate index changed during pagination; rerun required");
      expected = page.total;
      if (page.reports.length > 100 || page.reports.some(r => ids.has(r.id))) throw new Error("Duplicate or oversized Senate index page");
      for (const reference of page.reports) {
        if (ids.has(reference.id)) throw new Error("Duplicate Senate report within index page");
        ids.add(reference.id); reports.push(reference);
      }
      if (reports.length === expected) { complete = true; break; }
      if (!page.reports.length || reports.length > expected) throw new Error("Senate pagination is incomplete or inconsistent");
    }
    if (!complete) throw new Error("Senate pagination safety cap reached");
    write("index.json", reports);
    console.log(`Enumerated ${reports.length} Senate reports for ${from} through ${to}`);
    for (const reference of reports) {
      try {
        const html = await session.report(reference);
        const digest = createHash("sha256").update(html).digest("hex");
        const path = `raw/${reference.id}-${digest}.html`;
        writeFileSync(resolve(directory, path), html);
        if (reference.format === "paper") {
          const pages: { page: number; sourceUrl: string; sha256: string; path: string }[] = [];
          for (const url of paperScanUrls(html)) {
            await new Promise(resolve => setTimeout(resolve, 1100));
            const bytes = await fetchSenateScan(url);
            const sha256 = createHash("sha256").update(bytes).digest("hex");
            const imagePath = `raw/${reference.id}-page${pages.length + 1}-${sha256}.${new URL(url).pathname.split('.').at(-1)}`;
            writeFileSync(resolve(directory, imagePath), bytes);
            pages.push({ page: pages.length + 1, sourceUrl: url, sha256, path: imagePath });
          }
          write(`${reference.id}.paper.json`, { reference, runId, rawArtifactPath: path, pages, status: "awaiting_scan_extraction", publicationApproved: false });
          throw new Error(`Archived all ${pages.length} scanned pages; OCR and source review still required`);
        }
        const parsed = parseSenateReport(html, reference);
        filings.push(parsed);
        write(`${reference.id}.json`, { ...parsed, rawArtifactPath: path, runId });
        console.log(`${filings.length}/${reports.length}: ${parsed.rows.length} source rows`);
      } catch (error) {
        failures.push({ id: reference.id, reason: error instanceof Error ? error.message : "Unknown collection error" });
      }
    }
  } catch (error) { fatal = error instanceof Error ? error.message : "Unknown collection error"; }
  const warnings = filings.flatMap(f => f.warnings.map(warning => ({ id: f.reference.id, warning })));
  const rowIssues = filings.flatMap(f => f.rows.filter(r => r.issues.length).map(r => ({ id: r.id, issues: r.issues })));
  const summary = { runId, from, to, source: "senate-efd", sourceExpected: expected, indexComplete: complete,
    selected: reports.length, parsed: filings.length, sourceRows: filings.reduce((n, f) => n + f.rows.length, 0),
    listedSecurityCandidatesBeforeIdentityReview: filings.reduce((n, f) => n + f.rows.filter(r => r.listedSecurityCandidate).length, 0),
    failures, warnings, rowIssues, fatal, collectionPassed: complete && fatal === null && failures.length === 0,
    publicationApproved: false, finishedAt: new Date().toISOString() };
  write("summary.json", summary);
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.collectionPassed) process.exitCode = 1;
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Senate import failed"); process.exitCode = 1; });
