import test from "node:test";
import assert from "node:assert/strict";
import { SenateSession, officialSenateUrl, parseSearchPage, paperScanUrls, isoDate, type SenateReportReference } from "../src/lib/senate/source.ts";
import { parseSenateReport } from "../src/lib/senate/parse.ts";

// Synthetic parser unit fixture, not a person's real disclosure. Real sources stay in run evidence.
const reference: SenateReportReference = { id: "00000000-0000-0000-0000-000000000001", url: "https://efdsearch.senate.gov/search/view/ptr/00000000-0000-0000-0000-000000000001/",
  firstName: "Example", lastName: "Filer", office: "Filer, Example (Senator)", reportTitle: "Periodic Transaction Report for 09/09/2026", receivedDate: "2026-09-09", format: "electronic" };
const headers = ["#", "Transaction Date", "Owner", "Ticker", "Asset Name", "Asset Type", "Type", "Amount", "Comment"];
function fixture(cells = ["1", "08/11/2026", "Spouse", "AAPL", "Apple Inc.", "Stock", "Purchase", "$1,001 - $15,000", "--"]) {
  return `<h1>Periodic Transaction Report for 09/09/2026</h1><h2>The Honorable Example Filer</h2><strong>Filed 09/09/2026 @ 3:52 PM</strong>
    <p>I will submit an electronic amendment to this report.</p><li>(1 transactions total)</li><table><caption>List of transactions added to this report</caption>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody><tr>${cells.map(c=>`<td>${c}</td>`).join("")}</tr></tbody></table>`;
}
test("official-only URLs reject credentials and lookalike hosts", () => {
  assert.equal(officialSenateUrl("/search/"), "https://efdsearch.senate.gov/search/");
  for (const url of ["https://evil.example/search/", "http://efdsearch.senate.gov/search/", "https://a:b@efdsearch.senate.gov/search/", "https://efdsearch.senate.gov.evil.example/search/"]) assert.throws(()=>officialSenateUrl(url));
});
test("Senate dates reject rollovers",()=>{
  assert.equal(isoDate("09/09/2026"),"2026-09-09");
  for(const d of ["02/30/2026","2026-13-01","yesterday",""]) assert.throws(()=>isoDate(d));
});
test("index preserves received date and report identity",()=>{
  const parsed=parseSearchPage({recordsFiltered:1,data:[["Example","Filer","Filer, Example (Senator)",`<a href="${reference.url}">${reference.reportTitle}</a>`,"09/09/2026"]]});
  assert.deepEqual(parsed.reports,[reference]);
  assert.throws(()=>parseSearchPage({recordsFiltered:"1",data:[]}));
  assert.throws(()=>parseSearchPage({recordsFiltered:1,data:[["Example","Filer","Candidate","<a href='/search/'>Annual</a>","09/09/2026"]]}));
});
test("access acknowledgment is required before any network request",async()=>{
  let calls=0;const client=new SenateSession(async()=>{calls++;return new Response("");},0);
  await assert.rejects(client.acceptAccess(false),/acknowledgment/);
  await assert.rejects(client.searchPage("2026-09-01","2026-09-13",0),/not authorized/);
  assert.equal(calls,0);
});
test("paper Senator reports are enumerated instead of disappearing from coverage",()=>{
  const parsed=parseSearchPage({recordsFiltered:1,data:[["Example","Filer","Senator",`<a href="${reference.url.replace('/ptr/','/paper/')}">${reference.reportTitle}</a>`,"09/09/2026"]]});
  assert.equal(parsed.reports[0].format,"paper");
});
test("redirect never leaks Senate cookies to an external host",async()=>{
  let calls=0;const client=new SenateSession(async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://other.example/search/"}});},0);
  await assert.rejects(client.acceptAccess(true),/Non-official/);assert.equal(calls,1);
});
test("unexpected access page is not silently accepted",async()=>{
  const client=new SenateSession(async()=>new Response("Changed terms"),0);
  await assert.rejects(client.acceptAccess(true),/agreement changed/);
});
test("a changed use notice never reaches an acceptance POST",async()=>{
  const methods: string[]=[];const client=new SenateSession(async(_url,init)=>{methods.push(init?.method??"GET");return new Response(`<p>Title 1 of the Ethics in Government Act UPDATED CONDITIONS I understand the prohibitions</p><input name="csrfmiddlewaretoken" value="synthetic"><input name="prohibition_agreement">`);},0);
  await assert.rejects(client.acceptAccess(true),/agreement changed/);assert.deepEqual(methods,["GET"]);
});
test("PTR keeps owner and separate dates; boilerplate is not an amendment",()=>{
  const report=parseSenateReport(fixture(),reference);
  assert.equal(report.filedDate,"2026-09-09");assert.equal(report.rows[0].transactionDate,"2026-08-11");
  assert.equal(report.rows[0].owner,"Spouse");assert.equal(report.amendment,false);
  assert.equal(report.rows[0].listedSecurityCandidate,true);assert.equal(report.publicationApproved,false);
  assert.equal(report.rows[0].amountLow,1001);assert.equal(report.rows[0].amountHigh,15000);
});
test("non-public and unrecognized assets remain visible but out of stock activity",()=>{
  const report=parseSenateReport(fixture(["1","08/11/2026","Spouse","--","Private asset","Non-Public Stock","Sale (Full)","$50,001 - $100,000","--"]),reference);
  assert.equal(report.rows.length,1);assert.equal(report.rows[0].ticker,null);assert.equal(report.rows[0].listedSecurityCandidate,false);
});
test("bad amounts and dates are not converted into zero or valid activity",()=>{
  const row=parseSenateReport(fixture(["1","10/11/2026","Spouse","AAPL","Apple","Stock","Purchase","unknown","--"]),reference).rows[0];
  assert.equal(row.amountLow,null);assert.equal(row.listedSecurityCandidate,false);
  assert.deepEqual(row.issues,["transaction_after_filing","amount_needs_review"]);
});
test("changed columns, truncated report and missing timestamp fail closed",()=>{
  for(const html of [fixture().replace("Transaction Date</th>","Different</th>"),fixture().replace("(1 transactions total)","(2 transactions total)"),fixture().replace("Filed 09/09/2026 @ 3:52 PM","")]) assert.throws(()=>parseSenateReport(html,reference));
});
test("actual amendment label and index/document received-date difference are preserved",()=>{
  const report=parseSenateReport(fixture().replace("<h1>Periodic Transaction Report for","<h1>Periodic Transaction Report Amendment for"),{...reference,receivedDate:"2026-09-08"});
  assert.deepEqual(report.warnings,["document_filed_date_differs_from_index_received_date","amendment_requires_reconciliation"]);
});
test("source row identity is stable when displayed row number changes",()=>{
  assert.equal(parseSenateReport(fixture(),reference).rows[0].id,parseSenateReport(fixture().replace("<td>1</td>","<td>8</td>"),reference).rows[0].id);
});
test("Senate Child owner label is preserved without counting a bond as listed stock",()=>{
  const row=parseSenateReport(fixture(["1","08/11/2026","Child","--","Corporate bond","Corporate Bond","Purchase","$1,001 - $15,000","--"]),reference).rows[0];
  assert.equal(row.owner,"Child");assert.deepEqual(row.issues,[]);assert.equal(row.listedSecurityCandidate,false);
});
test("scan manifests require official media URLs and reconciled page counts",()=>{
  const url="https://efd-media-public.senate.gov/media/2026/2/000/000/000000521.gif";
  const html=`<img class="filingImage" src="${url}">Page 1 of 1`;
  assert.deepEqual(paperScanUrls(html),[url]);
  assert.throws(()=>paperScanUrls(html.replace("Page 1 of 1","Page 1 of 2")));
  assert.throws(()=>paperScanUrls(html.replace("efd-media-public.senate.gov","other.example")));
});
test("electronic parser rejects mismatched report URL identity",()=>{
  assert.throws(()=>parseSenateReport(fixture(),{...reference,id:"00000000-0000-0000-0000-000000000002"}),/identity/);
});
test("source timestamps can omit minutes on the hour without inventing precision",()=>{
  assert.equal(parseSenateReport(fixture().replace("3:52 PM","12 PM"),reference).filedTimestampRaw,"09/09/2026 @ 12 PM");
  assert.throws(()=>parseSenateReport(fixture().replace("3:52 PM","25:99 PM"),reference));
});
