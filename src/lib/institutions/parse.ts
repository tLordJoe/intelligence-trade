import { createHash } from "node:crypto";
import { parseXml, type XmlNode } from "../form4/xml.ts";

export const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function date(value: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  const iso = m ? `${m[3]}-${m[1]}-${m[2]}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) throw new Error("Invalid 13F date");
  return iso;
}
export interface FilingReference { accession: string; cik: string; filedDate: string; form: "13F-HR" | "13F-HR/A" | "13F-NT" | "13F-NT/A" }
export function filingUrl(ref: FilingReference) {
  if (!/^\d{10}-\d{2}-\d{6}$/.test(ref.accession) || !/^\d{10}$/.test(ref.cik) || Number(ref.cik) === 0) throw new Error("Invalid accession or manager CIK");
  date(ref.filedDate);
  return `https://www.sec.gov/Archives/edgar/data/${Number(ref.cik)}/${ref.accession.replaceAll("-", "")}/${ref.accession}.txt`;
}
const local = (node: XmlNode) => node.name.split(":").at(-1);
const children = (node: XmlNode, name: string) => node.children.filter(n => local(n) === name);
function one(node: XmlNode, name: string): XmlNode {
  const hits = children(node, name); if (hits.length !== 1) throw new Error(`Missing/ambiguous 13F ${name}`); return hits[0];
}
function text(node: XmlNode, name: string, optional = false): string {
  const hits = children(node, name);
  if (optional && !hits.length) return "";
  if (hits.length !== 1 || hits[0].children.length || !hits[0].text.trim()) throw new Error(`Missing/ambiguous 13F ${name}`);
  return hits[0].text.trim();
}
const integer = (value: string) => { if (!/^\d+$/.test(value)) throw new Error("Invalid integer amount"); return BigInt(value).toString(); };
export interface Holding {
  id: string; issuerName: string; titleOfClass: string; cusip: string; figi: string | null;
  valueAsFiled: string; valueUsd: string; quantity: string; quantityType: "SH" | "PRN"; putCall: "Put" | "Call" | null;
  investmentDiscretion: string; otherManagers: string; otherManagerIds: string[]; voting: { sole: string; shared: string; none: string };
}
export interface IncludedManager { sequenceNumber:string; name:string; cik:string|null; form13FFileNumber:string|null; stableId:string }
export interface InstitutionalNotice {
  reference:FilingReference; sourceUrl:string; sourceSha256:string; period:string; managerName:string;
  reportType:"13F NOTICE"; amendment:boolean; amendmentType:string|null; amendmentNumber:string|null;
  amendmentFlagSource:"explicit"|"original_form_omitted_flag";
  otherReportingManagers:Omit<IncludedManager,"sequenceNumber">[];
}
export interface InstitutionalFiling {
  reference: FilingReference; sourceUrl: string; sourceSha256: string; period: string; managerName: string;
  amendment: boolean; amendmentType: string | null; amendmentNumber: string | null; reportType: string;
  amendmentFlagSource:"explicit"|"original_form_omitted_flag";
  valueUnit: "USD" | "USD_thousands"; declaredEntries: number; declaredValue: string; computedEntries:number; computedValue:string; confidentialOmitted: boolean;
  otherIncludedManagers: number; includedManagers: IncludedManager[]; holdings: Holding[];
}
export interface TableReconciliationIssue {
  accession:string; sourceUrl:string; sourceSha256:string; period:string; valueUnit:"USD"|"USD_thousands";
  declaredEntries:number; computedEntries:number; entryDifference:number;
  declaredValue:string; computedValue:string; valueDifference:string;
  declaredValueUsd:string; computedValueUsd:string; informationTableDocuments:number;
}
export class TableReconciliationError extends Error {
  issue:TableReconciliationIssue;
  constructor(issue:TableReconciliationIssue){
    super(`13F table totals do not reconcile: entries declared=${issue.declaredEntries} computed=${issue.computedEntries}; value (${issue.valueUnit}) declared=${issue.declaredValue} computed=${issue.computedValue} difference=${issue.valueDifference}`);
    this.name="TableReconciliationError";this.issue=issue;
  }
}
export function managerIdentity(cik:string|null, fileNumber:string|null):string {
  if(cik && (!/^\d{10}$/.test(cik)||Number(cik)===0))throw new Error("Invalid included-manager CIK");
  if(fileNumber && !/^0?28-\d+$/.test(fileNumber))throw new Error("Invalid included-manager 13F file number");
  if(fileNumber)return `13f:28-${BigInt(fileNumber.split("-")[1])}`;
  if(cik)return `cik:${cik}`;
  throw new Error("Included manager has no stable source identifier");
}
export function resolveManagerQualifiers(raw:string, managers:IncludedManager[]):string[] {
  if(!raw)return [];
  if(!/^\d+(?:\s*,\s*\d+)*$/.test(raw))throw new Error("Invalid other-manager row qualifiers");
  const ordinals=raw.split(",").map(value=>integer(value.trim()));
  if(new Set(ordinals).size!==ordinals.length)throw new Error("Duplicate other-manager row qualifier");
  return ordinals.map(ordinal=>{const manager=managers.find(m=>m.sequenceNumber===ordinal);if(!manager)throw new Error("Unresolved other-manager row qualifier");return manager.stableId;}).sort();
}
/** Replays full EDGAR submission bytes; HTML-rendered tables are never parsed. */
function readCover(source: string, reference: FilingReference) {
  const sourceUrl = filingUrl(reference);
  if (Buffer.byteLength(source) > 48 * 1024 * 1024) throw new Error("13F submission exceeds bounded parser size");
  const accession = /^ACCESSION NUMBER:\s*(\S+)/m.exec(source)?.[1];
  const filed = /^FILED AS OF DATE:\s*(\d{8})/m.exec(source)?.[1];
  if (accession !== reference.accession || !filed || `${filed.slice(0,4)}-${filed.slice(4,6)}-${filed.slice(6)}` !== reference.filedDate) throw new Error("Submission/index accession or filing date mismatch");
  const docs = [...source.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g)].map(match => {
    const type = /<TYPE>([^\r\n<]+)/.exec(match[1])?.[1].trim();
    const xml = /<XML>\s*([\s\S]*?)\s*<\/XML>/.exec(match[1])?.[1];
    return { type, xml };
  });
  const coverDocs = docs.filter(d => d.type === reference.form);
  if (coverDocs.length !== 1 || !coverDocs[0].xml) throw new Error("Ambiguous cover document");
  const parse = (xml: string) => parseXml(xml, { maxBytes: 40 * 1024 * 1024, maxDepth: 40 });
  const root = parse(coverDocs[0].xml);
  if (local(root) !== "edgarSubmission") throw new Error("Unexpected 13F root");
  const header = one(root, "headerData"), form = one(root, "formData"), cover = one(form, "coverPage");
  if (text(header, "submissionType") !== reference.form) throw new Error("Submission form mismatch");
  const filerInfo = one(header, "filerInfo");
  const cik = text(one(one(filerInfo, "filer"), "credentials"), "cik").padStart(10, "0");
  if (cik !== reference.cik) throw new Error("Manager CIK mismatch");
  const period = date(text(cover, "reportCalendarOrQuarter"));
  if (!/-(03-31|06-30|09-30|12-31)$/.test(period) || period > reference.filedDate) throw new Error("Invalid reporting quarter");
  if (date(text(filerInfo, "periodOfReport")) !== period) throw new Error("Conflicting report periods");
  const boolean = (value: string) => { if (!["true", "false"].includes(value)) throw new Error("Invalid 13F boolean"); return value === "true"; };
  const explicitFlag=text(cover,"isAmendment",true);
  const originalForm=reference.form==="13F-HR"||reference.form==="13F-NT";
  if(!explicitFlag && (!originalForm || text(root,"schemaVersion",true)!=="X0202" || root.attrs.xmlns!=="http://www.sec.gov/edgar/thirteenffiler" || /^CONFORMED SUBMISSION TYPE:\s*(\S+)/m.exec(source)?.[1]!==reference.form || children(cover,"amendmentNo").length || children(cover,"amendmentInfo").length))throw new Error("Missing amendment flag without corroborated original form");
  const amendment = explicitFlag ? boolean(explicitFlag) : false;
  if (amendment !== reference.form.endsWith("/A")) throw new Error("Conflicting amendment flag");
  if(!amendment&&(children(cover,"amendmentNo").length||children(cover,"amendmentInfo").length))throw new Error("Original form contains amendment metadata");
  const amendmentType = amendment ? text(one(cover, "amendmentInfo"), "amendmentType") : null;
  const amendmentNumber = amendment ? integer(text(cover, "amendmentNo")) : null;
  const reportType = text(cover, "reportType");
  const amendmentFlagSource=explicitFlag?"explicit" as const:"original_form_omitted_flag" as const;
  return {sourceUrl,docs,parse,form,cover,period,amendment,amendmentType,amendmentNumber,reportType,amendmentFlagSource,boolean};
}
export function parseInstitutionalNotice(source:string,reference:FilingReference):InstitutionalNotice {
  const c=readCover(source,reference);
  if(!["13F-NT","13F-NT/A"].includes(reference.form)||c.reportType!=="13F NOTICE"||c.docs.some(d=>d.type==="INFORMATION TABLE")||children(c.form,"summaryPage").length)throw new Error("Notice form conflicts with holdings content");
  const list=one(c.cover,"otherManagersInfo");
  if(!list.children.length||list.children.some(n=>local(n)!=="otherManager"))throw new Error("Invalid notice reporting-manager list");
  const otherReportingManagers=list.children.map(manager=>{
    const rawCik=text(manager,"cik",true),cik=rawCik?rawCik.padStart(10,"0"):null,form13FFileNumber=text(manager,"form13FFileNumber",true)||null;
    return {name:text(manager,"name"),cik,form13FFileNumber,stableId:managerIdentity(cik,form13FFileNumber)};
  });
  if(new Set(otherReportingManagers.map(m=>m.stableId)).size!==otherReportingManagers.length)throw new Error("Duplicate notice reporting-manager identity");
  return {reference,sourceUrl:c.sourceUrl,sourceSha256:digest(source),period:c.period,managerName:text(one(c.cover,"filingManager"),"name"),reportType:"13F NOTICE",amendment:c.amendment,amendmentType:c.amendmentType,amendmentNumber:c.amendmentNumber,amendmentFlagSource:c.amendmentFlagSource,otherReportingManagers};
}
export function parseInstitutionalFiling(source: string, reference: FilingReference): InstitutionalFiling {
  const {sourceUrl,docs,parse,form,period,cover,amendment,amendmentType,amendmentNumber,reportType,amendmentFlagSource,boolean}=readCover(source,reference);
  if(!["13F-HR","13F-HR/A"].includes(reference.form))throw new Error("Notice is not a holdings report");
  const summary=one(form,"summaryPage");
  if (!["13F HOLDINGS REPORT", "13F COMBINATION REPORT"].includes(reportType)) throw new Error("Unsupported 13F report type");
  const valueUnit = reference.filedDate >= "2023-01-03" ? "USD" : "USD_thousands";
  const declaredEntries = Number(integer(text(summary, "tableEntryTotal")));
  if (!Number.isSafeInteger(declaredEntries) || declaredEntries > 100000) throw new Error("13F row limit exceeded");
  const declaredValue = integer(text(summary, "tableValueTotal"));
  const otherIncludedManagers = Number(integer(text(summary, "otherIncludedManagersCount")));
  if (!Number.isSafeInteger(otherIncludedManagers)) throw new Error("Invalid other-manager count");
  const lists=children(summary,"otherManagers2Info");
  if(lists.length>1 || lists.some(list=>list.children.some(n=>local(n)!=="otherManager2")))throw new Error("Ambiguous included-manager list");
  const includedManagers:IncludedManager[]=(lists[0]?children(lists[0],"otherManager2"):[]).map(node=>{
    const sequenceNumber=integer(text(node,"sequenceNumber")), manager=one(node,"otherManager");
    const rawCik=text(manager,"cik",true), cik=rawCik?rawCik.padStart(10,"0"):null;
    const form13FFileNumber=text(manager,"form13FFileNumber",true)||null;
    if(sequenceNumber==="0")throw new Error("Included-manager sequence must be positive");
    return {sequenceNumber,name:text(manager,"name"),cik,form13FFileNumber,stableId:managerIdentity(cik,form13FFileNumber)};
  });
  if(includedManagers.length!==otherIncludedManagers || new Set(includedManagers.map(m=>m.sequenceNumber)).size!==includedManagers.length || new Set(includedManagers.map(m=>m.stableId)).size!==includedManagers.length)throw new Error("Included-manager count or identity collision");
  const tableDocs = docs.filter(d => d.type === "INFORMATION TABLE");
  if (tableDocs.length !== 1 || !tableDocs[0].xml) throw new Error("Missing or multiple information tables require review");
  const table = parse(tableDocs[0].xml);
  if (local(table) !== "informationTable" || table.children.some(n => local(n) !== "infoTable")) throw new Error("Unexpected information table structure");
  const holdings = children(table, "infoTable").map((node, i): Holding => {
    const shares = one(node, "shrsOrPrnAmt"), voting = one(node, "votingAuthority");
    const cusip = text(node, "cusip"), figi = text(node, "figi", true) || null;
    if (!/^[A-Z0-9*@#]{9}$/.test(cusip) || (figi && !/^[A-Z0-9]{12}$/.test(figi))) throw new Error("Invalid source security identifier");
    const quantity = text(shares, "sshPrnamt"), quantityType = text(shares, "sshPrnamtType"), putCall = text(node, "putCall", true) || null;
    if (!/^\d+(?:\.\d{1,4})?$/.test(quantity) || !["SH", "PRN"].includes(quantityType) || (putCall && !["Put", "Call"].includes(putCall))) throw new Error("Unsupported quantity or option units");
    const valueAsFiled = integer(text(node, "value"));
    const otherManagers=text(node,"otherManager",true), investmentDiscretion=text(node,"investmentDiscretion");
    if(!["SOLE","DFND","OTR"].includes(investmentDiscretion))throw new Error("Unknown investment discretion");
    return { id: `${reference.accession}:${i + 1}`, issuerName: text(node, "nameOfIssuer"), titleOfClass: text(node, "titleOfClass"), cusip, figi,
      valueAsFiled, valueUsd: (BigInt(valueAsFiled) * BigInt(valueUnit === "USD" ? 1 : 1000)).toString(), quantity,
      quantityType: quantityType as "SH" | "PRN", putCall: putCall as Holding["putCall"], investmentDiscretion,
      otherManagers, otherManagerIds:resolveManagerQualifiers(otherManagers,includedManagers), voting: { sole: integer(text(voting, "Sole")), shared: integer(text(voting, "Shared")), none: integer(text(voting, "None")) } };
  });
  const computedEntries=holdings.length,computedValue=holdings.reduce((sum,row)=>sum+BigInt(row.valueAsFiled),BigInt(0)).toString();
  if(computedEntries!==declaredEntries||computedValue!==declaredValue){
    const multiplier=BigInt(valueUnit==="USD"?1:1000);
    throw new TableReconciliationError({accession:reference.accession,sourceUrl,sourceSha256:digest(source),period,valueUnit,
      declaredEntries,computedEntries,entryDifference:computedEntries-declaredEntries,declaredValue,computedValue,valueDifference:(BigInt(computedValue)-BigInt(declaredValue)).toString(),
      declaredValueUsd:(BigInt(declaredValue)*multiplier).toString(),computedValueUsd:(BigInt(computedValue)*multiplier).toString(),informationTableDocuments:tableDocs.length});
  }
  return { reference, sourceUrl, sourceSha256: digest(source), period, managerName: text(one(cover, "filingManager"), "name"),
    amendment, amendmentType, amendmentNumber, amendmentFlagSource, reportType, valueUnit, declaredEntries, declaredValue,computedEntries,computedValue,
    confidentialOmitted: boolean(text(summary, "isConfidentialOmitted")), otherIncludedManagers, includedManagers, holdings };
}
