/** Read-only audit of a frozen archive against an independently downloaded index
 * and cached original PDFs. Never imports, promotes, or rewrites source records.
 * Usage: node --experimental-strip-types scripts/audit-house-coverage.ts INDEX_XML PDF_DIRECTORY
 * JSON evidence goes to stdout. A symbol mention is a candidate, not an audited trade.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { parseFilingRows } from "../src/lib/house-parser.ts";
import { disclosureFilerKey, validDisclosureDate } from "../src/lib/home-discovery.ts";
import type { DisclosureRecord } from "../src/lib/congress-schema.ts";

const [indexPath, pdfDirectory, freshSampleDirectory] = process.argv.slice(2);
if (!indexPath || !pdfDirectory) throw new Error("Provide a downloaded House index and PDF directory.");
const root = new URL("../", import.meta.url);
const archiveBytes = readFileSync(new URL("src/lib/congress-live.json", root));
const archive = JSON.parse(archiveBytes.toString());
const records: DisclosureRecord[] = archive.trades;
const indexBytes = readFileSync(indexPath);
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const index = [...indexBytes.toString().matchAll(/<Member>([\s\S]*?)<\/Member>/g)].map(m =>
  Object.fromEntries([...m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(x => [x[1], x[2]])));
const ptrs = index.filter(r => r.FilingType === "P");
if (!ptrs.length) throw new Error("No PTR entries found; refuse an empty audit.");
const zero = JSON.parse(readFileSync(new URL("data/import-runs/run_2026-09-05T07-23-40-412Z_20eb36fb/zero-row-filings.json", root), "utf8")).filings;
const covered = new Set([...records.map(r => r.provenance.docId), ...zero.map((r: {docId:string}) => r.docId)]);
const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
const pdfs = [];
for (const filing of ptrs) {
  const path = join(pdfDirectory, `${filing.DocID}.pdf`);
  if (!existsSync(path)) continue;
  const bytes = readFileSync(path);
  const parser = new PDFParse({data: new Uint8Array(bytes)});
  let text: string, pages: number;
  try { const result = await parser.getText(); text = result.text; pages = result.total; }
  finally { await parser.destroy(); }
  const parsed = parseFilingRows(text!);
  const mentions = [...text!.matchAll(/\(([A-Z][A-Z0-9.\-]{0,6})\)\s*\[(?:ST|OP|CS|ET)\]/g)].length;
  const prior = records.filter(r => r.provenance.docId === filing.DocID);
  pdfs.push({docId:filing.DocID, filer:`${filing.First} ${filing.Last}`, pages:pages!, sha256:hash(bytes), bytes:bytes.length,
    supportedSymbolMentions:mentions, parsedRows:parsed.rows.length, skipped:parsed.skipped.length,
    symbolBlocks:parsed.symbolBlocks, unaccountedMentions:Math.max(0, mentions-parsed.rows.length-parsed.skipped.length),
    archivedRows:prior.length, parsedMinusArchived:parsed.rows.length-prior.length,
    textLength:text!.length, zeroClassification:zero.find((r: {docId:string})=>r.docId===filing.DocID)?.classification ?? null});
}
const bySeat = new Map<string, Set<string>>();
for (const r of records) { const key=`${r.chamber}:${r.district}`; if(!bySeat.has(key))bySeat.set(key,new Set()); bySeat.get(key)!.add(r.politician); }
const eligible = records.filter(r=>r.chamber==="House"&&r.type==="Buy"&&!r.isOptions&&
  validDisclosureDate(r.transactionDate)&&r.transactionDate>="2026-01-01"&&r.transactionDate<=r.filedDate&&
  (r.tickerResolution==="verified"||r.tickerResolution==="aliased"));
const symbols=[...new Set(eligible.map(r=>r.ticker))];
const ranks=symbols.map(ticker=>{const rows=eligible.filter(r=>r.ticker===ticker);return {ticker,records:rows.length,
  filers:new Set(rows.map(disclosureFilerKey)).size};}).sort((a,b)=>b.filers-a.filers||b.records-a.records||a.ticker.localeCompare(b.ticker));
const freshSamples = freshSampleDirectory ? readdirSync(freshSampleDirectory).filter(f=>/^\d+\.pdf$/.test(f)).sort().map(file=>{
  const bytes=readFileSync(join(freshSampleDirectory,file));
  const cached=join(pdfDirectory,file);
  return {docId:file.replace(/\.pdf$/,""),sha256:hash(bytes),bytes:bytes.length,
    cached:existsSync(cached),cacheMatches:existsSync(cached)?hash(readFileSync(cached))===hash(bytes):null};
}) : [];
console.log(JSON.stringify({schemaVersion:1, capturedAt:new Date().toISOString(), freshSamples,
  archiveSha256:hash(archiveBytes),indexSha256:hash(indexBytes),archiveRows:records.length,
  rawFilerNames:new Set(records.map(r=>r.politician)).size,countingIdentities:new Set(records.map(disclosureFilerKey)).size,
  types:records.reduce((s,r)=>(s[r.type]=(s[r.type]??0)+1,s),{} as Record<string,number>),
  indexedPTRs:ptrs.length,previouslyAccountedFilings:covered.size,pdfsExamined:pdfs.length,
  newIndexFilings:ptrs.filter(r=>!covered.has(r.DocID)),
  coveredMissingFromIndex:[...covered].filter(id=>!ptrs.some(r=>r.DocID===id)),
  duplicateIds:records.length-new Set(records.map(r=>r.id)).size,
  duplicateReconciliationKeys:records.length-new Set(records.map(r=>r.provenance.reconciliationKey)).size,
  sourceIdentityMismatches:records.filter(r=>!r.source.endsWith(`/${r.provenance.docId}.pdf`)).map(r=>r.id),
  multiNameSeats:[...bySeat].filter(([,names])=>names.size>1).map(([seat,names])=>({seat,names:[...names]})),
  chronologyAnomalies:records.filter(r=>r.transactionDate>r.filedDate).map(r=>({id:r.id,ticker:r.ticker,transactionDate:r.transactionDate,filedDate:r.filedDate})),
  unaccountedSymbolMentions:pdfs.reduce((n,p)=>n+p.unaccountedMentions,0),
  filingsWithUnaccountedSymbols:pdfs.filter(p=>p.unaccountedMentions>0).length,
  scannedPages:pdfs.filter(p=>p.zeroClassification==="empty_text_extraction").reduce((n,p)=>n+p.pages,0),
  provisionalArchiveRanking:ranks.slice(0,10),pdfs},null,2));
