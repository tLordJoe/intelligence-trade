import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { parseSenateReport } from "./parse.ts";
import { buildSenateCandidate, senateAmendmentWorklist, senatePeopleFromRoster, type SenateFiling, type SenatePerson } from "./candidate.ts";
import { officialSenateUrl, type SenateReportReference } from "./source.ts";

/** Reparse immutable official bytes; saved normalized JSON is not trusted. */
export function loadSenateCandidateReview(root: string) {
  const directory = resolve(root, "data/senate-runs");
  const filings: SenateFiling[] = [];
  const runs: { runId: string; from: string; to: string; reports: number }[] = [];
  const skippedRuns: string[] = [];
  const heldReferences = new Map<string, SenateReportReference>();
  const unresolved = new Map<string, { id: string; filer: string; sourceUrl: string; reason: string }>();
  for (const runId of readdirSync(directory).filter(name => /^senate_[A-Za-z0-9_-]+$/.test(name)).sort()) {
    const run = resolve(directory, runId);
    if (!existsSync(resolve(run, "summary.json"))) { skippedRuns.push(runId); continue; }
    const summary = JSON.parse(readFileSync(resolve(run, "summary.json"), "utf8"));
    if (summary.runId !== runId || summary.source !== "senate-efd" || !summary.indexComplete || summary.fatal) { skippedRuns.push(runId); continue; }
    const index: SenateReportReference[] = JSON.parse(readFileSync(resolve(run, "index.json"), "utf8"));
    if (index.length !== summary.sourceExpected || new Set(index.map(ref => ref.id)).size !== index.length) throw new Error("Senate index count or identity mismatch");
    runs.push({ runId, from: summary.from, to: summary.to, reports: index.length });
    for (const reference of index) {
      if (!/^[a-f0-9-]{36}$/.test(reference.id)) throw new Error("Invalid Senate report identity");
      officialSenateUrl(reference.url);
      const hold = (reason: string) => { heldReferences.set(reference.id, reference); unresolved.set(reference.id, { id: reference.id,
        filer: `${reference.firstName} ${reference.lastName}`, sourceUrl: reference.url, reason }); };
      if (reference.format !== "electronic") { hold("paper_or_unsupported_report_requires_review"); continue; }
      const artifacts = readdirSync(resolve(run, "raw")).filter(name => new RegExp(`^${reference.id}-[a-f0-9]{64}\\.html$`).test(name));
      if (artifacts.length !== 1) { hold("source_artifact_missing_or_ambiguous"); continue; }
      const bytes = readFileSync(resolve(run, "raw", artifacts[0]));
      if (createHash("sha256").update(bytes).digest("hex") !== artifacts[0].slice(reference.id.length + 1, -5)) throw new Error("Senate archived source hash mismatch");
      try { filings.push(parseSenateReport(bytes.toString("utf8"), reference)); }
      catch { hold("source_parse_requires_review"); }
    }
  }
  if (!runs.length) throw new Error("No complete Senate source enumeration available");
  const rosterPath = resolve(root, "data/senate-identity-roster.json");
  let people: SenatePerson[] = [];
  if (existsSync(rosterPath)) {
    const roster = JSON.parse(readFileSync(rosterPath, "utf8"));
    const source = readFileSync(resolve(root, "data/senate-roster-source.json"));
    if (roster.schemaVersion !== 1 || !Array.isArray(roster.people) ||
        roster.source !== "https://unitedstates.github.io/congress-legislators/legislators-current.json" ||
        createHash("sha256").update(source).digest("hex") !== roster.sourceSha256) throw new Error("Senate identity-source evidence changed");
    people = senatePeopleFromRoster(JSON.parse(source.toString("utf8")));
    if (JSON.stringify(people) !== JSON.stringify(roster.people)) throw new Error("Senate derived identity roster changed");
  }
  const master = JSON.parse(readFileSync(resolve(root, "data/security-master.json"), "utf8"));
  const ledger = (name: string) => existsSync(resolve(root, "data", name)) ? JSON.parse(readFileSync(resolve(root, "data", name), "utf8")) : [];
  const candidate = buildSenateCandidate(filings, people, master, ledger("senate-amendment-reviews.json"), ledger("senate-security-reviews.json"), [...heldReferences.values()]);
  return { ...candidate, runs, skippedRuns, unresolved: [...unresolved.values()], rosterAvailable: people.length > 0,
    amendmentWorklist: senateAmendmentWorklist(candidate.filings),
    from: runs.map(run => run.from).sort()[0], to: runs.map(run => run.to).sort().at(-1)! };
}
