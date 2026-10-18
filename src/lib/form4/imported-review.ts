/** Publishing already validated imports does not require downloading their
 * original XML again. Bind the persisted interpretation to the successful
 * import journal, source manifest and content-checked archive. This is distinct
 * from candidate-review's fresh XML replay and is identified as such in audit. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { readCandidateFile } from "./candidate-storage.ts";
import { readInsiderUniverse, insiderUniverseHash } from "./universe.ts";
import { reconcileForm4ByIssuer } from "./reconcile.ts";
import { buildInsiderActivity, type InsiderSecurityIdentity } from "./activity.ts";

export function loadImportedInsiderReview(root: string, directory: string) {
  const data=resolve(directory),archive=readCandidateFile(resolve(data,"form4-candidate.json"));
  const local=(path:string)=>existsSync(path)&&statSync(path).blocks>0;
  const runs=archive.runIds.flatMap(runId=>{
    if(!/^form4_[A-Za-z0-9_-]+$/.test(runId))throw new Error("Invalid imported run id");
    const run=resolve(data,"form4-runs",runId),names=["summary.json","manifest.json","selection.json","universe.json"];
    if(!names.every(name=>local(resolve(run,name))))return [];
    const read=(name:string)=>JSON.parse(readFileSync(resolve(run,name),"utf8"));
    const summary=read("summary.json"),selection=read("selection.json"),universe=readInsiderUniverse(read("universe.json"));
    if(summary.source!=="edgar"||summary.runId!==runId||summary.passed!==true||summary.promoted!==true||!summary.enumeration?.complete||summary.gateFailures?.length!==0)throw new Error("Imported run did not pass source gates");
    const universeSha256=insiderUniverseHash(universe);
    if(selection.universeSha256!==universeSha256||!Array.isArray(selection.allAccessions)||!Array.isArray(selection.batchAccessions))throw new Error("Imported selection/universe mismatch");
    const manifest=read("manifest.json") as {accessionNumber:string;sha256:string;documentUrl:string}[];
    if(manifest.length!==summary.counts.selected||new Set(manifest.map(f=>f.accessionNumber)).size!==manifest.length||JSON.stringify(manifest.map(f=>f.accessionNumber))!==JSON.stringify(selection.batchAccessions)||manifest.some(f=>!selection.allAccessions.includes(f.accessionNumber)))throw new Error("Imported source manifest mismatch");
    const ciks=[...new Set(universe.entries.map(e=>e.cik))];
    return [{runId,from:summary.selection.from as string,to:summary.selection.to as string,issuers:summary.selection.issuers as string[],selected:manifest.length,
      manifest:new Map(manifest.map(f=>[f.accessionNumber,f])),universeSha256,universeSize:ciks.length,ciks,expected:selection.allAccessions as string[]}];
  });
  if(!runs.length)throw new Error("No locally available successful import journals");
  const byRun=new Map(runs.map(run=>[run.runId,run])),known=new Set<string>();
  for(const filing of archive.filings){
    const run=byRun.get(filing.importRunId);if(!run)continue;
    const source=run.manifest.get(filing.accessionNumber);
    if(filing.source!=="sec-form4"||filing.validation!=="valid"||!source||source.sha256!==filing.documentSha256||source.documentUrl!==filing.documentUrl||filing.id!==`${filing.accessionNumber}::${filing.documentSha256}`)throw new Error("Stored filing differs from successful source import");
    known.add(filing.id);
  }
  // Use the entire archive for correction holds, including filings outside the
  // published subset. An unavailable batch cannot conceal a known amendment.
  const reconciled=reconcileForm4ByIssuer(archive.filings,[],[]);
  const selected={...reconciled.eligible,activeRows:reconciled.eligible.activeRows.filter(({filing})=>known.has(filing.id))};
  const master=JSON.parse(readFileSync(resolve(root,"data/security-master.json"),"utf8"));
  const from=runs.map(r=>r.from).sort()[0],to=runs.map(r=>r.to).sort().at(-1)!;
  const activity=buildInsiderActivity(selected,Object.values(master.entries) as InsiderSecurityIdentity[],"1900-01-01",to);
  const collected=new Set(archive.filings.filter(f=>known.has(f.id)).map(f=>f.accessionNumber));
  return {updatedAt:archive.updatedAt,filingCount:known.size,sourceRowCount:selected.activeRows.length,from,to,
    runs:runs.map(({runId,from,to,issuers,selected})=>({runId,from,to,issuers,selected})),issuers:[...new Set(runs.flatMap(r=>r.issuers))],
    universeCiks:[...new Set(runs.flatMap(r=>r.ciks))],coverage:runs.map(r=>({from:r.from,to:r.to,universeSha256:r.universeSha256,universeSize:r.universeSize,expectedFilings:r.expected.length,missingAccessions:r.expected.filter(id=>!collected.has(id))})),
    blockers:reconciled.blockers,heldIssuers:reconciled.heldIssuers,records:activity.records,excluded:activity.excluded,publicationApproved:false as const,
    verificationBasis:"Persisted successful import checks, source-manifest hashes, and hash-verified candidate chunks. Original historical XML was not freshly replayed for this release because cloud reads timed out.",
    archiveFilings:archive.filings.length,unavailableImportRuns:archive.runIds.length-runs.length};
}
