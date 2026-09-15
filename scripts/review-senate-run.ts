/** Offline reparse from hash-verified source bytes; does not trust saved normalized rows. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseSenateReport } from "../src/lib/senate/parse.ts";
import type { SenateReportReference } from "../src/lib/senate/source.ts";
const runId = process.argv[2];
if (!/^senate_[A-Za-z0-9_-]+$/.test(runId ?? "")) throw new Error("Supply a Senate run identity");
const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../data/senate-runs", runId);
const summary = JSON.parse(readFileSync(resolve(directory, "summary.json"), "utf8"));
const index: SenateReportReference[] = JSON.parse(readFileSync(resolve(directory, "index.json"), "utf8"));
if (summary.runId !== runId || !summary.indexComplete || summary.sourceExpected !== index.length) throw new Error("Incomplete Senate enumeration");
const parsed = []; const unresolved = [];
for (const reference of index) {
  if (reference.format !== "electronic") { unresolved.push({ id: reference.id, reason: "scan_extraction_review_required" }); continue; }
  const normalized = resolve(directory, `${reference.id}.json`);
  const artifacts = readdirSync(resolve(directory, "raw")).filter(name => new RegExp(`^${reference.id}-[a-f0-9]{64}\\.html$`).test(name));
  if (artifacts.length !== 1) { unresolved.push({ id: reference.id, reason: "raw_artifact_missing_or_ambiguous" }); continue; }
  const artifact = readdirSync(directory).includes(`${reference.id}.json`) ? JSON.parse(readFileSync(normalized, "utf8")) :
    { rawArtifactPath: `raw/${artifacts[0]}`, documentSha256: artifacts[0].slice(reference.id.length + 1, -5) };
  const rawPath = resolve(directory, artifact.rawArtifactPath);
  if (!rawPath.startsWith(resolve(directory, "raw") + sep)) throw new Error("Invalid Senate raw artifact path");
  const bytes = readFileSync(rawPath);
  if (createHash("sha256").update(bytes).digest("hex") !== artifact.documentSha256) throw new Error("Senate source hash mismatch");
  parsed.push(parseSenateReport(bytes.toString("utf8"), reference));
}
console.log(JSON.stringify({ runId, from: summary.from, to: summary.to, reports: index.length, parsed: parsed.length,
  sourceRows: parsed.reduce((n, p) => n + p.rows.length, 0), unresolved,
  amendmentReports: parsed.filter(p => p.amendment).map(p => ({ id: p.reference.id, filer: p.filer, title: p.title })),
  rowIssues: parsed.flatMap(p => p.rows.filter(r => r.issues.length).map(r => ({ id: r.id, issues: r.issues }))),
  sourceWarnings: parsed.flatMap(p => p.warnings.map(warning => ({ id: p.reference.id, warning }))),
  publicationApproved: false }, null, 2));
