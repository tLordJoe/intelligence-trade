import house from "./congress-live.json";
import senate from "./senate-live.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import links from "./radar-security-links.json";
import { readApprovedSenateRelease } from "./senate/public-view.ts";
import { publishedInsiders, publishedInstitutions } from "./published-disclosures.ts";
import { buildSubstantiveRadar, type RadarV2View } from "./radar-engine.ts";
import type { DisclosureRecord } from "./congress-schema.ts";

/** Server projection only; never imported by a client component. */
const cache=new Map<string,RadarV2View>();
let identities:Record<string,{ticker:string;cik:string;title:string}>|undefined;
const master=()=>identities??(identities=JSON.parse(readFileSync(join(process.cwd(),"data/security-master.json"),"utf8")).entries);
export const radarIdentity=(ticker:string)=>master()[ticker]??null;
export function currentRadar(asOf = new Date().toISOString().slice(0,10)) {
  if(!cache.has(asOf)){
    const view=buildSubstantiveRadar({house:house.trades as DisclosureRecord[],senate:readApprovedSenateRelease(senate),insiders:publishedInsiders(),institutions:publishedInstitutions(),identities:master(),securityLinks:links.entries},asOf);
    if(cache.size>=4)cache.clear();cache.set(asOf,view);
  }
  return cache.get(asOf)!;
}
