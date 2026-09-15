/** Sequential, resumable, bounded cohort collection. Never promotes public data. */
import { readFileSync,writeFileSync,renameSync,mkdirSync,existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { validatePlan,assessManagerRun,type CohortPlan } from "../src/lib/institutions/cohort.ts";
import { SecReader,sourceFailure } from "../src/lib/institutions/source.ts";
const root=resolve(import.meta.dirname,".."),args=process.argv.slice(2),arg=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
const id=arg("--id");if(!id||!/^[a-z0-9][a-z0-9-]{0,70}$/.test(id))throw new Error("Provide a stable --id using lowercase letters, digits and hyphens");
const file=resolve(root,"data/institution-cohorts",`${id}.json`),resume=args.includes("--resume");
type Attempt={runId?:string;at:string;result?:ReturnType<typeof assessManagerRun>;failure?:string};
type State={schemaVersion:1;id:string;plan:CohortPlan;planHash:string;attempts:Record<string,Attempt[]>;updatedAt:string;publicChanged:false};
let state:State;
if(resume){state=JSON.parse(readFileSync(file,"utf8"));if(state.id!==id||state.schemaVersion!==1||state.planHash!==validatePlan(state.plan))throw new Error("Resume plan changed or invalid");}
else {
  if(existsSync(file))throw new Error("Cohort already exists; use --resume or a new ID");
  const plan:CohortPlan={universe:JSON.parse(readFileSync(resolve(root,"data/institution-manager-universe.json"),"utf8")),from:arg("--from")??"",to:arg("--to")??"",previousPeriod:arg("--previous-period")??"",currentPeriod:arg("--current-period")??"",maxFilings:Number(arg("--max-filings")??40)};
  state={schemaVersion:1,id,plan,planHash:validatePlan(plan),attempts:{},updatedAt:new Date().toISOString(),publicChanged:false};
}
const maximum=Number(arg("--max-managers")??state.plan.universe.managers.length);
if(!Number.isSafeInteger(maximum)||maximum<1||maximum>state.plan.universe.managers.length)throw new Error("Invalid --max-managers");
if(!args.includes("--replay-only"))new SecReader(); // Verify contact before network work.
mkdirSync(resolve(root,"data/institution-cohorts"),{recursive:true});
const lock=`${file}.lock`;
writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}),{flag:"wx"});
const checkpoint=()=>{state.updatedAt=new Date().toISOString();const temporary=`${file}.${randomUUID()}.next`;writeFileSync(temporary,JSON.stringify(state,null,2)+"\n",{flag:"wx"});renameSync(temporary,file);};
// Lock retained on crash: inspect it before explicitly removing a stale lock.
try {
  // Re-read under the lock: a prior process may have checkpointed between the
  // initial argument validation and lock acquisition.
  if(resume){state=JSON.parse(readFileSync(file,"utf8"));if(state.id!==id||state.schemaVersion!==1||state.planHash!==validatePlan(state.plan))throw new Error("Resume plan changed or invalid");}
  else if(existsSync(file))throw new Error("Cohort was created concurrently; use --resume");
  checkpoint();let attempted=0;
  for(const manager of state.plan.universe.managers){
    const history=state.attempts[manager.cik]??[],last=history.at(-1);
    if(last?.result&&last.runId){
      try{last.result=assessManagerRun(resolve(root,"data/institution-runs",last.runId),manager,state.plan);if(last.result.status==="ready_for_review"){checkpoint();continue;}}
      catch(error){last.failure=sourceFailure(error);delete last.result;}
    }
    if(args.includes("--replay-only"))continue;
    if(last?.result?.status==="held"&&!args.includes("--retry-held"))continue;
    if(attempted>=maximum)break;attempted++;
    const attempt:Attempt={at:new Date().toISOString()};state.attempts[manager.cik]=[...history,attempt];checkpoint();
    console.log(`Collecting ${manager.name} (${manager.cik})`);
    const child=spawnSync(process.execPath,["--experimental-strip-types",resolve(root,"scripts/import-institutions.ts"),"--cik",manager.cik,"--from",state.plan.from,"--to",state.plan.to,"--max-filings",String(state.plan.maxFilings)],{cwd:root,env:process.env,encoding:"utf8",timeout:30*60*1000,maxBuffer:2*1024*1024});
    try {
      const output=child.stdout?.trim().split("\n").at(-1),report=output?JSON.parse(output):null;
      if(report?.runId&&/^institutions_[a-f0-9-]{36}$/.test(report.runId))attempt.runId=report.runId;
      if(child.status!==0||!attempt.runId)throw new Error(report?.failure??child.error?.message??`Collector failed: ${child.status}; ${child.stderr?.slice(-600)}`);
      attempt.result=assessManagerRun(resolve(root,"data/institution-runs",attempt.runId),manager,state.plan);
    }catch(error){attempt.failure=sourceFailure(error);process.exitCode=1;}
    checkpoint();if(attempt.failure)break; // No repeated requests following a transport failure.
  }
  const latest=state.plan.universe.managers.map(m=>({cik:m.cik,name:m.name,attempt:state.attempts[m.cik]?.at(-1)??null}));
  console.log(JSON.stringify({id,cohortManagers:latest.length,readyForReview:latest.filter(m=>m.attempt?.result?.status==="ready_for_review").length,held:latest.filter(m=>m.attempt?.result?.status==="held").length,failed:latest.filter(m=>m.attempt?.failure).length,pending:latest.filter(m=>!m.attempt).length,report:file,publicChanged:false},null,2));
}finally{
  // Only remove this process's exact lock, never evidence or another run.
  const {unlinkSync}=await import("node:fs");unlinkSync(lock);
}
