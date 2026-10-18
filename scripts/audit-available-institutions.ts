/** Independent SAX verification of the available-filings release. No collection
 * or source writes. Audits every published information-table row. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { SaxesParser } from "saxes";
import type { InstitutionPayload } from "../src/lib/institutions/release.ts";
type Node = { name: string; text: string; children: Node[] };
function xml(source: string) {
  const parser = new SaxesParser({ xmlns: false }), stack: Node[] = [];
  let root: Node | undefined;
  parser.on("doctype", () => { throw new Error("DTD refused"); });
  parser.on("opentag", tag => {
    const node: Node = { name: tag.name.split(":").at(-1)!, text: "", children: [] };
    if (stack.length) stack.at(-1)!.children.push(node); else root=node;
    stack.push(node);
  });
  const append = (value: string) => { if(stack.length) stack.at(-1)!.text+=value; };
  parser.on("text",append); parser.on("cdata",append); parser.on("closetag",()=>{stack.pop();});
  parser.write(source).close(); return root!;
}
const one=(node:Node,name:string)=>{const found=node.children.filter(n=>n.name===name);assert.equal(found.length,1,name);return found[0];};
const value=(node:Node,name:string)=>one(node,name).text.trim();
const optional=(node:Node,name:string)=>node.children.find(n=>n.name===name)?.text.trim()||null;
const hash=(bytes:Buffer|string)=>createHash("sha256").update(bytes).digest("hex");
const root=resolve(import.meta.dirname,".."), dataRoot=resolve(process.argv[2]||root);
const candidate=JSON.parse(readFileSync(resolve(root,"data/institution-candidate.json"),"utf8")) as {payload:InstitutionPayload;sha256:string;runs:{runId:string}[];held:unknown[];excludedManagers:unknown[]};
const evidence=new Map<string,{file:string;sha256:string}>();
for(const run of candidate.runs){
  const directory=resolve(dataRoot,"data/institution-runs",run.runId);
  const manifest=JSON.parse(readFileSync(resolve(directory,"manifest.json"),"utf8"));
  for(const item of manifest.filings)if(item.evidence)evidence.set(item.reference.accession,{file:resolve(directory,"raw",item.evidence.file),sha256:item.evidence.sha256});
}
const sourceReviews=[];
let rowsChecked=0;
for(const filing of candidate.payload.filings){
  const item=evidence.get(filing.reference.accession);assert.ok(item);
  const bytes=readFileSync(item.file);assert.equal(hash(bytes),filing.sourceSha256);assert.equal(item.sha256,filing.sourceSha256);
  const source=bytes.toString("utf8");
  assert.equal(/^ACCESSION NUMBER:\s*(\S+)/m.exec(source)?.[1],filing.reference.accession);
  const documents=[...source.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g)].map(m=>({type:/<TYPE>([^\r\n<]+)/.exec(m[1])?.[1].trim(),xml:/<XML>\s*([\s\S]*?)\s*<\/XML>/.exec(m[1])?.[1]}));
  const covers=documents.filter(d=>d.type===filing.reference.form),tables=documents.filter(d=>d.type==="INFORMATION TABLE");
  assert.equal(covers.length,1);assert.equal(tables.length,1);
  const submission=xml(covers[0].xml!),form=one(submission,"formData"),cover=one(form,"coverPage"),summary=one(form,"summaryPage");
  const sourcePeriod=value(cover,"reportCalendarOrQuarter"),match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(sourcePeriod);
  assert.equal(filing.period,match?`${match[3]}-${match[1]}-${match[2]}`:sourcePeriod);
  assert.equal(filing.managerName,value(one(cover,"filingManager"),"name"));
  assert.equal(filing.reportType,value(cover,"reportType"));
  assert.equal(filing.valueUnit,filing.reference.filedDate>="2023-01-03"?"USD":"USD_thousands");
  const entries=xml(tables[0].xml!).children;assert.equal(entries.length,filing.holdings.length);
  let total=BigInt(0);
  for(let index=0;index<entries.length;index++){
    const entry=entries[index],row=filing.holdings[index];assert.equal(entry.name,"infoTable");
    assert.equal(row.id,`${filing.reference.accession}:${index+1}`);
    assert.equal(row.issuerName,value(entry,"nameOfIssuer"));assert.equal(row.titleOfClass,value(entry,"titleOfClass"));
    assert.equal(row.cusip,value(entry,"cusip").toUpperCase());assert.equal(row.figi,optional(entry,"figi"));
    assert.equal(row.valueAsFiled,BigInt(value(entry,"value")).toString());
    assert.equal(row.valueUsd,(BigInt(row.valueAsFiled)*BigInt(filing.valueUnit==="USD"?1:1000)).toString());
    const quantity=one(entry,"shrsOrPrnAmt");assert.equal(row.quantity,value(quantity,"sshPrnamt"));assert.equal(row.quantityType,value(quantity,"sshPrnamtType"));
    assert.equal(row.putCall,optional(entry,"putCall"));assert.equal(row.investmentDiscretion,value(entry,"investmentDiscretion"));assert.equal(row.otherManagers,optional(entry,"otherManager")??"");
    const voting=one(entry,"votingAuthority");for(const key of ["sole","shared","none"] as const)assert.equal(row.voting[key],BigInt(value(voting,key[0].toUpperCase()+key.slice(1))).toString());
    total+=BigInt(row.valueAsFiled);rowsChecked++;
  }
  assert.equal(BigInt(value(summary,"tableEntryTotal")),BigInt(entries.length));
  assert.equal(BigInt(value(summary,"tableValueTotal")),total);
  sourceReviews.push({accession:filing.reference.accession,sourceSha256:filing.sourceSha256,reviewedBy:"Codex",reviewedAt:new Date().toISOString(),unitsVerified:true,
    evidenceNote:`Independent SAX source audit: ${entries.length} rows; issuer/class/CUSIP/FIGI, values and USD conversion, quantities/types/options, discretion/manager qualifiers, voting authority, quarter, manager, report type and exact entry/value totals. Combination reports retained as explicitly partial snapshots.`});
  console.log(JSON.stringify({accession:filing.reference.accession,rows:entries.length,checked:true}));
}
writeFileSync(resolve(root,"data/institution-filing-reviews.json"),JSON.stringify(sourceReviews,null,2)+"\n");
const audit={auditedAt:new Date().toISOString(),reviewer:"Codex",parser:"saxes, independent of application XML parser",publicationMode:"available_filings_without_required_comparison_pair",candidateSha256:candidate.sha256,
  filings:candidate.payload.filings.length,reportingEntities:new Set(candidate.payload.filings.map(f=>f.reference.cik)).size,rowsChecked,sourceReviews,heldFamilies:candidate.held,excludedManagers:candidate.excludedManagers};
writeFileSync(resolve(root,"docs/available-institutions-release-2026-10-17.json"),JSON.stringify(audit,null,2)+"\n");
console.log(JSON.stringify({filings:audit.filings,reportingEntities:audit.reportingEntities,rowsChecked,passed:true}));
