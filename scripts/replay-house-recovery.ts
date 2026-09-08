/** Offline candidate replay. Reads frozen inputs; emits evidence to stdout only.
 * No network, no archive promotion. Usage: replay-house-recovery.ts PDF_DIR MASTER_JSON
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { parseFilingRows } from "../src/lib/house-parser.ts";
import { assessHouseSymbolCoverage } from "../src/lib/house-coverage.ts";
import { assignRowIds } from "../src/lib/congress-identity.ts";
import { assessRecord } from "../src/lib/congress-gates.ts";
import { mergeRecords } from "../src/lib/congress-merge.ts";
import { applyReviewedHouseCorrections } from "../src/lib/house-reviewed-corrections.ts";
import type { DisclosureArchive, DisclosureRecord } from "../src/lib/congress-schema.ts";
import type { SecurityMaster } from "../src/lib/security-master.ts";

const [pdfDirectory, masterPath] = process.argv.slice(2);
if (!pdfDirectory || !masterPath) throw new Error("Provide cached PDFs and a frozen security master.");
const root = new URL("../", import.meta.url);
const archivePath = new URL("src/lib/congress-live.json", root);
const bytes = readFileSync(archivePath);
const archive: DisclosureArchive = JSON.parse(bytes.toString());
const masterBytes = readFileSync(masterPath);
const master: SecurityMaster = JSON.parse(masterBytes.toString());
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const frozen = JSON.parse(readFileSync(new URL("docs/audits/r2-2026-09-08/coverage.json", root), "utf8"));
if (hash(bytes) !== frozen.archiveSha256) throw new Error("Archive differs from the audited baseline.");
const now = "2026-09-08T12:00:00.000Z"; // Reproducible replay timestamp, not a source availability claim.
const incoming: DisclosureRecord[] = [];
const quarantine: DisclosureRecord[] = [];
const findings = [];
for (const input of frozen.pdfs) {
  const pdf = readFileSync(join(pdfDirectory, `${input.docId}.pdf`));
  if (hash(pdf) !== input.sha256) throw new Error(`Changed source PDF: ${input.docId}`);
  const parser = new PDFParse({data: new Uint8Array(pdf)});
  let text: string;
  try { ({text} = await parser.getText()); } finally { await parser.destroy(); }
  const parsed = parseFilingRows(text!);
  const coverage = assessHouseSymbolCoverage(text!, parsed);
  const prior = archive.trades.filter(r => r.provenance.docId === input.docId);
  findings.push({docId:input.docId,sourceSha256:input.sha256,before:prior.length,after:parsed.rows.length,
    ...coverage,skipped:parsed.skipped});
  if (coverage.unaccounted || parsed.skipped.length) throw new Error(`Unresolved source rows: ${input.docId}`);
  if (!parsed.rows.length) continue;
  // This recovery concerns previously productive filings, not new collection.
  // New productive documents require separately validated filing metadata.
  if (!prior.length) throw new Error(`New productive filing needs metadata review: ${input.docId}`);
  const context = prior[0];
  const identities = assignRowIds(input.docId, parsed.rows.map(r => ({...r,amountText:r.amount.text})));
  for (const [i,row] of parsed.rows.entries()) {
    const identity = identities[i];
    const iso = row.transactionDateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const record: DisclosureRecord = {
      id:identity.id,idStrategy:"content-row",politician:context.politician,party:context.party,
      chamber:"House",state:context.state,district:context.district,ticker:row.tickerText,
      companyName:row.issuerName || row.tickerText,type:row.type,amount:row.amount.text,
      amountLow:row.amount.low,amountHigh:row.amount.high,amountStatus:row.amount.status,
      transactionDate:iso ? `${iso[3]}-${iso[1]}-${iso[2]}` : "",filedDate:context.filedDate,
      isOptions:row.isOptions,source:context.source,
      raw:{issuerName:row.issuerName,tickerText:row.tickerText,typeText:row.typeText,
        amountText:row.amount.text,transactionDateText:row.transactionDateText,
        ownerText:row.ownerText,filedDateText:context.raw.filedDateText},
      provenance:{sourceChamber:"House",filingUrl:context.source,docId:input.docId,rowIndex:row.rowIndex,
        contentHash:identity.contentHash,occurrence:identity.occurrence,reconciliationKey:identity.reconciliationKey,
        firstSeen:now,lastSeen:now,importRunId:"offline-r2a-replay",schemaVersion:2},
      status:"valid",warnings:[],tickerResolution:"unknown",
    };
    const assessment = assessRecord(record,master);
    record.status=assessment.status; record.warnings=assessment.warnings;
    record.tickerResolution=assessment.tickerResolution;
    if (assessment.resolvedTicker) record.ticker=assessment.resolvedTicker;
    if (assessment.cik) record.cik=assessment.cik;
    (record.status === "quarantined" ? quarantine : incoming).push(record);
  }
}
const corrected=applyReviewedHouseCorrections(archive.trades,incoming,
  new Map(findings.map(f=>[f.docId,f.sourceSha256])));
const merged=mergeRecords(archive.trades,corrected,now,"offline-r2a-replay");
const oldIds=new Set(archive.trades.map(r=>r.id));
const nextById=new Map(merged.records.map(r=>[r.id,r]));
const lost=archive.trades.filter(r=>!nextById.has(r.id)).map(r=>r.id);
const changed=archive.trades.flatMap(r=>{
  const next=nextById.get(r.id)!;
  const fields=["ticker","companyName","type","amount","transactionDate","status"] as const;
  const differences=fields.filter(k=>r[k]!==next[k]).map(k=>({field:k,before:r[k],after:next[k]}));
  return differences.length?[{id:r.id,changes:differences}]:[];
});
const rawMutations=archive.trades.filter(r=>JSON.stringify(r.raw)!==JSON.stringify(nextById.get(r.id)?.raw)).map(r=>r.id);
if (lost.length || rawMutations.length || hash(readFileSync(archivePath))!==hash(bytes)) throw new Error("Baseline preservation failed.");
const repeat=mergeRecords(merged.records,corrected,now,"offline-r2a-replay");
if (repeat.added || repeat.revised || repeat.records.length!==merged.records.length) throw new Error("Replay is not idempotent.");
if (merged.unseenIds.length || merged.duplicates) throw new Error("Unresolved identity reconciliation.");
console.log(JSON.stringify({schemaVersion:1,kind:"offline-candidate-not-for-publication",archiveSha256:hash(bytes),
  masterSha256:hash(masterBytes),masterUpdatedAt:master.updatedAt,
  summary:{before:archive.trades.length,parsed:findings.reduce((n,f)=>n+f.after,0),accepted:incoming.length,
    quarantined:quarantine.length,after:merged.records.length,added:merged.added,refreshed:merged.refreshed,
    revised:merged.revised,duplicates:merged.duplicates,lost,rawMutations,unseen:merged.unseenIds,
    repeatAdded:repeat.added,repeatRevised:repeat.revised},
  changed,findings,quarantine,addedIds:merged.records.filter(r=>!oldIds.has(r.id)).map(r=>r.id),
  candidate:{...archive,trades:merged.records}},null,2));
