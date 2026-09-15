import test from "node:test";
import assert from "node:assert/strict";
import type { parseSenateReport } from "../src/lib/senate/parse.ts";
import { reconcileSenateReports, type SenateAmendmentReview } from "../src/lib/senate/reconcile.ts";
type Filing = ReturnType<typeof parseSenateReport>;
// Minimal synthetic review fixtures. These are not approvals of any real filing.
function filing(id: string, amendment = false): Filing {
  return {schemaVersion:1,parserVersion:"senate-electronic-ptr-v1",reference:{id,url:`https://efdsearch.senate.gov/search/view/ptr/${id}/`,firstName:"Example",lastName:"Filer",office:"Senator",reportTitle:"Periodic Transaction Report",receivedDate:"2026-08-17",format:"electronic"},documentSha256:id.repeat(64).slice(0,64),filer:"Example Filer",title:`Periodic Transaction Report for 08/17/2026${amendment?" (Amendment 1)":""}`,filedDate:"2026-08-17",filedTimestampRaw:"08/17/2026 @ 12 PM",amendment,warnings:[],rows:[],publicationApproved:false};
}
const a=filing("a"),b=filing("b",true);
const review: SenateAmendmentReview={originalId:"a",amendmentId:"b",originalSha256:a.documentSha256,amendmentSha256:b.documentSha256,mode:"complete-report-replacement",reviewedBy:"Synthetic test reviewer",reviewedAt:"2026-09-14T00:00:00Z",evidenceNote:"Synthetic test: verified complete replacement"};
test("unreviewed Senate amendment blocks an active transaction projection",()=>{
  const result=reconcileSenateReports([a,b],[]);assert.equal(result.ready,false);assert.deepEqual(result.activeFilings,[]);
});
test("explicit hash-bound replacement keeps raw original immutable",()=>{
  const before=JSON.stringify([a,b]);const result=reconcileSenateReports([a,b],[review]);
  assert.equal(result.ready,true);assert.deepEqual(result.activeFilings,[b]);assert.equal(result.publicationApproved,false);assert.equal(JSON.stringify([a,b]),before);
});
test("missing evidence, changed bytes, different filer or report date fail closed",()=>{
  for(const [filings,reviews] of [
    [[a,b],[{...review,evidenceNote:""}]],
    [[a,b],[{...review,amendmentSha256:"changed"}]],
    [[a,{...b,reference:{...b.reference,lastName:"Another"}}],[review]],
    [[a,{...b,title:"Periodic Transaction Report for 07/01/2026 (Amendment 1)"}],[review]],
  ] as [Filing[],SenateAmendmentReview[]][]) assert.equal(reconcileSenateReports(filings,reviews).ready,false);
});
test("duplicate versions and conflicting reviews fail closed",()=>{
  assert.equal(reconcileSenateReports([a,a],[]).ready,false);
  assert.equal(reconcileSenateReports([a,b],[review,review]).ready,false);
});
test("normal originals pass reconciliation but do not receive publication approval",()=>{
  const result=reconcileSenateReports([a],[]);assert.equal(result.ready,true);assert.equal(result.publicationApproved,false);
});
