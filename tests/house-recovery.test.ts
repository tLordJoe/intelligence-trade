import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {PDFParse} from "pdf-parse";
import {parseFilingRows} from "../src/lib/house-parser.ts";
import {assignRowIds} from "../src/lib/congress-identity.ts";
import {assessRun} from "../src/lib/congress-gates.ts";
import {emptyCounts,type DisclosureRecord} from "../src/lib/congress-schema.ts";
import {applyReviewedHouseCorrections} from "../src/lib/house-reviewed-corrections.ts";
import {mergeRecords} from "../src/lib/congress-merge.ts";

const sources = [
  ["20034894",3,"608b5187192c389d67a0bc033458d4fac3215194821982049102a5bab2a2df9b"],
  ["20030977",197,"76053146c191866009c30ba05b192e472aac616195137db9f5ea0e87274da39a"],
  ["20033983",144,"45fbfb0feb4886974fa011ccf42478c9134cf9efa9327f8dca22a02a6c7e3514"],
  ["20034201",7,"6372d59d32a7e54b69e4b456c315670456aa625572a5c78e5c29b72a81de2d43"],
  ["20034346",1,"29b16843a82ef1f91b5578f02640ab2841dba2ccf76771886312bca272464319"],
  ["20034351",10,"1b58481cecdd446a5cf507c19b7e48e5ba8a04d06a6f71ae131e961f6b76c711"],
  ["20034932",19,"d3abe2a6267cddd2a4acb43c68d89dae80cd6b6fd9ce00f5bb853aafee852949"],
  ["20034585",26,"704123a6a4320c5b66defc132e2a09a26d5c2283259b75246479ef8a77647b85"],
  ["20035326",28,"a9e0e365efd343e4eba219c9b47494f617358d2085d3bd2d9866e56d7335147f"],
] as const;
for (const [docId,count,sha] of sources) test(`original PDF ${docId}: all supported rows survive`,async()=>{
  const bytes=readFileSync(new URL(`fixtures/house-recovery/${docId}.pdf`,import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),sha);
  const pdf=new PDFParse({data:new Uint8Array(bytes)});
  let text:string;
  try { ({text}=await pdf.getText()); } finally { await pdf.destroy(); }
  const parsed=parseFilingRows(text!);
  assert.equal(parsed.rows.length,count);
  assert.equal(parsed.skipped.length,0);
  assert.equal(parsed.symbolBlocks,count);
  for(const row of parsed.rows) {
    assert.match(row.transactionDateText,/^\d{2}\/\d{2}\/\d{4}$/);
    assert.ok(row.amount.low!==null && row.amount.high!==null);
    assert.doesNotMatch(row.issuerName,/\$|\/share|this PTR|Filing ID|S O:|L: US/);
  }
  if(docId==="20034894") {
    assert.deepEqual(parsed.rows.map(r=>[r.tickerText,r.type,r.transactionDateText,r.amount.text]),
      Array.from({length:3},()=>["NVDA","Buy","06/26/2026","$1,001 - $15,000"]));
    const ids=assignRowIds(docId,parsed.rows.map(r=>({...r,amountText:r.amount.text})));
    assert.equal(new Set(ids.map(r=>r.id)).size,3);
    assert.deepEqual(ids.map(r=>r.occurrence),[0,1,2]);
  }
  if(docId==="20034346") {
    assert.equal(parsed.rows[0].issuerName,"iShares Bitcoin Trust ETF");
    assert.equal(parsed.rows[0].amount.text,"$100,001 - $250,000");
  }
  if(docId==="20030977") assert.deepEqual(parsed.rows.slice(0,3).map(r=>[r.tickerText,r.type,r.transactionDateText]),
    [["MMM","Buy","01/17/2025"],["ABT","Buy","10/23/2024"],["ABT","Sell","12/08/2025"]]);
  if(docId==="20033983") assert.deepEqual(parsed.rows.slice(0,3).map(r=>[r.tickerText,r.amount.text]),
    [["AEIS","$1,001 - $15,000"],["AVAV","$1,001 - $15,000"],["ADC","$15,001 - $50,000"]]);
  if(docId==="20033983") {
    const fnv=parsed.rows.find(r=>r.tickerText==="FNV");
    assert.deepEqual([fnv?.type,fnv?.transactionDateText,fnv?.amount.text],
      ["Buy","01/27/2026","$15,001 - $50,000"]);
    assert.equal(fnv?.wrappedLayout,true);
  }
  const wrappedCases: Record<string,[string,string,string]> = {
    "20034932":["HUBB","Buy","06/16/2026"],
    "20034585":["IFNNY","Buy","04/13/2026"],
    "20035326":["VLTO","Sell","08/10/2026"],
  };
  const target=wrappedCases[docId];
  if(target) {
    const row=parsed.rows.find(r=>r.tickerText===target[0] && r.transactionDateText===target[2]);
    assert.equal(row?.type,target[1]);
    assert.equal(row?.amount.text,"$1,001 - $15,000");
  }
});

test("a missing row boundary blocks instead of borrowing cells or accepting only the first",()=>{
  const parsed=parseFilingRows("Alpha (AAA) [ST] P 01/01/2026 $10 Beta (BBB) [ST] S 01/02/2026 $20");
  assert.equal(parsed.rows.length,0);
  assert.deepEqual(parsed.skipped.map(r=>r.reason),["ambiguous_row_boundary","ambiguous_row_boundary"]);
  const result=assessRun({counts:{...emptyCounts(),unresolvedSymbolRows:2},allowCompletenessDrop:true});
  assert.equal(result.passed,false);
  assert.ok(result.failures.includes("unresolved_supported_symbol_rows:2"));
});

test("source-reviewed IBIT correction preserves identity and raw evidence; wrong source fails",()=>{
  const archive=JSON.parse(readFileSync(new URL("../src/lib/congress-live.json",import.meta.url),"utf8"));
  const prior:DisclosureRecord=archive.trades.find((r:DisclosureRecord)=>r.id==="20034346::64e178ecd1db53c5::0");
  assert.ok(prior);
  const next={...prior,id:"recovered-ibit",amount:"$100,001 - $250,000",amountLow:100001,amountHigh:250000,
    provenance:{...prior.provenance,reconciliationKey:"reviewed-new-key"}};
  const hashes=new Map([["20034346",sources[4][2]]]);
  const corrected=applyReviewedHouseCorrections([prior],[next],hashes);
  const merged=mergeRecords([prior],corrected,"2026-09-08T12:00:00Z","test-recovery");
  assert.equal(merged.added,0); assert.equal(merged.revised,1);
  assert.equal(merged.records[0].id,prior.id);
  assert.equal(merged.records[0].amountLow,100001);
  assert.deepEqual(merged.records[0].raw,prior.raw);
  assert.throws(()=>applyReviewedHouseCorrections([prior],[next],new Map([["20034346","wrong"]])),/source changed/);
  assert.throws(()=>applyReviewedHouseCorrections([prior],[next,next],hashes),/no longer matches/);
});
