import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRadar } from "../src/lib/radar.ts";
import { previewHomeWindows,queryHomeActivity, type HomeWindow } from "../src/lib/homepage-market.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";
import type { SenatePublicPayload } from "../src/lib/senate/public-view.ts";
const archive=JSON.parse(readFileSync(new URL("../src/lib/congress-live.json",import.meta.url),"utf8"));
const identities={TEST:{ticker:"TEST",cik:"0000000001",title:"Test company"}};
function row(id:string,person="Jane Doe",patch:Partial<DisclosureRecord>={}):DisclosureRecord {
  const base=archive.trades[0];return {...base,id,politician:person,chamber:"House",state:"CA",district:"CA01",ticker:"TEST",cik:"0000000001",companyName:"Test company",type:"Buy",isOptions:false,status:"valid",tickerResolution:"verified",transactionDate:"2026-10-02",filedDate:"2026-10-10",raw:{...base.raw,ownerText:"SP"},provenance:{...base.provenance,reconciliationKey:id},...patch};
}
const qualified=()=>[row("one"),row("two","Jane Doe",{transactionDate:"2026-10-03"}),row("three","John Doe")];
test("Radar requires multiple filers and repeat purchases on different dates",()=>{
  const rows=qualified(),before=JSON.stringify(rows),view=buildRadar(rows,null,identities,"2026-10-18");
  assert.equal(view.items.length,1);assert.equal(view.items[0].buyers,2);assert.equal(view.items[0].repeatBuyers,1);
  assert.equal(view.items[0].purchases,3);assert.equal(view.items[0].medianFilingDelayDays,8);
  assert.equal(view.start,"2026-07-21");assert.equal(view.freshFrom,"2026-09-19");assert.equal(JSON.stringify(rows),before);
  assert.equal(buildRadar(rows.map(r=>({...r,transactionDate:"2026-10-02"})),null,identities,"2026-10-18").items.length,0);
  assert.equal(buildRadar(rows.map(r=>({...r,politician:"Jane Doe"})),null,identities,"2026-10-18").items.length,0);
});
test("source duplicates and same-day split rows cannot manufacture a pattern",()=>{
  const rows=qualified();assert.equal(buildRadar([...rows,rows[0]],null,identities,"2026-10-18").items[0].purchases,3);
  assert.equal(buildRadar([rows[0],{...rows[0],id:"alias",provenance:{...rows[0].provenance}},rows[2]],null,identities,"2026-10-18").items.length,0);
});
test("Radar rejects stale, impossible, unsupported and unresolved records",()=>{
  for(const patch of [{filedDate:"2026-09-18",transactionDate:"2026-09-01"},{transactionDate:"2026-07-20"},
    {filedDate:"2026-10-19"},{transactionDate:"2026-10-11"},{isOptions:true},{status:"quarantined"},{tickerResolution:"unknown"},{cik:"0000000002"},{ticker:"ETF"}] as Partial<DisclosureRecord>[])
    assert.equal(buildRadar(qualified().map(r=>({...r,...patch})),null,identities,"2026-10-18").items.length,0,JSON.stringify(patch));
  assert.throws(()=>buildRadar([],null,identities,"2026-02-31"));
});
test("selling stays visible and does not become a bullish claim",()=>{
  const rows=[...qualified(),...Array.from({length:4},(_,i)=>row(`sale${i}`,`Seller ${i}`,{type:"Sell"}))];
  const item=buildRadar(rows,null,identities,"2026-10-18").items[0];
  assert.equal(item.sales,4);assert.equal(item.sellers,4);assert.equal(item.mixedActivity,true);assert.equal(item.evidence.length,7);
});
test("Senate rows retain their own filer identity, account, filing date and evidence link",()=>{
  const sample=JSON.parse(readFileSync(new URL("../src/lib/senate-live.json",import.meta.url),"utf8")).payload as SenatePublicPayload;
  const senate:SenatePublicPayload={...sample,records:[{...sample.records[0],id:"senate:test:row",ticker:"TEST",cik:"0000000001",type:"Buy",bioguide:"T000001",politician:"Test Senator",transactionDate:"2026-10-04",filedDate:"2026-10-09",owner:"Spouse"}]};
  const item=buildRadar(qualified().slice(0,2),senate,identities,"2026-10-18").items[0];
  assert.deepEqual(item.chambers,["House","Senate"]);assert.equal(item.buyers,2);
  const evidence=item.evidence.find(r=>r.chamber==="Senate")!;assert.equal(evidence.owner,"Spouse");assert.equal(evidence.filerHref,"/senate/filers/T000001");
});
test("ranking is stable, independent of amount, and never padded to ten",()=>{
  const ids={...identities,NEXT:{ticker:"NEXT",cik:"0000000002",title:"Next company"}};
  const rows=[...qualified(),...qualified().map(r=>({...r,id:`next${r.id}`,ticker:"NEXT",cik:"0000000002",amount:"$50,000,001 - $100,000,000",provenance:{...r.provenance,reconciliationKey:`next${r.id}`}}))];
  const one=buildRadar(rows,null,ids,"2026-10-18"),two=buildRadar([...rows].reverse(),null,ids,"2026-10-18");
  assert.equal(one.items.length,2);assert.deepEqual(one,two);assert.deepEqual(one.items.map(i=>i.ticker),["NEXT","TEST"]);
});
test("homepage previews stay bounded; the separate directory retains pagination and sorting",()=>{
  const companies=Array.from({length:80},(_,i)=>({ticker:`T${String(i).padStart(2,"0")}`,name:`Test ${i}`,buyers:i+1,purchases:2*i,sales:i,filers:[]}));
  const window:HomeWindow={start:"2026-01-01",end:"2026-10-18",companies,recent:[]};
  const preview=previewHomeWindows({ytd:window,"30":window,"90":window});
  assert.equal(preview.ytd.companies.length,3);assert.equal(preview.ytd.companyCount,80);assert.equal(window.companies.length,80);
  const directory=queryHomeActivity(window,{sort:"sales",page:"2"});assert.equal(directory.total,80);assert.equal(directory.companies.length,25);assert.equal(directory.pages,4);assert.equal(directory.page,2);assert.equal(directory.companies[0].ticker,"T54");
  assert.equal(queryHomeActivity(window,{q:"T00"}).total,1);assert.equal(queryHomeActivity(window,{page:"NaN"}).page,1);assert.equal(queryHomeActivity(window,{q:"x".repeat(300)}).q.length,100);
});
