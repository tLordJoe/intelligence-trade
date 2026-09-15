import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {replayInstitutionRun} from "../src/lib/institutions/archive.ts";
import {validateManagerCorpus} from "../src/lib/institutions/validation.ts";
const base=new URL("../data/institution-runs/",import.meta.url).pathname;
for(const expected of [
  {run:"institutions_940bee50-8bba-46ed-9808-46ab97ff7668",accession:"0000315066-26-002260",declaredEntries:13978,computedEntries:13978,declaredValue:"2303878429728",computedValue:"2303878429723",difference:"-5"},
  {run:"institutions_77da5dc0-e447-4381-bab1-dcf1d26bc048",accession:"0000019617-26-000212",declaredEntries:33063,computedEntries:378,declaredValue:"1557139501048",computedValue:"3085467664",difference:"-1554054033384"}
])test(`official ${expected.accession} retains mismatching source totals and cannot pass`,{skip:!existsSync(join(base,expected.run,"manifest.json"))&&"official local corpus unavailable"},()=>{
  const directory=join(base,expected.run),r=replayInstitutionRun(directory),issue=r.reconciliationIssues.find(i=>i.accession===expected.accession)!;
  assert.ok(issue);assert.equal(issue.declaredEntries,expected.declaredEntries);assert.equal(issue.computedEntries,expected.computedEntries);assert.equal(issue.declaredValue,expected.declaredValue);assert.equal(issue.computedValue,expected.computedValue);assert.equal(issue.valueDifference,expected.difference);assert.equal(issue.valueUnit,"USD");assert.equal(issue.informationTableDocuments,1);
  // Independent lexical tally confirms that XML traversal did not skip prefixed rows.
  const entry=r.run.filings.find(f=>f.reference.accession===expected.accession)!,raw=readFileSync(join(directory,"raw",entry.evidence!.file),"utf8");
  assert.equal([...raw.matchAll(/<(?:\w+:)?infoTable>/g)].length,expected.computedEntries);
  assert.equal([...raw.matchAll(/<(?:\w+:)?value>(\d+)<\/(?:\w+:)?value>/g)].reduce((sum,m)=>sum+BigInt(m[1]),BigInt(0)).toString(),expected.computedValue);
  assert.ok(!r.filings.some(f=>f.reference.accession===expected.accession));
  const v=validateManagerCorpus(r.filings,r.failures,r.notices,r.reconciliationIssues);assert.equal(v.comparison,null);assert.equal(v.eligibleFilings,0);assert.equal(v.reconciliationIssues.length,1);
  if(expected.accession==="0000019617-26-000212"){
    const amendment=r.filings.find(f=>f.reference.accession==="0000019617-26-000225")!;
    assert.equal(amendment.amendmentType,"RESTATEMENT");assert.equal(amendment.computedEntries,33063);assert.equal(amendment.computedValue,expected.declaredValue);
  }
});
