import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { institutionalCandidate } from "../src/lib/institutions/archive.ts";
import { assessManagerRun, validatePlan, type CohortPlan, type ManagerUniverse } from "../src/lib/institutions/cohort.ts";
import { approvedInstitutions, payloadHash, limitations, type InstitutionPayload, type InstitutionRelease } from "../src/lib/institutions/release.ts";
const root=resolve(import.meta.dirname,".."), args=process.argv.slice(2);
const value=(key:string)=>{const index=args.indexOf(key);return index<0?undefined:args[index+1];};
const cohortId=value("--cohort");
if(!cohortId||!/^[a-z0-9][a-z0-9-]{0,70}$/.test(cohortId))throw new Error("Provide the reviewed --cohort id");
type CohortState={schemaVersion:1;id:string;plan:CohortPlan&{universe:ManagerUniverse};planHash:string;attempts:Record<string,{runId?:string}[]>};
const cohort:CohortState=JSON.parse(readFileSync(resolve(root,"data/institution-cohorts",`${cohortId}.json`),"utf8"));
if(cohort.schemaVersion!==1||cohort.id!==cohortId||cohort.planHash!==validatePlan(cohort.plan))throw new Error("Invalid or changed institutional cohort");
const assessments=cohort.plan.universe.managers.map(manager=>{
  const runId=cohort.attempts[manager.cik]?.at(-1)?.runId;
  if(!runId)return {manager,runId:null,result:null};
  return {manager,runId,result:assessManagerRun(resolve(root,"data/institution-runs",runId),manager,cohort.plan)};
});
const eligible=assessments.filter(item=>item.result?.status==="ready_for_review"&&item.runId).map(item=>item.runId!);
if(!eligible.length)throw new Error("Cohort has no managers ready for review");
const candidate=institutionalCandidate(root,eligible);
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
  const excludedManagers=assessments.filter(item=>item.result?.status!=="ready_for_review").map(item=>({cik:item.manager.cik,name:item.manager.name,status:item.result?.status??"not_collected",reason:item.result?.reason??"No completed run"}));
  writeFileSync(path,JSON.stringify({cohortId,payload,sha256:payloadHash(payload),held:candidate.held,excludedManagers,notices:candidate.notices,runs:candidate.runs,approval:null},null,2)+"\n");
  console.log(JSON.stringify({cohortId,eligibleManagers:eligible.length,excludedManagers:excludedManagers.length,eligibleFilings:payload.filings.length,heldFamilies:candidate.held.length,publicChanged:false}));
}
