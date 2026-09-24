import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { institutionalCandidate } from "../src/lib/institutions/archive.ts";
import { approvedInstitutions, payloadHash, limitations, type InstitutionPayload, type InstitutionRelease } from "../src/lib/institutions/release.ts";
const root=resolve(import.meta.dirname,".."), args=process.argv.slice(2);
const candidate=institutionalCandidate(root);
const payload:InstitutionPayload={schemaVersion:1,source:"SEC Form 13F",semantics:"quarter_end_reported_holdings",coverage:candidate.runs.map(({cik,from,to,collectedAt})=>({cik,from,to,collectedAt})),limitations,filings:candidate.active};
const path=resolve(root,"data/institution-candidate.json");
if(args.includes("--promote")){
  const i=args.indexOf("--reviewed-by"), reviewer=i>=0?args[i+1]:"";
  if(!reviewer?.trim()||reviewer.startsWith("--")||!args.includes("--acknowledge-partial-coverage"))throw new Error("Explicit review identity and partial coverage acknowledgement required");
  const prepared=JSON.parse(readFileSync(path,"utf8"));
  if(prepared.sha256!==payloadHash(payload)||JSON.stringify(prepared.payload)!==JSON.stringify(payload))throw new Error("Candidate changed; rebuild and review source replay");
  // An explicit per-filing ledger binds validation to raw official bytes and units.
  const reviews=JSON.parse(readFileSync(resolve(root,"data/institution-filing-reviews.json"),"utf8")) as {accession:string;sourceSha256:string;reviewedBy:string;reviewedAt:string;evidenceNote:string;unitsVerified:boolean}[];
  for(const filing of payload.filings){const matches=reviews.filter(r=>r.accession===filing.reference.accession);
    if(matches.length!==1||matches[0].sourceSha256!==filing.sourceSha256||!matches[0].reviewedBy?.trim()||!Number.isFinite(Date.parse(matches[0].reviewedAt))||!matches[0].evidenceNote?.trim()||matches[0].unitsVerified!==true)throw new Error(`Source/unit review required: ${filing.reference.accession}`);}
  const release:InstitutionRelease={payload,approval:{reviewedBy:reviewer.trim(),reviewedAt:new Date().toISOString(),sha256:payloadHash(payload),partialCoverageAcknowledged:true}};
  approvedInstitutions(release);
  const target=resolve(root,"src/lib/institutions-live.json"), temporary=`${target}.next`;
  writeFileSync(temporary,JSON.stringify(release,null,2)+"\n",{flag:"wx"});renameSync(temporary,target);
  console.log("Reviewed institutional data promoted locally; nothing deployed.");
}else{
  writeFileSync(path,JSON.stringify({payload,sha256:payloadHash(payload),held:candidate.held,notices:candidate.notices,runs:candidate.runs,approval:null},null,2)+"\n");
  console.log(JSON.stringify({eligibleFilings:payload.filings.length,heldFamilies:candidate.held.length,publicChanged:false}));
}
