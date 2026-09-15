import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { validatePlan, assessManagerRun, type CohortPlan, type ManagerUniverse } from "../src/lib/institutions/cohort.ts";
const universe=JSON.parse(readFileSync(new URL("../data/institution-manager-universe.json",import.meta.url),"utf8")) as ManagerUniverse;
const plan:CohortPlan={universe,from:"2026-01-01",to:"2026-09-15",previousPeriod:"2026-03-31",currentPeriod:"2026-06-30",maxFilings:40};
test("first institutional cohort is explicit, unique, bounded and not asserted universal",()=>{
  assert.equal(universe.managers.length,13);assert.match(universe.scope,/not all institutional managers/);
  assert.match(validatePlan(plan),/^[a-f0-9]{64}$/);
  assert.notEqual(validatePlan(plan),validatePlan({...plan,to:"2026-09-16"}));
  assert.throws(()=>validatePlan({...plan,universe:{...universe,managers:[universe.managers[0],universe.managers[0]]}}),/duplicate/);
  assert.throws(()=>validatePlan({...plan,currentPeriod:"2026-09-30"}));
  assert.throws(()=>validatePlan({...plan,previousPeriod:"2025-12-31"}),/consecutive/);
  assert.throws(()=>validatePlan({...plan,from:"2026-04-01"}),/earlier quarter/);
  assert.throws(()=>validatePlan({...plan,maxFilings:1000}));
});
const directory=new URL("../data/institution-runs/institutions_341b46e8-2c03-4f10-889b-01b7c509422f/",import.meta.url).pathname;
test("cohort readiness replays official evidence and requires identity plus exact requested quarters",{skip:!existsSync(`${directory}/manifest.json`)&&"official local corpus unavailable"},()=>{
  const manager=universe.managers[0],result=assessManagerRun(directory,manager,plan);
  assert.equal(result.status,"ready_for_review");assert.equal(result.parsedRows,289);assert.equal(result.requestedQuarterRows,179);assert.equal(result.enumeratedFilings,3);
  assert.equal(result.comparison?.attributedPositions,93);assert.equal(result.held.length,0);assert.equal(result.failures.length,0);
  const wrong=assessManagerRun(directory,{...manager,secNames:["UNRELATED COMPANY"]},plan);assert.equal(wrong.status,"held");assert.equal(wrong.comparison,null);
  assert.equal(assessManagerRun(directory,manager,{...plan,previousPeriod:"2025-12-31",currentPeriod:"2026-03-31"}).status,"held");
  assert.throws(()=>assessManagerRun(directory,manager,{...plan,to:"2026-09-16"}),/coverage plan/);
});
