/** Read-only replay of one bounded run. It cannot approve or publish records. */
import { resolve } from "node:path";
import { replayInstitutionRun } from "../src/lib/institutions/archive.ts";
import { validateManagerCorpus } from "../src/lib/institutions/validation.ts";
const args=process.argv.slice(2), at=args.indexOf("--run"), runId=at>=0?args[at+1]:"";
if(!/^institutions_[a-f0-9-]{36}$/.test(runId))throw new Error("Provide --run institutions_UUID from the collector output");
const {run,filings,failures}=replayInstitutionRun(resolve(import.meta.dirname,"../data/institution-runs",runId));
const result=validateManagerCorpus(filings,failures);
console.log(JSON.stringify({runId,cik:run.cik,collectedAt:run.collectedAt,filingDateWindow:{from:run.from,to:run.to},enumeratedFilings:run.references.length,...result},null,2));
if(!result.comparison)process.exitCode=1;
