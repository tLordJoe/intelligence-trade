import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { date, digest } from "./parse.ts";
import { replayInstitutionRun } from "./archive.ts";
import { validateManagerCorpus } from "./validation.ts";

export interface ManagerCandidate {cik:string;name:string;secNames:string[];selection:string}
export interface ManagerUniverse {schemaVersion:1;id:string;scope:string;managers:ManagerCandidate[]}
export interface CohortPlan {universe:ManagerUniverse;from:string;to:string;previousPeriod:string;currentPeriod:string;maxFilings:number}
const normalizedName=(name:string)=>name.toUpperCase().replace(/[^A-Z0-9]/g,"");
export function validatePlan(plan:CohortPlan) {
  const {universe,from,to,previousPeriod,currentPeriod,maxFilings}=plan;
  [from,to,previousPeriod,currentPeriod].forEach(date);
  if(from>to||currentPeriod>to)throw new Error("Invalid collection period");
  if(!/-(03-31|06-30|09-30|12-31)$/.test(previousPeriod)||!/-(03-31|06-30|09-30|12-31)$/.test(currentPeriod))throw new Error("Periods must be quarter ends");
  const next=new Date(`${previousPeriod}T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+4,0);
  if(next.toISOString().slice(0,10)!==currentPeriod||from>previousPeriod)throw new Error("Need consecutive quarters and a filing window beginning no later than the earlier quarter end");
  if(universe.schemaVersion!==1||!universe.id||!universe.scope||!universe.managers.length||new Set(universe.managers.map(m=>m.cik)).size!==universe.managers.length)throw new Error("Invalid or duplicate manager universe");
  for(const m of universe.managers)if(!/^\d{10}$/.test(m.cik)||Number(m.cik)===0||!m.name||!m.selection||!m.secNames.length||m.secNames.some(n=>!normalizedName(n)))throw new Error("Incomplete manager identity declaration");
  if(!Number.isSafeInteger(maxFilings)||maxFilings<1||maxFilings>500)throw new Error("Invalid filing limit");
  return digest(JSON.stringify(plan));
}
export function assessManagerRun(directory:string, manager:ManagerCandidate, plan:CohortPlan) {
  const {run,filings,failures}=replayInstitutionRun(directory);
  if(run.cik!==manager.cik||run.from!==plan.from||run.to!==plan.to)throw new Error("Run differs from cohort coverage plan");
  const main=run.indexes.find(f=>f.url===`https://data.sec.gov/submissions/CIK${manager.cik}.json`)!;
  const source=JSON.parse(readFileSync(resolve(directory,"raw",main.file),"utf8"));
  const match=(name:unknown)=>typeof name==="string"&&manager.secNames.some(n=>normalizedName(n)===normalizedName(name));
  const identityMatched=match(source.name)&&filings.every(f=>match(f.managerName));
  const result=validateManagerCorpus(filings,failures),comparison=result.comparison;
  const pairMatched=comparison?.previousPeriod===plan.previousPeriod&&comparison.currentPeriod===plan.currentPeriod;
  const ready=identityMatched&&pairMatched&&failures.length===0;
  return {cik:manager.cik,name:manager.name,secName:source.name,runId:run.runId,identityMatched,status:ready?"ready_for_review":"held",
    enumeratedFilings:run.references.length,parsedFilings:filings.length,parsedRows:result.parsedRows,
    requestedQuarterRows:filings.filter(f=>[plan.previousPeriod,plan.currentPeriod].includes(f.period)).reduce((sum,f)=>sum+f.holdings.length,0),
    filings:result.filings,held:result.held,failures,latestReportedPeriods:result.latestReportedPeriods,
    reason:!identityMatched?"SEC manager name requires identity review":!pairMatched?(result.comparisonHold??"Latest source quarters differ from requested pair"):null,
    comparison:ready&&comparison?{previousPeriod:comparison.previousPeriod,currentPeriod:comparison.currentPeriod,attributedPositions:comparison.positions.length,
      reportedInBoth:comparison.positions.filter(p=>p.status==="reported_in_both").length,newlyReported:comparison.positions.filter(p=>p.status==="newly_reported").length,noLongerReported:comparison.positions.filter(p=>p.status==="no_longer_reported").length}:null};
}
