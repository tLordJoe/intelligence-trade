import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { digest, parseInstitutionalFiling, parseInstitutionalNotice, filingUrl, TableReconciliationError, type TableReconciliationIssue, type FilingReference, type InstitutionalFiling, type InstitutionalNotice } from "./parse.ts";
import { allowedSecUrl, references, type SubmissionColumns } from "./source.ts";
import { reconcileInstitutions } from "./reconcile.ts";

export interface EvidenceFile { file: string; sha256: string; url: string }
export interface InstitutionRun {
  schemaVersion: 1; source: "SEC"; runId: string; collectedAt: string; cik: string; from: string; to: string;
  complete: boolean; failure?: string; indexes: EvidenceFile[]; references: FilingReference[];
  filings: { reference: FilingReference; evidence?: EvidenceFile; failure?: string }[];
}
/** Source files are content-addressed; normalized results never serve as evidence. */
export function replayInstitutionRun(directory: string) {
  const run = JSON.parse(readFileSync(resolve(directory,"manifest.json"),"utf8")) as InstitutionRun;
  if (run.schemaVersion !== 1 || run.source !== "SEC" || !run.complete || !run.indexes.length) throw new Error("Incomplete institutional run cannot be reviewed");
  const read = (file: EvidenceFile) => {
    allowedSecUrl(file.url);
    if (!/^[a-f0-9]{64}\.raw$/.test(file.file) || file.file !== `${file.sha256}.raw`) throw new Error("Invalid evidence path");
    const bytes = readFileSync(resolve(directory,"raw",file.file));
    if (digest(bytes) !== file.sha256) throw new Error("Changed immutable SEC source bytes");
    return bytes.toString("utf8");
  };
  const inventory = new Map<string,FilingReference>();
  const expectedIndexes = new Set([`https://data.sec.gov/submissions/CIK${run.cik}.json`]);
  for (const file of run.indexes) {
    const source = JSON.parse(read(file));
    const columns: SubmissionColumns = source.filings?.recent ?? source;
    if (source.filings) {
      if (String(source.cik).padStart(10,"0") !== run.cik) throw new Error("Submissions CIK mismatch");
      for (const shard of source.filings.files ?? []) {
        if (shard.filingTo >= run.from && shard.filingFrom <= run.to) expectedIndexes.add(allowedSecUrl(`https://data.sec.gov/submissions/${shard.name}`));
      }
    }
    for (const ref of references(columns,run.cik,run.from,run.to)) {
      const old = inventory.get(ref.accession);
      if (old && JSON.stringify(old) !== JSON.stringify(ref)) throw new Error("Conflicting index entries");
      inventory.set(ref.accession,ref);
    }
  }
  if (run.indexes.length !== expectedIndexes.size || run.indexes.some(file => !expectedIndexes.has(file.url)) || new Set(run.indexes.map(f=>f.url)).size !== expectedIndexes.size) throw new Error("Historical submissions coverage incomplete");
  const ordered = (refs: FilingReference[]) => [...refs].sort((a,b)=>a.accession.localeCompare(b.accession));
  if (JSON.stringify(ordered([...inventory.values()])) !== JSON.stringify(ordered(run.references)) ||
      JSON.stringify(ordered(run.filings.map(f=>f.reference))) !== JSON.stringify(ordered(run.references))) throw new Error("Manifest references differ from SEC inventory");
  const filings: InstitutionalFiling[] = [], notices:InstitutionalNotice[] = [], failures: string[] = [], reconciliationIssues:TableReconciliationIssue[]=[];
  for (const item of run.filings) {
    if (!item.evidence || item.failure) { failures.push(item.reference.accession); continue; }
    if (item.evidence.url !== filingUrl(item.reference)) throw new Error("Source link differs from accession");
    try { if(item.reference.form.startsWith("13F-NT"))notices.push(parseInstitutionalNotice(read(item.evidence),item.reference));else filings.push(parseInstitutionalFiling(read(item.evidence),item.reference)); }
    catch (error) { if(error instanceof TableReconciliationError)reconciliationIssues.push(error.issue);failures.push(`${item.reference.accession}: ${String(error)}`); }
  }
  return { run, filings, notices, failures,reconciliationIssues };
}

export function institutionalCandidate(root: string, selectedRunIds?: string[]) {
  const directory = resolve(root,"data/institution-runs");
  const available = readdirSync(directory).filter(name=>/^institutions_[a-f0-9-]{36}$/.test(name)).sort();
  const names=selectedRunIds ? [...new Set(selectedRunIds)].sort() : available;
  if(!names.length||names.some(name=>!/^institutions_[a-f0-9-]{36}$/.test(name)||!available.includes(name)))throw new Error("Selected institutional run is missing or invalid");
  const runs = names.map(name=>replayInstitutionRun(resolve(directory,name)));
  if (!runs.length) throw new Error("No completed official collection runs");
  const blockedManagers = runs.filter(run=>run.failures.length).map(run=>run.run.cik);
  return { source: "SEC Form 13F" as const, runs: runs.map(({run,failures,reconciliationIssues})=>({ runId:run.runId, cik:run.cik, from:run.from, to:run.to, collectedAt:run.collectedAt, failures,reconciliationIssues })),
    notices:runs.flatMap(run=>run.notices),...reconcileInstitutions(runs.flatMap(run=>run.filings),blockedManagers,runs.flatMap(run=>run.notices)) };
}
