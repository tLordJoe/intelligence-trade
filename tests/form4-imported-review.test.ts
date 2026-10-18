import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {parseForm4} from "../src/lib/form4/parse.ts";
import {writeCandidateFile} from "../src/lib/form4/candidate-storage.ts";
import {insiderUniverseHash,type InsiderUniverse} from "../src/lib/form4/universe.ts";
import {loadImportedInsiderReview} from "../src/lib/form4/imported-review.ts";
test("stored publication requires passing EDGAR journals and exact source hashes; raw replay is not claimed",()=>{
  const root=mkdtempSync(join(tmpdir(),"outfox-import-journal-")),data=join(root,"data"),runId="form4_synthetic_test",run=join(data,"form4-runs",runId);
  try{
    mkdirSync(run,{recursive:true});
    const fixtures=join(import.meta.dirname,"fixtures/form4"),manifest=JSON.parse(readFileSync(join(fixtures,"manifest.json"),"utf8"));
    const entry=manifest.filings.find((e:{accession:string})=>e.accession==="0001045810-23-000006");
    const parsed=parseForm4({xml:readFileSync(join(fixtures,"documents",entry.file),"utf8"),accessionNumber:entry.accession,documentUrl:entry.documentUrl,indexUrl:entry.indexUrl,documentName:entry.documentName,importRunId:runId,firstObservedAt:"2026-10-01T00:00:00Z",filedDate:"2023-01-25"});assert.ok(parsed.ok);
    const filing=parsed.filing;
    const universe:InsiderUniverse={schemaVersion:1,source:"sec-company-tickers",sourceSha256:"a".repeat(64),capturedAt:"2026-10-01",entries:[{cik:filing.issuer.cik,ticker:filing.issuer.tradingSymbol!,title:"Synthetic test universe"}]};
    const save=(name:string,value:unknown)=>writeFileSync(join(run,name),JSON.stringify(value));
    writeFileSync(join(data,"security-master.json"),JSON.stringify({entries:{NVDA:{ticker:filing.issuer.tradingSymbol,cik:filing.issuer.cik}}}));
    save("universe.json",universe);save("selection.json",{universeSha256:insiderUniverseHash(universe),allAccessions:[filing.accessionNumber],batchAccessions:[filing.accessionNumber]});
    const summary={runId,source:"edgar",passed:true,promoted:true,enumeration:{complete:true},gateFailures:[],counts:{selected:1},selection:{from:"2023-01-25",to:"2023-01-25",issuers:["NVDA"]}};
    save("summary.json",summary);const source={accessionNumber:filing.accessionNumber,sha256:filing.documentSha256,documentUrl:filing.documentUrl};save("manifest.json",[source]);
    writeCandidateFile(join(data,"form4-candidate.json"),{schemaVersion:1,updatedAt:"2026-10-01",runIds:[runId],filings:[filing]});
    const review=loadImportedInsiderReview(root,data);assert.equal(review.filingCount,1);assert.match(review.verificationBasis,/not freshly replayed/);
    save("summary.json",{...summary,source:"fixtures"});assert.throws(()=>loadImportedInsiderReview(root,data),/source gates/);save("summary.json",summary);
    save("manifest.json",[{...source,sha256:"b".repeat(64)}]);assert.throws(()=>loadImportedInsiderReview(root,data),/differs from successful source import/);
  }finally{rmSync(root,{recursive:true,force:true});}
});
