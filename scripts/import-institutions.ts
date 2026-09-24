/** Bounded per-manager SEC collector. No public data is changed. */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { date, digest, filingUrl, type FilingReference } from "../src/lib/institutions/parse.ts";
import { SecReader, references, allowedSecUrl, sourceFailure } from "../src/lib/institutions/source.ts";
import type { InstitutionRun, EvidenceFile } from "../src/lib/institutions/archive.ts";
const args=process.argv.slice(2), arg=(key:string)=>{const i=args.indexOf(key);return i>=0?args[i+1]:undefined;};
const cik=arg("--cik")?.padStart(10,"0") ?? "", from=date(arg("--from") ?? ""), to=date(arg("--to") ?? "");
const limit=Number(arg("--max-filings") ?? 10);
if (!/^\d{10}$/.test(cik)||Number(cik)===0||from>to||!Number.isSafeInteger(limit)||limit<1||limit>500) throw new Error("Use --cik, --from, --to and --max-filings 1..500");
const reader=new SecReader(); // Reject missing contact before creating a run.
const root=resolve(import.meta.dirname,".."), runId=`institutions_${randomUUID()}`, directory=resolve(root,"data/institution-runs",runId);
mkdirSync(resolve(directory,"raw"),{recursive:true});
const run:InstitutionRun={schemaVersion:1,source:"SEC",runId,collectedAt:new Date().toISOString(),cik,from,to,complete:false,indexes:[],references:[],filings:[]};
async function capture(url:string):Promise<EvidenceFile>{
  const bytes=await reader.read(url), sha256=digest(bytes), file=`${sha256}.raw`, path=resolve(directory,"raw",file);
  if(existsSync(path)){if(digest(readFileSync(path))!==sha256)throw new Error("Changed existing raw source");}
  else writeFileSync(path,bytes,{flag:"wx"});
  return {url,file,sha256};
}
try {
  const main=await capture(`https://data.sec.gov/submissions/CIK${cik}.json`);run.indexes.push(main);
  const source=JSON.parse(readFileSync(resolve(directory,"raw",main.file),"utf8"));
  if(String(source.cik).padStart(10,"0")!==cik)throw new Error("SEC manager mismatch");
  const refs=new Map<string,FilingReference>();
  const add=(list:FilingReference[])=>{for(const ref of list){const old=refs.get(ref.accession);if(old&&JSON.stringify(old)!==JSON.stringify(ref))throw new Error("Conflicting SEC index metadata");refs.set(ref.accession,ref);}};
  add(references(source.filings.recent,cik,from,to));
  for(const shard of source.filings.files ?? [])if(shard.filingTo>=from&&shard.filingFrom<=to){
    const evidence=await capture(allowedSecUrl(`https://data.sec.gov/submissions/${shard.name}`));run.indexes.push(evidence);
    add(references(JSON.parse(readFileSync(resolve(directory,"raw",evidence.file),"utf8")),cik,from,to));
  }
  run.references=[...refs.values()].sort((a,b)=>a.accession.localeCompare(b.accession));
  if(run.references.length>limit)throw new Error(`${run.references.length} filings exceeds bounded limit ${limit}; narrow the date window, do not silently truncate`);
  let stopped: string | undefined;
  for(const reference of run.references){
    if(stopped){run.filings.push({reference,failure:`Not attempted after prior SEC failure: ${stopped}`});continue;}
    try {run.filings.push({reference,evidence:await capture(filingUrl(reference))});}
    catch(error){stopped=sourceFailure(error);run.filings.push({reference,failure:stopped});process.exitCode=1;}
  }
  run.complete=true; // Enumeration complete; individual failures still hold manager during replay.
}catch(error){run.failure=sourceFailure(error);process.exitCode=1;}
writeFileSync(resolve(directory,"manifest.json"),JSON.stringify(run,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({runId,enumerationComplete:run.complete,filings:run.filings.length,failures:run.filings.filter(f=>f.failure).length,failure:run.failure,publicChanged:false}));
