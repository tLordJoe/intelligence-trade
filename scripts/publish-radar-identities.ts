/** Package a reviewed SEC directory snapshot, never the ignored importer cache. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeDisclosureRelease } from "../src/lib/disclosure-storage.ts";
import type { SecurityMaster } from "../src/lib/security-master.ts";

const root=resolve(import.meta.dirname,".."),input=process.argv[2];
if(!input)throw new Error("Provide the reviewed SEC security-master JSON path");
const master=JSON.parse(readFileSync(resolve(input),"utf8")) as SecurityMaster;
if(!master.updatedAt||!Number.isFinite(Date.parse(master.updatedAt))||!master.entries||!Object.keys(master.entries).length)throw new Error("Invalid SEC directory snapshot");
for(const [ticker,entry] of Object.entries(master.entries)){
  if(entry.ticker!==ticker||!/^[0-9]{10}$/.test(entry.cik)||!entry.title?.trim())throw new Error(`Invalid SEC identity ${ticker}`);
}
const result=writeDisclosureRelease(resolve(root,"src/lib/radar-identities.json"),{
  source:"https://www.sec.gov/files/company_tickers.json",retrievedAt:master.updatedAt,entries:master.entries,
});
console.log(JSON.stringify({...result,identities:Object.keys(master.entries).length}));
