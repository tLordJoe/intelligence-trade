/** Reproducible v2 snapshot. No price backtest or predictive-performance claim. */
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readDisclosureRelease } from "../src/lib/disclosure-storage.ts";
import { readApprovedInsiderRelease } from "../src/lib/form4/public-view.ts";
import { approvedInstitutions } from "../src/lib/institutions/release.ts";
import { readApprovedSenateRelease } from "../src/lib/senate/public-view.ts";
import { buildSubstantiveRadar,RADAR_V2_RULES } from "../src/lib/radar-engine.ts";
const root=resolve(import.meta.dirname,".."),args=process.argv.slice(2),arg=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const asOf=arg("--as-of"),output=arg("--output");if(!asOf||!output)throw new Error("Provide --as-of and --output");
const read=(path:string)=>JSON.parse(readFileSync(resolve(root,path),"utf8"));
const paths=["src/lib/congress-live.json","src/lib/senate-live.json","src/lib/insider-live.json","src/lib/institutions-live.json","data/security-master.json","src/lib/radar-security-links.json"];
const inputs=paths.map(path=>({path,sha256:createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex")}));
const insiders=readApprovedInsiderRelease(readDisclosureRelease(resolve(root,"src/lib/insider-live.json"))),institutions=approvedInstitutions(readDisclosureRelease(resolve(root,"src/lib/institutions-live.json")));
const view=buildSubstantiveRadar({house:read(paths[0]).trades,senate:readApprovedSenateRelease(read(paths[1])),insiders,institutions,identities:read(paths[4]).entries,securityLinks:read(paths[5]).entries},asOf);
const evidence={reviewedBy:"Codex",reviewedAt:new Date().toISOString(),rules:RADAR_V2_RULES,inputs,asOf,coverage:view.coverage,qualifying:view.items,divided:view.watchItems,
  checks:["All four published input feeds included","Full SEC identity directory replaces 67-company gate","Every comparable active-manager CUSIP screened, not just mapped tickers","Exact quantity and allocation thresholds use rational integer comparisons","Share classes preserved; issuer cards and manager groups deduplicated","Quarterly holdings, recent transactions and old historical context remain separate","Opposing sales and reductions retained","Mechanical/related-account insider purchases excluded from conviction, not deleted from archive"],predictivePerformanceValidated:false};
writeFileSync(resolve(root,output),JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify({qualified:view.items.map(i=>i.ticker??i.name),divided:view.watchItems.map(i=>i.ticker??i.name),comparableManagers:view.coverage.comparableManagers,securitiesScreened:view.coverage.fundSecuritiesScreened}));
