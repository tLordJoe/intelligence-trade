import assert from "node:assert/strict";
import test from "node:test";
import { radarActivityPreview, rankRadarActivity, summarizeRadarActivity } from "../src/lib/radar-activity.ts";
import type { RadarTradeEvidence } from "../src/lib/radar-engine.ts";

const identity = { key:"test", ticker:"TEST", tickers:["TEST"], cik:"0000000001", name:"Test Company" };
const trade = (id: string, fields: Partial<RadarTradeEvidence> = {}): RadarTradeEvidence => ({
  id, source:"House", side:"Buy", actor:id, name:id, href:"/congress",
  traded:"2026-11-05", filed:"2026-11-12", amount:"$1,001–$15,000",
  sourceUrl:"https://disclosures-clerk.house.gov/example.pdf", owner:null, ...fields,
});
const buy = [trade("B1"),trade("B2",{traded:"2026-11-06"})];
const sell = [trade("S1",{side:"Sell"}),trade("S2",{side:"Sell",source:"Corporate insiders"})];
const summarize = (rows: RadarTradeEvidence[]) => summarizeRadarActivity(identity, rows, "2026-10-17");

test("a single buyer, split rows, or two same-source names on one day do not create a cluster",()=>{
  assert.equal(summarize([trade("B1")]),null);
  assert.equal(summarize([trade("B1"),trade("other",{actor:"B1",traded:"2026-11-03"})]),null);
  assert.equal(summarize([trade("B1"),trade("B2")]),null);
});

test("each direction can qualify and two qualifying directions are shown as mixed",()=>{
  assert.equal(summarize(buy)?.kind,"buying");
  assert.equal(summarize(sell)?.kind,"selling");
  const mixed=summarize([...buy,...sell,trade("split",{actor:"B1"})]);
  assert.equal(mixed?.kind,"mixed");
  assert.equal(mixed?.buyers,2);
  assert.equal(mixed?.sellers,2);
  assert.equal(mixed?.purchaseEvents,2);
  assert.deepEqual(mixed?.supportingSources,["Corporate insiders","House"]);
  assert.deepEqual(mixed?.examples.map(row=>row.side),["Buy","Sell"]);
});

test("a dated filing or a context-only sale cannot be the required second seller",()=>{
  assert.equal(summarize([sell[0],{...sell[1],filed:"2026-10-16"}]),null);
  assert.equal(summarize([sell[0],{...sell[1],activitySaleContext:true}]),null);
  const buys=summarize([...buy,...sell.slice(0,1),{...sell[1],activitySaleContext:true}]);
  assert.equal(buys?.kind,"buying");
  assert.equal(buys?.sellers,1);
  assert.equal(buys?.saleContextRows,1);
  assert.ok(buys?.rows.some(row=>row.activitySaleContext));
});

test("the display cap preserves a supported cluster for each direction in the preview",()=>{
  const selling=summarize(sell)!,buying=summarize(buy)!,mixed=summarize([...buy,...sell])!;
  const ranked=rankRadarActivity([...Array.from({length:15},(_,n)=>({...selling,key:`S${n}`,sellers:10})),{...buying,key:"B"},{...mixed,key:"M"}]);
  assert.equal(ranked.length,12);
  assert.deepEqual(radarActivityPreview(ranked).map(row=>row.kind),["selling","buying","mixed"]);
});
