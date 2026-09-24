import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {replayInstitutionRun} from "../src/lib/institutions/archive.ts";
import {parseInstitutionalFiling,parseInstitutionalNotice,managerIdentity} from "../src/lib/institutions/parse.ts";
import {validateManagerCorpus} from "../src/lib/institutions/validation.ts";
const base=new URL("../data/institution-runs/",import.meta.url).pathname;
const vanguard=join(base,"institutions_76d5610d-ada3-462d-a544-2a74afabe8fc"),stateStreet=join(base,"institutions_369fe8d2-bfde-4fb1-bef0-af47f76b3e4a");
test("28 and official zero-padded 028 file numbers resolve identically",()=>{
  assert.equal(managerIdentity(null,"028-00733"),managerIdentity(null,"28-733"));
  for(const bad of ["0028-733","29-733","028-7,33"])assert.throws(()=>managerIdentity(null,bad));
});
test("Vanguard 000031 is a combination; 002707 and 002714 are notices, never zero holdings",{skip:!existsSync(join(vanguard,"manifest.json"))&&"official local corpus unavailable"},()=>{
  const r=replayInstitutionRun(vanguard),v=validateManagerCorpus(r.filings,r.failures,r.notices);
  assert.deepEqual(r.failures,[]);assert.equal(r.filings.length,1);assert.equal(r.filings[0].reference.accession,"0000102909-26-000031");
  assert.equal(r.filings[0].reportType,"13F COMBINATION REPORT");assert.equal(r.filings[0].holdings.length,17686);
  assert.deepEqual(r.notices.map(n=>n.reference.accession),["0000102909-26-002707","0000102909-26-002714"]);
  assert.deepEqual(r.notices.map(n=>n.period),["2026-03-31","2026-06-30"]);
  assert.ok(r.notices.every(n=>n.otherReportingManagers.length===10&&!('holdings' in n)));
  assert.equal(v.comparison,null);assert.equal(v.eligibleFilings,0);assert.equal(v.held.length,3);
  const item=r.run.filings.find(f=>f.reference.form==="13F-NT")!,source=readFileSync(join(vanguard,"raw",item.evidence!.file),"utf8");
  assert.throws(()=>parseInstitutionalFiling(source,item.reference),/Notice is not/);
  assert.throws(()=>parseInstitutionalNotice(source.replace("13F NOTICE","13F HOLDINGS REPORT"),item.reference),/conflicts/);
});
test("State Street 000100,000315,000507 omit the original-form amendment checkbox in X0202",{skip:!existsSync(join(stateStreet,"manifest.json"))&&"official local corpus unavailable"},()=>{
  const r=replayInstitutionRun(stateStreet),v=validateManagerCorpus(r.filings,r.failures,r.notices);
  assert.deepEqual(r.failures,[]);assert.deepEqual(r.filings.map(f=>f.reference.accession),["0000093751-26-000100","0000093751-26-000315","0000093751-26-000507"]);
  assert.deepEqual(r.filings.map(f=>f.holdings.length),[4288,4269,4177]);assert.ok(r.filings.every(f=>!f.amendment&&f.amendmentFlagSource==="original_form_omitted_flag"));
  assert.equal(v.held.length,0);assert.equal(v.comparison?.positions.length,4991);
  const item=r.run.filings[1],source=readFileSync(join(stateStreet,"raw",item.evidence!.file),"utf8");
  for(const changed of [source.replace("CONFORMED SUBMISSION TYPE:\t13F-HR","CONFORMED SUBMISSION TYPE:\t13F-HR/A"),source.replace("<schemaVersion>X0202","<schemaVersion>X9999"),source.replace('xmlns="http://www.sec.gov/edgar/thirteenffiler"','xmlns="urn:unsupported"'),source.replace("<filingManager>","<amendmentNo>1</amendmentNo><filingManager>")]) {
    assert.notEqual(changed,source);assert.throws(()=>parseInstitutionalFiling(changed,item.reference));
  }
});
