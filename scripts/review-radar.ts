/** Reproducible release snapshot. Not a simulated portfolio or performance claim. */
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildRadar,RADAR_RULES } from "../src/lib/radar.ts";
import { readApprovedSenateRelease } from "../src/lib/senate/public-view.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
const root=resolve(import.meta.dirname,".."),args=process.argv.slice(2),arg=(name:string)=>args[args.indexOf(name)+1];
if(!args.includes("--as-of")||!args.includes("--output"))throw Error("Supply --as-of YYYY-MM-DD and --output FILE");
const inputs=["src/lib/congress-live.json","src/lib/senate-live.json","src/lib/sector-company-identities.json"].map(path=>{
  const bytes=readFileSync(resolve(root,path));return {path,sha256:createHash("sha256").update(bytes).digest("hex"),value:JSON.parse(bytes.toString("utf8"))};
});
const view=buildRadar(inputs[0].value.trades as DisclosureRecord[],readApprovedSenateRelease(inputs[1].value),inputs[2].value.entries,arg("--as-of"));
const evidence={reviewedBy:"Codex",reviewedAt:new Date().toISOString(),asOf:view.asOf,rules:RADAR_RULES,
  inputs:inputs.map(({path,sha256})=>({path,sha256})),universeSize:view.universeSize,
  rankingSources:["Reviewed House disclosures","Reviewed Senate disclosures"],
  notScored:["Bounded current insider filing window","Quarterly institutional holdings without verified issuer links","Wealth, dollar size and fame"],
  highlights:view.items.map(({ticker,cik,buyers,sellers,purchases,sales,repeatBuyers,chambers,latestBuyFiled,medianFilingDelayDays,mixedActivity,evidence})=>({
    ticker,cik,buyers,sellers,purchases,sales,repeatBuyers,chambers,latestBuyFiled,medianFilingDelayDays,mixedActivity,
    sourceRecords:evidence.map(row=>({id:row.id,side:row.side,filerKey:row.filerKey,traded:row.traded,filed:row.filed,sourceUrl:row.sourceUrl})),
  })),
  mobileChanges:["Radar before trading tables","All four source entry points visible","Bounded three-stock client previews","Searchable, sorted 25-result activity pages","Native mobile sector picker","Collapsible latest disclosures","Keyboard-accessible mobile menu"],
  predictivePerformanceValidated:false};
writeFileSync(resolve(root,arg("--output")),JSON.stringify(evidence,null,2)+"\n");
console.log(`${view.items.length} qualifying highlights; release input hashes and source records saved.`);
