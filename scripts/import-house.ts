#!/usr/bin/env node --experimental-strip-types
/**
 * House STOCK Act disclosure importer.
 *
 * Replaces scripts/scrape-congress.mjs, which produced incorrect data for eight
 * consecutive days while reporting success. Three defects in that script are
 * fixed here at the source:
 *
 *   1. It overwrote the archive with a rolling window of recent filings, so
 *      anything older silently disappeared. Merging is now append-only.
 *   2. Its ticker pattern was /([A-Z]{1,5})/, which cannot match share classes
 *      such as BRK.B. Symbols are now matched with punctuation and resolved
 *      against the SEC security master.
 *   3. It truncated issuer names at 60 characters and derived record ids from a
 *      running count of accepted rows, so a skipped row shifted every id after
 *      it. Names are kept whole and ids come from the filing itself.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-house.ts [--limit N] [--dry-run]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";

import {
  SCHEMA_VERSION,
  emptyCounts,
  type DisclosureArchive,
  type DisclosureRecord,
  type QuarantineEntry,
  type QuarantineFile,
  type TransactionType,
} from "../src/lib/congress-schema.ts";
import { assignRowIds, docIdFromRecordId } from "../src/lib/congress-identity.ts";
import { assessRecord, assessRun } from "../src/lib/congress-gates.ts";
import { mergeRecords, tallyCounts } from "../src/lib/congress-merge.ts";
import { renderImportReport, tallyWarnings } from "../src/lib/import-report.ts";
import {
  buildSecurityMaster,
  type SecurityMaster,
} from "../src/lib/security-master.ts";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ARCHIVE_PATH = join(ROOT, "src", "lib", "congress-live.json");
const QUARANTINE_PATH = join(ROOT, "data", "congress-quarantine.json");
const MASTER_PATH = join(ROOT, "data", "security-master.json");
const REPORT_PATH = join(ROOT, "data", "last-import-report.txt");
const PDF_CACHE = join(__dirname, ".cache", "ptr-pdfs");

const YEAR = new Date().getFullYear();
const XML_URL = `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${YEAR}FD.xml`;
const PDF_BASE = `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${YEAR}/`;
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const USER_AGENT = "Outfox Markets research (contact: hello@outfoxmarkets.com)";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
/** Explicit reviewed override for a completeness drop. Recorded in the report. */
const ALLOW_DROP = argv.includes("--allow-completeness-drop");
const LIMIT = argv.includes("--limit")
  ? Number.parseInt(argv[argv.indexOf("--limit") + 1] ?? "150", 10)
  : 150;

/**
 * Party lookup for House filers.
 *
 * Deliberately a lookup rather than an inference: an unresolved name yields
 * null, which the gates surface as a warning. Guessing party from any signal
 * would be worse than admitting we do not know.
 */
const PARTY_BY_NAME: Record<string, "D" | "R"> = JSON.parse(
  readFileSync(join(ROOT, "data", "house-party-map.json"), "utf8")
);

interface FilingMeta {
  name: string;
  stateDst: string;
  filedDateText: string;
  docId: string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Load the SEC security master, refreshing the cached copy when missing. */
async function loadSecurityMaster(): Promise<SecurityMaster> {
  if (existsSync(MASTER_PATH)) {
    const cached = JSON.parse(readFileSync(MASTER_PATH, "utf8"));
    if (cached?.entries && Object.keys(cached.entries).length > 1000) return cached;
  }
  console.error("Fetching SEC security master...");
  const payload = JSON.parse(await fetchText(SEC_TICKERS_URL));
  const master = buildSecurityMaster(payload, new Date().toISOString());
  mkdirSync(dirname(MASTER_PATH), { recursive: true });
  writeFileSync(MASTER_PATH, JSON.stringify(master));
  console.error(`  ${Object.keys(master.entries).length} symbols cached`);
  return master;
}

/** Parse the annual index, keeping only periodic transaction reports. */
function parseFilingIndex(xml: string): FilingMeta[] {
  const filings: FilingMeta[] = [];
  for (const block of xml.split("<Member>").slice(1)) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return m ? m[1].trim() : "";
    };
    if (get("FilingType") !== "P") continue;
    const docId = get("DocID");
    if (!docId) continue;
    filings.push({
      name: `${get("First")} ${get("Last")}`.replace(/\s+/g, " ").trim(),
      stateDst: get("StateDst"),
      filedDateText: get("FilingDate"),
      docId,
    });
  }
  filings.sort(
    (a, b) =>
      new Date(b.filedDateText).getTime() - new Date(a.filedDateText).getTime()
  );
  return filings;
}

function toIso(mdY: string): string {
  const m = String(mdY ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/**
 * Isolate the issuer name from the text preceding a symbol.
 *
 * Two failure modes to avoid. The old importer cut names at 60 characters,
 * losing the tail. Removing that cap exposed the opposite problem: the capture
 * runs back through preceding rows, producing 400-character strings carrying
 * another transaction's dates and amounts.
 *
 * The name is therefore bounded by structure rather than by length — everything
 * up to the last record-boundary marker (an asset-type tag, a date, an amount,
 * or a footer label) belongs to an earlier row and is discarded.
 */
const RECORD_BOUNDARY =
  /\[[A-Z]{2}\]|\d{2}\/\d{2}\/\d{4}|\$[\d,]+\s*-\s*\$[\d,]+|F\s*S\s*:|S\s*O\s*:|D\s*:/g;

function cleanIssuerName(value: string): string {
  let text = value.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ");

  // Keep only what follows the final boundary marker.
  let lastEnd = 0;
  RECORD_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RECORD_BOUNDARY.exec(text)) !== null) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd > 0) text = text.slice(lastEnd);

  return text
    .replace(/^.*(?:Cap\.?\s*Gains\s*>\s*\$200\?|Filing ID #\d+|Amount\b)\s*/i, "")
    .replace(/^.*(?:transaction|notification)\s*date\s*/i, "")
    .replace(/^\d+\s+/, "")
    .replace(/^(?:SP|JT|DC)\s+/, "")
    .replace(/^[\s\-–—,.]+/, "")
    .trim();
}

interface ParsedRow {
  rowIndex: number;
  tickerText: string;
  issuerName: string;
  typeText: string;
  type: TransactionType;
  amountText: string;
  amountLow: number;
  amountHigh: number;
  transactionDateText: string;
  ownerText: string;
  isOptions: boolean;
}

/**
 * Extract transaction rows from one filing's text.
 *
 * `rowIndex` counts every symbol-bearing block, including ones that yield no
 * usable transaction, so an id stays attached to the same row even if parsing
 * rules change later.
 */
function parseFilingRows(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const clean = text.replace(/\s+/g, " ");
  const blocks = clean.split(/\b(?:SP|JT|DC)\s+(?=[A-Z])/);
  // Widened from [A-Z]{1,5} so share classes such as BRK.B are matched.
  const tickerRe = /\(([A-Z][A-Z0-9.\-]{0,6})\)\s*\[(ST|OP|CS|ET)\]/;

  let symbolBlockOrdinal = -1;

  for (const block of blocks) {
    const m = block.match(tickerRe);
    if (!m || m.index === undefined) continue;

    symbolBlockOrdinal += 1;

    const tickerText = m[1];
    const assetType = m[2];
    const after = block.slice(m.index + m[0].length, m.index + m[0].length + 30);

    let type: TransactionType | null = null;
    if (/^\s*P\b/.test(after)) type = "Buy";
    else if (/^\s*S\s*\(partial\)/.test(after) || /^\s*S\b/.test(after)) type = "Sell";
    else if (/^\s*E\b/.test(after)) type = "Exchange";
    if (!type) continue;

    const amountM = block.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/);
    const amountText = amountM ? `$${amountM[1]} - $${amountM[2]}` : "";
    const amountLow = amountM ? Number(amountM[1].replace(/,/g, "")) : 0;
    const amountHigh = amountM ? Number(amountM[2].replace(/,/g, "")) : 0;

    const dateM = block.slice(m.index).match(/(\d{2}\/\d{2}\/\d{4})/);
    const transactionDateText = dateM ? dateM[1] : "";

    // Issuer name is everything preceding the symbol, kept whole.
    const nameM = block.match(
      new RegExp(`^(.*?)\\(${tickerText.replace(/[.\-]/g, "\\$&")}\\)`)
    );
    const issuerName = nameM ? cleanIssuerName(nameM[1]) : "";

    const ownerM = clean.slice(0, 4).match(/^(SP|JT|DC)/);

    rows.push({
      rowIndex: symbolBlockOrdinal,
      tickerText,
      issuerName,
      typeText: after.trim().slice(0, 12),
      type,
      amountText,
      amountLow,
      amountHigh,
      transactionDateText,
      ownerText: ownerM ? ownerM[1] : "",
      isOptions: assetType === "OP",
    });
  }

  return rows;
}

function readArchive(): DisclosureArchive | null {
  if (!existsSync(ARCHIVE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(ARCHIVE_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const runId = `run_${new Date().toISOString().replace(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const counts = emptyCounts();

  mkdirSync(PDF_CACHE, { recursive: true });
  mkdirSync(join(ROOT, "data"), { recursive: true });

  const master = await loadSecurityMaster();

  console.error(`Fetching ${XML_URL} ...`);
  const filings = parseFilingIndex(await fetchText(XML_URL));
  counts.sourceFilings = filings.length;

  const selected = filings.slice(0, LIMIT);
  counts.selectedFilings = selected.length;
  console.error(
    `  ${filings.length} PTR filings in index; processing ${selected.length}`
  );

  // Documents that produced rows in the archive we are extending. A filing that
  // yielded rows before and yields none now is a parser regression.
  const existingArchiveForDocs = readArchive();
  const previouslyProductiveDocIds = new Set(
    (existingArchiveForDocs?.trades ?? []).map((r) => docIdFromRecordId(r.id))
  );
  const zeroRowDocIds: string[] = [];

  const parsed: DisclosureRecord[] = [];
  const quarantined: DisclosureRecord[] = [];

  for (const filing of selected) {
    const cachePath = join(PDF_CACHE, `${filing.docId}.pdf`);
    let buf: Buffer;
    try {
      if (existsSync(cachePath)) {
        buf = readFileSync(cachePath);
      } else {
        buf = await fetchBuffer(`${PDF_BASE}${filing.docId}.pdf`);
        writeFileSync(cachePath, buf);
      }
    } catch (e) {
      console.error(`  SKIP ${filing.docId}: download failed — ${(e as Error).message}`);
      continue;
    }
    counts.downloadedFilings += 1;

    let text: string;
    try {
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      ({ text } = await parser.getText());
      await parser.destroy();
    } catch (e) {
      counts.failedParses += 1;
      console.error(`  SKIP ${filing.docId}: parse failed — ${(e as Error).message}`);
      continue;
    }

    counts.parsedFilings += 1;
    const filingUrl = `${PDF_BASE}${filing.docId}.pdf`;
    const rows = parseFilingRows(text);
    counts.parsedRecords += rows.length;
    if (rows.length === 0) {
      counts.zeroRowFilings += 1;
      zeroRowDocIds.push(filing.docId);
    }

    // Content-addressed ids, assigned per filing so an occurrence counter can
    // distinguish genuinely duplicated transactions.
    const identities = assignRowIds(
      filing.docId,
      rows.map((r) => ({
        issuerName: r.issuerName,
        tickerText: r.tickerText,
        typeText: r.typeText,
        amountText: r.amountText,
        transactionDateText: r.transactionDateText,
        ownerText: r.ownerText,
      }))
    );

    for (const [rowPosition, row] of rows.entries()) {
      const identity = identities[rowPosition];
      const now = new Date().toISOString();
      const record: DisclosureRecord = {
        id: identity.id,
        idStrategy: "content-row",
        politician: filing.name,
        party: PARTY_BY_NAME[filing.name] ?? null,
        chamber: "House",
        state: filing.stateDst.replace(/\d+$/, ""),
        district: filing.stateDst,
        ticker: row.tickerText,
        companyName: row.issuerName || row.tickerText,
        type: row.type,
        amount: row.amountText,
        amountLow: row.amountLow,
        amountHigh: row.amountHigh,
        transactionDate: toIso(row.transactionDateText),
        filedDate: toIso(filing.filedDateText),
        isOptions: row.isOptions,
        source: filingUrl,
        raw: {
          issuerName: row.issuerName,
          tickerText: row.tickerText,
          amountText: row.amountText,
          typeText: row.typeText,
          ownerText: row.ownerText,
          transactionDateText: row.transactionDateText,
          filedDateText: filing.filedDateText,
        },
        provenance: {
          sourceChamber: "House",
          filingUrl,
          docId: filing.docId,
          rowIndex: row.rowIndex,
          contentHash: identity.contentHash,
          occurrence: identity.occurrence,
          firstSeen: now,
          lastSeen: now,
          importRunId: runId,
          schemaVersion: SCHEMA_VERSION,
        },
        status: "valid",
        warnings: [],
        tickerResolution: "unknown",
      };

      const assessment = assessRecord(record, master);
      record.status = assessment.status;
      record.warnings = assessment.warnings;

      if (assessment.status === "quarantined") {
        quarantined.push(record);
      } else {
        parsed.push(record);
      }
    }
  }

  counts.accepted = parsed.length;
  counts.warned = parsed.filter((r) => r.status === "warning").length;
  counts.quarantined = quarantined.length;

  // --- merge -------------------------------------------------------------
  const existingArchive = readArchive();
  const existingRecords = (existingArchive?.trades ?? []) as DisclosureRecord[];
  counts.archiveBefore = existingRecords.length;

  const merged = mergeRecords(
    existingRecords,
    parsed,
    new Date().toISOString(),
    runId
  );
  counts.added = merged.added;
  counts.refreshed = merged.refreshed;
  counts.revised = merged.revised;
  counts.duplicates = merged.duplicates;
  counts.archiveAfter = merged.records.length;

  const finalCounts = tallyCounts(merged.records, counts);

  // --- run gates ---------------------------------------------------------
  const gates = assessRun({
    counts: finalCounts,
    previousAccepted: existingArchive?.counts?.accepted,
    previouslyProductiveDocIds,
    zeroRowDocIds,
    allowCompletenessDrop: ALLOW_DROP,
  });

  const productionUpdated = gates.passed && !DRY_RUN;

  if (productionUpdated) {
    const archive: DisclosureArchive = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      source: "Clerk of the U.S. House of Representatives — STOCK Act PTR filings",
      coverage: "U.S. House of Representatives",
      limitations:
        "House-only coverage; filings can be delayed, amended, or corrected by the filer.",
      counts: finalCounts,
      lastImportRunId: runId,
      trades: merged.records,
    };
    writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`);

    // Quarantine is a review queue, not a bin: entries accumulate across runs
    // so a recurring problem reads as recurring.
    const now = new Date().toISOString();
    let priorEntries: QuarantineEntry[] = [];
    if (existsSync(QUARANTINE_PATH)) {
      try {
        const prior = JSON.parse(readFileSync(QUARANTINE_PATH, "utf8"));
        priorEntries = Array.isArray(prior?.entries) ? prior.entries : [];
      } catch {
        priorEntries = [];
      }
    }

    const byId = new Map(priorEntries.map((e) => [e.record.id, e]));
    for (const record of quarantined) {
      const prior = byId.get(record.id);
      if (prior) {
        byId.set(record.id, {
          ...prior,
          record,
          lastSeen: now,
          runIds: [...prior.runIds, runId],
        });
      } else {
        byId.set(record.id, {
          record,
          firstSeen: now,
          lastSeen: now,
          runIds: [runId],
          resolution: "open",
        });
      }
    }

    const quarantineFile: QuarantineFile = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: now,
      entries: [...byId.values()],
    };
    writeFileSync(QUARANTINE_PATH, `${JSON.stringify(quarantineFile, null, 2)}\n`);
  }

  const report = renderImportReport({
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    sourceUrl: XML_URL,
    counts: finalCounts,
    gates,
    productionUpdated,
    warningTally: tallyWarnings(merged.records),
    quarantineSamples: quarantined.map((q) => ({
      id: q.id,
      ticker: q.ticker,
      reasons: q.warnings,
    })),
  });

  console.log(report);
  writeFileSync(REPORT_PATH, `${report}\n`);

  if (!gates.passed) {
    console.error(
      "\nGates failed — the previous known-good archive was left in place."
    );
    process.exit(1);
  }
  if (DRY_RUN) console.error("\nDry run — nothing was written.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
