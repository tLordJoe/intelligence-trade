/** Explicit publication of usable collected records, not a completeness gate. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadImportedInsiderReview } from "../src/lib/form4/imported-review.ts";
import { loadInsiderCandidateReview } from "../src/lib/form4/candidate-review.ts";
import { prepareCollectedInsiderRelease, insiderPayloadHash, readApprovedInsiderRelease } from "../src/lib/form4/public-view.ts";
import { writeDisclosureRelease } from "../src/lib/disclosure-storage.ts";
const args=process.argv.slice(2),arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const imported=arg("--imported-data"),current=arg("--current-data"),reviewer=arg("--reviewed-by");
if(!imported||!current||!reviewer?.trim()||reviewer.startsWith("--")||!args.includes("--acknowledge-incomplete-history"))throw new Error("Provide both source directories, reviewer, and incomplete-history acknowledgement");
const root=resolve(import.meta.dirname,"..");
const history=loadImportedInsiderReview(root,resolve(imported));
const recent=loadInsiderCandidateReview(root,{dataDirectory:resolve(current)});
const release=prepareCollectedInsiderRelease([history,recent]);
release.payload.limitations+=" Historical rows retain their successful source-import interpretation and manifest hashes; their original XML was not freshly replayed for this release. The recent collection was replayed from archived SEC XML.";
release.approval={reviewedBy:reviewer.trim(),reviewedAt:new Date().toISOString(),payloadSha256:insiderPayloadHash(release.payload),boundedCoverageAcknowledged:true};
const approved=readApprovedInsiderRelease(release)!;
mkdirSync(resolve(root,"src/lib/published-data"),{recursive:true});
const storage=writeDisclosureRelease(resolve(root,"src/lib/insider-live.json"),release);
const retained=new Set(approved.records.map(r=>r.id));
const audit={releasedAt:new Date().toISOString(),reviewer:reviewer.trim(),publicationMode:"available_collected_filings",payloadSha256:release.approval.payloadSha256,
  publicRows:approved.records.length,companies:new Set(approved.records.map(r=>r.issuerCik)).size,
  historical:{archiveFilings:history.archiveFilings,importJournalVerifiedFilings:history.filingCount,importRuns:history.runs.map(r=>r.runId),unavailableImportRuns:history.unavailableImportRuns,eligibleRowsBeforeCombinedHolds:history.records.length,verificationBasis:history.verificationBasis},
  recent:{sourceDocumentsReplayed:recent.filingCount,eligibleRowsBeforeCombinedHolds:recent.records.length,importRuns:recent.runs.map(r=>r.runId)},
  crossCollectionHeldRows:recent.records.filter(r=>!retained.has(r.id)).map(r=>({id:r.id,issuerCik:r.issuerCik,reason:"Known unresolved historical issuer correction"})),
  heldIssuers:approved.heldIssuers,excluded:approved.excluded,collectionScopes:approved.schemaVersion===3?approved.collectionScopes:[],storage};
writeFileSync(resolve(root,"docs/available-insiders-release-2026-10-17.json"),JSON.stringify(audit,null,2)+"\n");
console.log(JSON.stringify({publishedLocally:true,deployed:false,publicRows:audit.publicRows,companies:audit.companies,historyFilings:history.filingCount,currentSourceReplays:recent.filingCount,crossCollectionHeldRows:audit.crossCollectionHeldRows.length}));
