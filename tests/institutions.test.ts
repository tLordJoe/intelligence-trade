import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseInstitutionalFiling, digest, filingUrl, TableReconciliationError, type FilingReference } from "../src/lib/institutions/parse.ts";
import { positionChanges, reconcileInstitutions } from "../src/lib/institutions/reconcile.ts";
import { references, allowedSecUrl, SecReader } from "../src/lib/institutions/source.ts";
import { validateManagerCorpus } from "../src/lib/institutions/validation.ts";
import { replayInstitutionRun, type InstitutionRun } from "../src/lib/institutions/archive.ts";
import { approvedInstitutions, payloadHash, limitations, type InstitutionPayload } from "../src/lib/institutions/release.ts";

// Deliberately synthetic, never collected, published, or represented as real SEC data.
const ref:FilingReference={accession:"0000000001-26-000001",cik:"0000000001",filedDate:"2026-05-15",form:"13F-HR"};
function fixture(r=ref,period="2026-03-31",quantity="12.5",amendment=false){return `ACCESSION NUMBER: ${r.accession}
FILED AS OF DATE: ${r.filedDate.replaceAll("-","")}
<DOCUMENT><TYPE>${r.form}
<XML><edgarSubmission><headerData><submissionType>${r.form}</submissionType><filerInfo><filer><credentials><cik>${r.cik}</cik></credentials></filer><periodOfReport>${period}</periodOfReport></filerInfo></headerData><formData><coverPage><reportCalendarOrQuarter>${period}</reportCalendarOrQuarter><isAmendment>${amendment}</isAmendment>${amendment?"<amendmentNo>1</amendmentNo><amendmentInfo><amendmentType>NEW HOLDINGS</amendmentType></amendmentInfo>":""}<filingManager><name>Synthetic Manager</name></filingManager><reportType>13F HOLDINGS REPORT</reportType></coverPage><summaryPage><otherIncludedManagersCount>0</otherIncludedManagersCount><tableEntryTotal>1</tableEntryTotal><tableValueTotal>100</tableValueTotal><isConfidentialOmitted>false</isConfidentialOmitted></summaryPage></formData></edgarSubmission></XML></DOCUMENT>
<DOCUMENT><TYPE>INFORMATION TABLE
<XML><informationTable><infoTable><nameOfIssuer>Synthetic Issuer</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>123456789</cusip><value>100</value><shrsOrPrnAmt><sshPrnamt>${quantity}</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt><investmentDiscretion>SOLE</investmentDiscretion><votingAuthority><Sole>12</Sole><Shared>0</Shared><None>0</None></votingAuthority></infoTable></informationTable></XML></DOCUMENT>`;}
const original=parseInstitutionalFiling(fixture(),ref);
test("collector contact must be explicit and header safe",()=>{
  for(const agent of ["", "Outfox", "Outfox hello@example.com\nother: value"])assert.throws(()=>new SecReader(agent));
  assert.doesNotThrow(()=>new SecReader("Outfox Markets hello@outfoxmarkets.com"));
});
test("single manager validation compares latest two quarters and never skips held latest filings",()=>{
  const r={...ref,accession:"0000000001-26-000002",filedDate:"2026-08-15"};
  const next=parseInstitutionalFiling(fixture(r,"2026-06-30","15"),r);
  assert.equal(validateManagerCorpus([original,next]).comparison?.positions[0].observedQuantityDifference,"2.5");
  assert.equal(validateManagerCorpus([original,next],["missing accession"]).comparison,null);
  const amended={...next,amendment:true,reference:{...r,accession:"0000000001-26-000003",form:"13F-HR/A" as const}};
  assert.equal(validateManagerCorpus([original,next,amended]).comparison,null);
  assert.throws(()=>validateManagerCorpus([original,{...next,reference:{...r,cik:"0000000002"}}]));
});
test("13F retains quarter, filing date, accession, manager, security and value/share units",()=>{
  assert.equal(original.period,"2026-03-31");assert.equal(original.reference.filedDate,"2026-05-15");assert.equal(original.holdings[0].quantity,"12.5");
  assert.equal(original.holdings[0].cusip,"123456789");assert.equal(original.holdings[0].valueUsd,"100");assert.equal(original.valueUnit,"USD");
  assert.equal(original.sourceSha256,digest(fixture()));assert.ok(!("ticker" in original.holdings[0]));
});
test("older-filed values retain thousands; never apply units from report quarter",()=>{
  const r={...ref,filedDate:"2022-11-15"};const f=parseInstitutionalFiling(fixture(r,"2022-09-30"),r);assert.equal(f.holdings[0].valueUsd,"100000");
  const later={...ref,filedDate:"2023-01-03"};assert.equal(parseInstitutionalFiling(fixture(later,"2022-12-31"),later).valueUnit,"USD");
});
test("source identity, malformed XML, inconsistent totals and unknown quantities fail closed",()=>{
  for(const source of [fixture().replace("<tableEntryTotal>1","<tableEntryTotal>2"),fixture().replace("<tableValueTotal>100","<tableValueTotal>200"),fixture().replace("<cik>0000000001","<cik>0000000002"),fixture().replace("<informationTable>","<!DOCTYPE informationTable><informationTable>"),fixture().replace("<sshPrnamtType>SH","<sshPrnamtType>UNKNOWN"),fixture().replace("FILED AS OF DATE: 20260515","FILED AS OF DATE: 20260514")])assert.throws(()=>parseInstitutionalFiling(source,ref));
});
test("both amendment kinds and duplicate originals hold entire manager-period families",()=>{
  const r={...ref,accession:"0000000001-26-000002",form:"13F-HR/A" as const};
  for(const kind of ["NEW HOLDINGS","RESTATEMENT"]){const amendment=parseInstitutionalFiling(fixture(r,"2026-03-31","13",true).replace("NEW HOLDINGS",kind),r);const result=reconcileInstitutions([original,amendment]);assert.equal(result.active.length,0);assert.equal(result.held.length,1);}
  assert.equal(reconcileInstitutions([original,{...original,reference:{...ref,accession:r.accession}}]).active.length,0);
  assert.equal(reconcileInstitutions([original,original]).active.length,1);
  assert.equal(reconcileInstitutions([original,{...original,sourceSha256:"changed"}]).active.length,0);
});
test("unparsed notices, confidential holdings and combination reports cannot be silently ignored",()=>{
  assert.equal(reconcileInstitutions([original],[ref.cik]).active.length,0);
  for(const changed of [{...original,confidentialOmitted:true},{...original,otherIncludedManagers:1},{...original,reportType:"13F COMBINATION REPORT"}])assert.equal(reconcileInstitutions([changed]).active.length,0);
});
test("quarterly quantity differences preserve option/class/discretion boundaries, not trades",()=>{
  const r={...ref,accession:"0000000001-26-000002",filedDate:"2026-08-15"};const next=parseInstitutionalFiling(fixture(r,"2026-06-30","15"),r);
  const change=positionChanges(original,next)[0];assert.equal(change.observedQuantityDifference,"2.5");assert.match(change.caveat,/not executed trades/);
  const option={...next,holdings:[{...next.holdings[0],putCall:"Call" as const}]};assert.equal(positionChanges(original,option).length,2);assert.ok(positionChanges(original,option).every(c=>c.observedQuantityDifference===null));
  assert.throws(()=>positionChanges(original,{...next,period:"2026-09-30"}));
  assert.throws(()=>positionChanges(original,{...next,reference:{...r,cik:"0000000002"}}));
});
test("SEC source URLs refuse redirects/off-origin paths; enumeration cannot truncate columns",()=>{
  assert.equal(allowedSecUrl(filingUrl(ref)),filingUrl(ref));
  for(const url of ["https://example.com/file","https://www.sec.gov.evil.test/Archives/file","https://data.sec.gov/submissions/CIK0000000001.json?x=1"])assert.throws(()=>allowedSecUrl(url));
  const columns={accessionNumber:[ref.accession],filingDate:[ref.filedDate],form:[ref.form]};assert.equal(references(columns,ref.cik,"2026-01-01","2026-12-31").length,1);
  assert.throws(()=>references({...columns,form:[]},ref.cik,"2026-01-01","2026-12-31"));
});
test("immutable evidence replay detects changed bytes, incomplete enumeration and historical gaps",()=>{
  const root=mkdtempSync(join(tmpdir(),"outfox-13f-test-"));mkdirSync(join(root,"raw"));
  try{
    const data=JSON.stringify({cik:1,filings:{recent:{accessionNumber:[ref.accession],filingDate:[ref.filedDate],form:[ref.form]},files:[]}});
    const evidence=(value:string,url:string)=>{const sha256=digest(value),file=`${sha256}.raw`;writeFileSync(join(root,"raw",file),value);return{sha256,file,url};};
    const run:InstitutionRun={schemaVersion:1,source:"SEC",runId:"synthetic-test",collectedAt:"2026-09-15T00:00:00Z",cik:ref.cik,from:"2026-01-01",to:"2026-09-15",complete:true,indexes:[evidence(data,`https://data.sec.gov/submissions/CIK${ref.cik}.json`)],references:[ref],filings:[{reference:ref,evidence:evidence(fixture(),filingUrl(ref))}]};
    const save=()=>writeFileSync(join(root,"manifest.json"),JSON.stringify(run));save();assert.equal(replayInstitutionRun(root).filings.length,1);
    run.complete=false;save();assert.throws(()=>replayInstitutionRun(root));run.complete=true;save();
    const originalIndex=run.indexes[0];
    const historical=JSON.parse(data);historical.filings.files=[{name:`CIK${ref.cik}-submissions-001.json`,filingFrom:"2026-01-01",filingTo:"2026-06-01"}];
    run.indexes=[evidence(JSON.stringify(historical),originalIndex.url)];save();assert.throws(()=>replayInstitutionRun(root),/Historical submissions coverage incomplete/);
    run.indexes=[originalIndex];save();
    writeFileSync(join(root,"raw",run.indexes[0].file),"changed");assert.throws(()=>replayInstitutionRun(root),/Changed immutable/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test("public gate rejects pending, changed and held payloads",()=>{
  const payload:InstitutionPayload={schemaVersion:1,source:"SEC Form 13F",semantics:"quarter_end_reported_holdings",coverage:[{cik:ref.cik,from:"2026-01-01",to:"2026-09-15",collectedAt:"2026-09-15T00:00:00Z"}],limitations,filings:[original]};
  assert.equal(approvedInstitutions({payload,approval:null}),null);
  const approval={reviewedBy:"Synthetic unit test",reviewedAt:"2026-09-15",sha256:payloadHash(payload),partialCoverageAcknowledged:true};
  assert.equal(approvedInstitutions({payload,approval})?.filings.length,1);
  assert.throws(()=>approvedInstitutions({payload:{...payload,limitations:"changed"},approval}));
  const held={...payload,filings:[{...original,amendment:true}]};assert.throws(()=>approvedInstitutions({payload:held,approval:{...approval,sha256:payloadHash(held)}}));
  assert.equal(approvedInstitutions(JSON.parse(readFileSync(new URL("../src/lib/institutions-live.json",import.meta.url),"utf8"))),null);
});

const berkshireDirectory=new URL("../data/institution-runs/institutions_341b46e8-2c03-4f10-889b-01b7c509422f/",import.meta.url).pathname;
test("archived official Berkshire reports resolve 14 included managers without false family holds",{skip:!existsSync(join(berkshireDirectory,"manifest.json"))&&"official local corpus unavailable"},()=>{
  const replay=replayInstitutionRun(berkshireDirectory);
  assert.equal(replay.failures.length,0);assert.equal(replay.filings.length,3);
  const result=validateManagerCorpus(replay.filings,replay.failures);
  assert.equal(result.held.length,0);assert.equal(result.comparison?.previousPeriod,"2026-03-31");assert.equal(result.comparison?.currentPeriod,"2026-06-30");
  const current=replay.filings.find(f=>f.period==="2026-06-30")!,previous=replay.filings.find(f=>f.period==="2026-03-31")!;
  assert.equal(previous.holdings.length,90);assert.equal(current.holdings.length,89);assert.equal(current.includedManagers.length,14);
  assert.ok(current.holdings.every(row=>row.otherManagerIds.length>0));
  const evidence=replay.run.filings.find(f=>f.reference.accession===current.reference.accession)!.evidence!;
  const source=readFileSync(join(berkshireDirectory,"raw",evidence.file),"utf8");
  const renumbered=source.replace(/<sequenceNumber>(\d+)<\/sequenceNumber>/g,(_,n)=>`<sequenceNumber>${Number(n)+100}</sequenceNumber>`).replace(/<otherManager>([\d, ]+)<\/otherManager>/g,(_,raw)=>`<otherManager>${raw.split(",").map((n:string)=>Number(n.trim())+100).join(",")}</otherManager>`).replace(/<figi>[^<]+<\/figi>/g,"");
  const revised=parseInstitutionalFiling(renumbered,current.reference);
  const summarize=(rows:ReturnType<typeof positionChanges>)=>rows.map(r=>({cusip:r.security.cusip,managers:r.security.otherManagerIds,status:r.status,previous:r.previousQuantity,current:r.currentQuantity,difference:r.observedQuantityDifference}));
  assert.deepEqual(summarize(positionChanges(previous,revised)),summarize(positionChanges(previous,current)));
  assert.throws(()=>parseInstitutionalFiling(source.replace("<otherIncludedManagersCount>14","<otherIncludedManagersCount>13"),current.reference),/count or identity/);
  assert.throws(()=>parseInstitutionalFiling(source.replace(/<otherManager>[\d, ]+<\/otherManager>/,"<otherManager>999</otherManager>"),current.reference),/Unresolved/);
  assert.throws(()=>parseInstitutionalFiling(source.replace("<sequenceNumber>2","<sequenceNumber>1"),current.reference),/count or identity/);
});
test("optional FIGI does not create false quarterly entries or exits",()=>{
  const next={...original,period:"2026-06-30",reference:{...ref,accession:"0000000001-26-000002"},holdings:[{...original.holdings[0],figi:"BBG000B9XRY4"}]};
  const result=positionChanges(original,next);assert.equal(result.length,1);assert.equal(result[0].observedQuantityDifference,"0");
});
test("included manager ordinals resolve to stable file identities and preserve attribution boundaries",()=>{
  const included="<otherManagers2Info><otherManager2><sequenceNumber>1</sequenceNumber><otherManager><form13FFileNumber>28-00123</form13FFileNumber><name>Included synthetic manager</name></otherManager></otherManager2></otherManagers2Info>";
  const source=fixture().replace("<otherIncludedManagersCount>0","<otherIncludedManagersCount>1").replace("</summaryPage>",`${included}</summaryPage>`).replace("<investmentDiscretion>SOLE</investmentDiscretion>","<investmentDiscretion>DFND</investmentDiscretion><otherManager>1</otherManager>");
  const before=parseInstitutionalFiling(source,ref);assert.deepEqual(before.holdings[0].otherManagerIds,["13f:28-123"]);assert.equal(reconcileInstitutions([before]).held.length,0);
  const nextRef={...ref,accession:"0000000001-26-000002",filedDate:"2026-08-15"};
  const revised=source.replaceAll(ref.accession,nextRef.accession).replace("20260515","20260815").replaceAll("2026-03-31","2026-06-30").replace("<sequenceNumber>1","<sequenceNumber>9").replace("<otherManager>1</otherManager>","<otherManager>9</otherManager>").replace("28-00123","28-123");
  const after=parseInstitutionalFiling(revised,nextRef);assert.equal(positionChanges(before,after)[0].observedQuantityDifference,"0");
  const different=parseInstitutionalFiling(revised.replace("28-123","28-456"),nextRef);assert.equal(positionChanges(before,different).length,2);
  assert.throws(()=>parseInstitutionalFiling(source.replace("<form13FFileNumber>28-00123</form13FFileNumber>",""),ref),/no stable/);
  assert.throws(()=>parseInstitutionalFiling(source.replace("<otherManager>1</otherManager>","<otherManager>1,1</otherManager>"),ref),/Duplicate/);
  assert.equal(reconcileInstitutions([{...before,holdings:[{...before.holdings[0],otherManagerIds:["forged"]}]}]).held[0].reason,"invalid_included_manager_attribution");
});
test("omitted amendment checkbox needs corroborated X0202 original form, never blanket false",()=>{
  const source=`CONFORMED SUBMISSION TYPE:\t13F-HR\n${fixture()}`.replace("<edgarSubmission>",'<edgarSubmission xmlns="http://www.sec.gov/edgar/thirteenffiler"><schemaVersion>X0202</schemaVersion>').replace("<isAmendment>false</isAmendment>","");
  assert.equal(parseInstitutionalFiling(source,ref).amendmentFlagSource,"original_form_omitted_flag");
  assert.throws(()=>parseInstitutionalFiling(source.replace("CONFORMED SUBMISSION TYPE:\t13F-HR","CONFORMED SUBMISSION TYPE:\t13F-HR/A"),ref));
  assert.throws(()=>parseInstitutionalFiling(source.replace("<schemaVersion>X0202","<schemaVersion>X9999"),ref));
  assert.throws(()=>parseInstitutionalFiling(source.replace("<filingManager>","<amendmentInfo/><filingManager>"),ref));
  assert.throws(()=>parseInstitutionalFiling(fixture().replace("<isAmendment>false</isAmendment>",""),ref));
});
test("even a one-dollar mismatch is preserved and held, not hidden by a tolerance",()=>{
  assert.throws(()=>parseInstitutionalFiling(fixture().replace("<tableValueTotal>100","<tableValueTotal>101"),ref),(error:unknown)=>{
    assert.ok(error instanceof TableReconciliationError);assert.equal(error.issue.declaredValue,"101");assert.equal(error.issue.computedValue,"100");assert.equal(error.issue.valueDifference,"-1");assert.equal(error.issue.computedEntries,1);return true;
  });
  assert.equal(reconcileInstitutions([{...original,computedValue:"99"}]).held[0].reason,"table_totals_do_not_reconcile");
});
