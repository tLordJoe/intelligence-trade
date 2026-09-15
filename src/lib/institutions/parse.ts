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
  investmentDiscretion: string; otherManagers: string; voting: { sole: string; shared: string; none: string };
}
export interface InstitutionalFiling {
  reference: FilingReference; sourceUrl: string; sourceSha256: string; period: string; managerName: string;
  amendment: boolean; amendmentType: string | null; amendmentNumber: string | null; reportType: string;
  valueUnit: "USD" | "USD_thousands"; declaredEntries: number; declaredValue: string; confidentialOmitted: boolean;
  otherIncludedManagers: number; holdings: Holding[];
}
/** Replays full EDGAR submission bytes; HTML-rendered tables are never parsed. */
export function parseInstitutionalFiling(source: string, reference: FilingReference): InstitutionalFiling {
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
  if (coverDocs.length !== 1 || !coverDocs[0].xml || !["13F-HR", "13F-HR/A"].includes(reference.form)) throw new Error("Unsupported notice or ambiguous cover document");
  const parse = (xml: string) => parseXml(xml, { maxBytes: 40 * 1024 * 1024, maxDepth: 40 });
  const root = parse(coverDocs[0].xml);
  if (local(root) !== "edgarSubmission") throw new Error("Unexpected 13F root");
  const header = one(root, "headerData"), form = one(root, "formData"), cover = one(form, "coverPage"), summary = one(form, "summaryPage");
  if (text(header, "submissionType") !== reference.form) throw new Error("Submission form mismatch");
  const filerInfo = one(header, "filerInfo");
  const cik = text(one(one(filerInfo, "filer"), "credentials"), "cik").padStart(10, "0");
  if (cik !== reference.cik) throw new Error("Manager CIK mismatch");
  const period = date(text(cover, "reportCalendarOrQuarter"));
  if (!/-(03-31|06-30|09-30|12-31)$/.test(period) || period > reference.filedDate) throw new Error("Invalid reporting quarter");
  if (date(text(filerInfo, "periodOfReport")) !== period) throw new Error("Conflicting report periods");
  const boolean = (value: string) => { if (!["true", "false"].includes(value)) throw new Error("Invalid 13F boolean"); return value === "true"; };
  const amendment = boolean(text(cover, "isAmendment"));
  if (amendment !== reference.form.endsWith("/A")) throw new Error("Conflicting amendment flag");
  const amendmentType = amendment ? text(one(cover, "amendmentInfo"), "amendmentType") : null;
  const amendmentNumber = amendment ? integer(text(cover, "amendmentNo")) : null;
  const reportType = text(cover, "reportType");
  if (!["13F HOLDINGS REPORT", "13F COMBINATION REPORT"].includes(reportType)) throw new Error("Unsupported 13F report type");
  const valueUnit = reference.filedDate >= "2023-01-03" ? "USD" : "USD_thousands";
  const declaredEntries = Number(integer(text(summary, "tableEntryTotal")));
  if (!Number.isSafeInteger(declaredEntries) || declaredEntries > 100000) throw new Error("13F row limit exceeded");
  const declaredValue = integer(text(summary, "tableValueTotal"));
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
    return { id: `${reference.accession}:${i + 1}`, issuerName: text(node, "nameOfIssuer"), titleOfClass: text(node, "titleOfClass"), cusip, figi,
      valueAsFiled, valueUsd: (BigInt(valueAsFiled) * BigInt(valueUnit === "USD" ? 1 : 1000)).toString(), quantity,
      quantityType: quantityType as "SH" | "PRN", putCall: putCall as Holding["putCall"], investmentDiscretion: text(node, "investmentDiscretion"),
      otherManagers: text(node, "otherManager", true), voting: { sole: integer(text(voting, "Sole")), shared: integer(text(voting, "Shared")), none: integer(text(voting, "None")) } };
  });
  if (holdings.length !== declaredEntries || holdings.reduce((sum, row) => sum + BigInt(row.valueAsFiled), BigInt(0)).toString() !== declaredValue) throw new Error("13F table totals do not reconcile");
  const otherIncludedManagers = Number(integer(text(summary, "otherIncludedManagersCount")));
  if (!Number.isSafeInteger(otherIncludedManagers)) throw new Error("Invalid other-manager count");
  return { reference, sourceUrl, sourceSha256: digest(source), period, managerName: text(one(cover, "filingManager"), "name"),
    amendment, amendmentType, amendmentNumber, reportType, valueUnit, declaredEntries, declaredValue,
    confidentialOmitted: boolean(text(summary, "isConfidentialOmitted")), otherIncludedManagers, holdings };
}
