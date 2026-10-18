import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildSubstantiveRadar,radarFundEvidence,insiderRadarEligible} from "../src/lib/radar-engine.ts";
import {readDisclosureRelease} from "../src/lib/disclosure-storage.ts";
import {readApprovedSenateRelease} from "../src/lib/senate/public-view.ts";
import type {InstitutionalFiling,Holding} from "../src/lib/institutions/parse.ts";
import type {InstitutionPayload} from "../src/lib/institutions/release.ts";
import type {InsiderPayload} from "../src/lib/form4/public-view.ts";
import type {DisclosureRecord} from "../src/lib/congress-schema.ts";
const json=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),"utf8"));
const house=json("../src/lib/congress-live.json");
const identities={TEST:{ticker:"TEST",cik:"0000000001",title:"Test Company"}};
const securityLinks=[{cusip:"123456789",ticker:"TEST",cik:"0000000001",name:"Test Company",shareClass:"Common",sources:["https://www.sec.gov/Archives/test"]}];
const asOf="2026-10-18";
function filing(cik:string,period:string,quantity="100",positionValue="100",total="10000"):InstitutionalFiling{
  const accession=`${cik}-26-${period==="2026-03-31"?"000001":"000002"}`,filedDate=period==="2026-03-31"?"2026-05-15":"2026-08-14";
  const row:Holding={id:`${accession}:1`,issuerName:"Test Company",titleOfClass:"COM",cusip:"123456789",figi:null,valueAsFiled:positionValue,valueUsd:positionValue,quantity,quantityType:"SH",putCall:null,investmentDiscretion:"SOLE",otherManagers:"",otherManagerIds:[],voting:{sole:"0",shared:"0",none:"0"}};
  return {reference:{accession,cik,filedDate,form:"13F-HR"},sourceUrl:`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-","")}/${accession}.txt`,sourceSha256:"a".repeat(64),period,managerName:`Synthetic ${cik}`,amendment:false,amendmentType:null,amendmentNumber:null,reportType:"13F HOLDINGS REPORT",amendmentFlagSource:"explicit",valueUnit:"USD",declaredEntries:2,computedEntries:2,declaredValue:total,computedValue:total,confidentialOmitted:false,otherIncludedManagers:0,includedManagers:[],holdings:[row,{...row,id:`${accession}:2`,cusip:"999999999",issuerName:"Synthetic Other Company",valueAsFiled:String(BigInt(total)-BigInt(positionValue)),valueUsd:String(BigInt(total)-BigInt(positionValue))}]};
}
const pair=(cik:string,quantity="200",value="200")=>[filing(cik,"2026-03-31"),filing(cik,"2026-06-30",quantity,value)];
const fund=(filings:InstitutionalFiling[]):InstitutionPayload=>({schemaVersion:2,source:"SEC Form 13F",semantics:"quarter_end_reported_holdings",coverage:[],limitations:"Synthetic only",filings});
const run=(filings:InstitutionalFiling[]=[],rows:DisclosureRecord[]=[],insiders:InsiderPayload|null=null,links=securityLinks)=>buildSubstantiveRadar({house:rows,senate:null,insiders,institutions:fund(filings),identities,securityLinks:links},asOf);
function trade(id:string,person:string,date="2026-10-01",side:"Buy"|"Sell"="Buy"):DisclosureRecord{
  const base=house.trades[0];return {...base,id,politician:person,chamber:"House",state:"CA",district:"CA01",ticker:"TEST",cik:"0000000001",companyName:"Test Company",type:side,isOptions:false,status:"valid",tickerResolution:"verified",transactionDate:date,filedDate:"2026-10-10",raw:{...base.raw,ownerText:""},provenance:{...base.provenance,reconciliationKey:id}};
}
test("two active managers need quantity growth, meaningful weights and allocation growth—not mere ownership",()=>{
  const view=run([...pair("0001541617"),...pair("0001656456")]);
  assert.equal(view.items.length,1);const item=view.items[0];assert.equal(item.managers,2);assert.equal(item.kind,"manager_convergence");
  assert.equal(item.funds[0].previousWeight,1);assert.equal(item.funds[0].currentWeight,2);assert.equal(item.funds[0].quantityChangePercent,100);
  assert.equal(run([...pair("0001541617","100"),...pair("0001656456","100")]).items.length,0); // Prices alone.
  assert.equal(run([...pair("0001541617","200","140"),...pair("0001656456","200","140")]).items.length,0); // Only +0.4pp.
  assert.equal(run([...pair("0001541617","109.9999"),...pair("0001656456","109.9999")]).items.length,0);
  assert.equal(run([...pair("0001541617","110","150"),...pair("0001656456","110","150")]).items.length,1);
});
test("exact rational gates do not round a sub-threshold allocation into a qualification",()=>{
  const fs=["0001541617","0001656456"].flatMap(cik=>[filing(cik,"2026-03-31","100","10000","1000000"),filing(cik,"2026-06-30","200","14999","1000000")]);
  assert.equal(run(fs).items.length,0);
  for(const f of fs.filter(f=>f.period==="2026-06-30")){f.holdings[0].valueUsd="15000";f.holdings[0].valueAsFiled="15000";f.holdings[1].valueUsd="985000";f.holdings[1].valueAsFiled="985000";}
  assert.equal(run(fs).items.length,1);
});
test("newly reported is labeled separately, not described as an executed purchase",()=>{
  const fs=["0001541617","0001656456"].flatMap(cik=>{const old=filing(cik,"2026-03-31");old.holdings=old.holdings.filter(r=>r.cusip!=="123456789");return[old,filing(cik,"2026-06-30","100","200")];});
  const item=run(fs).items[0];assert.ok(item);assert.equal(item.funds[0].previousShares,null);assert.match(item.reasons[0],/newly reported/);assert.doesNotMatch(item.headline,/bought/);
});
test("passive/bank size, option rows, stale quarters, partial reports and missing comparisons cannot qualify",()=>{
  assert.equal(run([...pair("0000093751"),...pair("0000886982")]).items.length,0);
  for(const patch of [{reportType:"13F COMBINATION REPORT"},{confidentialOmitted:true},{amendment:true},{computedEntries:99}]){
    const fs=[...pair("0001541617"),...pair("0001656456")].map(f=>f.period==="2026-06-30"?{...f,...patch}:f);assert.equal(run(fs).items.length,0);
  }
  assert.equal(run([filing("0001541617","2026-06-30","200","200"),filing("0001656456","2026-06-30","200","200")]).items.length,0);
  const options=[...pair("0001541617"),...pair("0001656456")].map(f=>({...f,holdings:f.holdings.map(r=>({...r,putCall:"Call" as const}))}));assert.equal(run(options).items.length,0);
  assert.equal(radarFundEvidence(fund([...pair("0001541617"),...pair("0001656456")]),"2027-01-01").evidence.length,0);
});
test("same-family reporting entities or duplicate filings cannot manufacture independent managers",()=>{
  assert.equal(run([...pair("0002026053"),...pair("0001336528")]).items.length,0);
  const a=pair("0001541617");assert.equal(run([...a,...a,...pair("0001656456")]).items.length,0);
});
test("meaningful reductions remain visible and move tied signals into a separate divided group",()=>{
  const fs=[...pair("0001541617"),...pair("0001656456"),...pair("0001040273","50","50"),...pair("0001647251","50","50")];
  const view=run(fs);assert.equal(view.items.length,0);assert.equal(view.watchItems.length,1);assert.equal(view.watchItems[0].kind,"divided");assert.equal(view.watchItems[0].reducingManagers,2);assert.ok(view.watchItems[0].funds.some(f=>f.status==="reduced"));
});
test("CUSIP identity is exact; an unmapped substantive candidate remains inspectable without a guessed ticker",()=>{
  const fs=[...pair("0001541617"),...pair("0001656456")],item=run(fs,[],null,[]).items[0];
  assert.equal(item.ticker,null);assert.equal(item.href,"/radar/holding/123456789");
  assert.throws(()=>run(fs,[],null,[{...securityLinks[0],cik:"0000000002"}]),/security link/);
  assert.throws(()=>run(fs,[],null,[...securityLinks,securityLinks[0]]),/security link/);
});
test("a thin two-filer pattern no longer qualifies; broad repeat buying must outweigh selling",()=>{
  const thin=[trade("1","A"),trade("2","A","2026-10-02"),trade("3","B")];assert.equal(run([],thin).items.length,0);
  const broad=[...thin,trade("4","B","2026-10-02"),trade("5","C"),trade("6","D"),trade("7","E")];
  const view=run([],broad);assert.equal(view.items.length,1);assert.equal(view.items[0].buyers,5);assert.equal(view.items[0].buyEvents,7);assert.equal(view.items[0].kind,"congress_cluster");
  assert.equal(run([],broad.map(r=>({...r,transactionDate:"2026-10-01"}))).items.length,0);
  assert.equal(run([],[...broad,...Array.from({length:7},(_,i)=>trade(`s${i}`,`Seller${i}`,"2026-10-01","Sell"))]).items.length,0);
});
test("insider mechanics and linked joint owners cannot create a conviction cluster",()=>{
  const live=readDisclosureRelease(new URL("../src/lib/insider-live.json",import.meta.url).pathname) as {payload:InsiderPayload};
  const base=live.payload.records[0],row={...base,classification:"reported_purchase" as const,filingPlanIndicator:false,securityTitle:"Common Stock",sourceRemarks:null,footnotes:{}};
  assert.equal(insiderRadarEligible(row),true);
  for(const note of ["Dividend reinvestment plan", "power to substitute assets of equivalent value", "Employee stock purchase plan"])assert.equal(insiderRadarEligible({...row,footnotes:{F1:note}}),false);
  assert.equal(insiderRadarEligible({...row,filingPlanIndicator:true}),false);
  assert.equal(insiderRadarEligible({...row,classification:"reported_sale",filingPlanIndicator:true,footnotes:{F1:"Unrelated gift transaction"}}),true);
  const owner=(cik:string)=>({...base.reportingOwners[0],cik,name:`Synthetic ${cik}`});
  const rows=[[owner("0000000011"),owner("0000000012")],[owner("0000000012"),owner("0000000013")],[owner("0000000013")]].flatMap((owners,i)=>[1,2].map((_,j)=>({...row,id:`joint-${i}-${j}`,ticker:"TEST",issuerCik:"0000000001",issuerName:"Test Company",classification:"reported_purchase" as const,transactionDate:`2026-10-0${j+1}`,filedDate:"2026-10-10",reportingOwners:owners})));
  const view=run([],[],{...live.payload,records:rows});assert.equal(view.items.length,0);
});
test("old insider transactions do not become current confirmation merely because published now",()=>{
  const live=readDisclosureRelease(new URL("../src/lib/insider-live.json",import.meta.url).pathname) as {payload:InsiderPayload};
  const rows=live.payload.records.slice(0,6).map((r,i)=>({...r,id:`old-${i}`,ticker:"TEST",issuerCik:"0000000001",classification:"reported_purchase" as const,transactionDate:"2026-03-20",filedDate:"2026-10-10"}));
  assert.equal(run([],[],{...live.payload,records:rows}).items.length,0);
});
test("substantive insider and cross-source purchase clusters can qualify without institutional support",()=>{
  const live=readDisclosureRelease(new URL("../src/lib/insider-live.json",import.meta.url).pathname) as {payload:InsiderPayload};
  const base=live.payload.records[0];
  const rows=["11:1","11:2","12:1","12:2","13:1"].map((key,i)=>{
    const [actor,day]=key.split(":");
    return {...base,id:`cluster-${i}`,ticker:"TEST",issuerCik:"0000000001",issuerName:"Test Company",classification:"reported_purchase" as const,
      securityTitle:"Common Stock",filingPlanIndicator:false,sourceRemarks:null,footnotes:{},transactionDate:`2026-10-0${day}`,filedDate:"2026-10-10",
      reportingOwners:[{...base.reportingOwners[0],cik:actor.padStart(10,"0"),name:`Synthetic ${actor}`}]};
  });
  const insider=run([],[],{...live.payload,records:rows}).items[0];
  assert.equal(insider.kind,"insider_cluster");assert.equal(insider.buyers,3);assert.equal(insider.buyEvents,5);assert.equal(insider.repeatBuyers,2);
  const cross=run([],[trade("cross-house","Congress Filer")],{...live.payload,records:rows.slice(0,4)}).items[0];
  assert.equal(cross.kind,"cross_source");assert.equal(cross.buyers,3);assert.equal(cross.buyEvents,5);
  assert.deepEqual(cross.sourceLabels,["House","Corporate insiders"]);
});
test("source row permutations and duplicate disclosures do not change ranking or evidence",()=>{
  const fs=[...pair("0001541617"),...pair("0001656456")],a=run(fs),b=run([...fs].reverse());assert.deepEqual(a,b);
});
test("published-data scan uses four feeds and produces substantive, source-bound evidence—not AAPL's thin old pattern",()=>{
  const insiders=readDisclosureRelease(new URL("../src/lib/insider-live.json",import.meta.url).pathname) as {payload:InsiderPayload},institutions=readDisclosureRelease(new URL("../src/lib/institutions-live.json",import.meta.url).pathname) as {payload:InstitutionPayload};
  const view=buildSubstantiveRadar({house:house.trades,senate:readApprovedSenateRelease(json("../src/lib/senate-live.json")),insiders:insiders.payload,institutions:institutions.payload,identities:json("../data/security-master.json").entries,securityLinks:json("../src/lib/radar-security-links.json").entries},asOf);
  assert.equal(view.coverage.holdingRows,292522);assert.equal(view.coverage.insiderRows,3090);assert.equal(view.coverage.comparableManagers,9);assert.ok(view.coverage.fundSecuritiesScreened>3000);
  assert.equal(view.items.some(i=>i.ticker==="AAPL"||i.ticker==="BRK-B"),false);assert.ok(view.items.length>=4);
  const alphabet=view.items.find(i=>i.ticker==="GOOGL")!;assert.equal(alphabet.managers,4);assert.deepEqual(alphabet.tickers,["GOOG","GOOGL"]);assert.equal(view.items.filter(i=>i.cik==="0001652044").length,1);
  assert.ok(view.watchItems.some(i=>i.ticker==="MU"));assert.ok(view.watchItems.some(i=>i.ticker==="META"));
  for(const item of [...view.items,...view.watchItems]){assert.ok(item.reasons.length>=2);assert.ok(item.funds.every(f=>f.currentSource.startsWith("https://www.sec.gov/Archives/")));assert.ok(item.funds.some(f=>f.qualifies));}
});
