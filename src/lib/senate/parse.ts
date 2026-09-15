import { createHash } from "node:crypto";
import { htmlText, isoDate, officialSenateUrl, type SenateReportReference } from "./source.ts";

const HEADERS = ["#", "Transaction Date", "Owner", "Ticker", "Asset Name", "Asset Type", "Type", "Amount", "Comment"];
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

export function parseSenateReport(html: string, reference: SenateReportReference) {
  const sourceUrl = officialSenateUrl(reference.url);
  if (reference.format !== "electronic" || new URL(sourceUrl).pathname !== `/search/view/ptr/${reference.id}/`) {
    throw new Error("Senate source identity does not match its report URL");
  }
  const title = htmlText(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "");
  const filer = htmlText(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(html)?.[1] ?? "");
  if (!/^Periodic Transaction Report\b/i.test(title) || !filer) throw new Error("Not an electronic Senate transaction report");
  const filedText = /\bFiled\s+(\d{2}\/\d{2}\/\d{4}\s*@\s*(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*[AP]M)/i.exec(htmlText(html))?.[1];
  if (!filedText) throw new Error("Senate filing timestamp missing");
  const filedDate = isoDate(filedText.slice(0, 10));
  const total = /\((\d+)\s+transactions?\s+total\)/i.exec(htmlText(html));
  if (!total) throw new Error("Senate report lacks its declared transaction count");
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .filter(t => /List of transactions added to this report/i.test(t[1]));
  if (tables.length !== 1) throw new Error("Senate transaction table missing or ambiguous");
  const headers = [...tables[0][1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => htmlText(m[1]));
  if (JSON.stringify(headers) !== JSON.stringify(HEADERS)) throw new Error("Senate table layout changed");
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(tables[0][1])?.[1];
  if (body === undefined) throw new Error("Senate transaction body missing");
  const rawRows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  if (rawRows.length !== Number(total[1])) throw new Error("Senate transaction count does not reconcile");
  const seenNumbers = new Set<string>();
  const occurrences = new Map<string, number>();
  const rows = rawRows.map(match => {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => htmlText(m[1]));
    if (cells.length !== HEADERS.length) throw new Error("Senate row has missing or additional columns");
    const [number, date, owner, tickerText, assetName, assetType, typeText, amountText, comment] = cells;
    if (!/^\d+$/.test(number) || seenNumbers.has(number)) throw new Error("Missing or duplicate Senate source row number");
    seenNumbers.add(number);
    const issues: string[] = [];
    let transactionDate: string | null = null;
    try { transactionDate = isoDate(date); } catch { issues.push("invalid_transaction_date"); }
    if (transactionDate && transactionDate > filedDate) issues.push("transaction_after_filing");
    if (!["Self", "Spouse", "Joint", "Child", "Dependent Child"].includes(owner)) issues.push("unknown_owner");
    const direction = typeText === "Purchase" ? "Buy" : /^Sale \((Full|Partial)\)$/.test(typeText) ? "Sell" : typeText === "Exchange" ? "Exchange" : null;
    if (!direction) issues.push("unrecognized_transaction_type");
    const ticker = /^[A-Z][A-Z0-9]{0,5}(?:[.-][A-Z0-9]{1,2})?$/.test(tickerText) ? tickerText : null;
    // Keep non-public assets, funds and missing symbols in raw records; do not invent a ticker.
    const stock = assetType === "Stock";
    const bounds = /^\$([\d,]+)\s*[-–]\s*\$([\d,]+)$/.exec(amountText);
    let amountLow: number | null = bounds ? Number(bounds[1].replaceAll(",", "")) : null;
    let amountHigh: number | null = bounds ? Number(bounds[2].replaceAll(",", "")) : null;
    if (amountLow !== null && (!Number.isSafeInteger(amountLow) || !Number.isSafeInteger(amountHigh) || amountLow < 0 || amountHigh! < amountLow)) {
      amountLow = null; amountHigh = null;
    }
    if (amountLow === null) issues.push("amount_needs_review");
    if (!assetName) issues.push("missing_asset_name");
    const contentHash = hash(JSON.stringify(cells.slice(1)));
    const occurrence = (occurrences.get(contentHash) ?? 0) + 1; occurrences.set(contentHash, occurrence);
    return { id: `senate:${reference.id}:${contentHash}:${occurrence}`, sourceRowNumber: number, contentHash,
      raw: { date, owner, tickerText, assetName, assetType, typeText, amountText, comment },
      transactionDate, owner, ticker, assetName, assetType, direction, amountLow, amountHigh,
      amountStatus: amountLow === null ? "parse_failed" : "disclosed_range",
      // The Senate's "Stock" label also occurs on ETF/mutual-fund rows. Classification
      // must be verified against the security master before any stock-only aggregation.
      listedSecurityCandidate: stock && ticker !== null && direction !== null && issues.length === 0,
      issues };
  });
  const warnings: string[] = [];
  if (filedDate !== reference.receivedDate) warnings.push("document_filed_date_differs_from_index_received_date");
  // Do not match against the report's boilerplate statement about filing future amendments.
  const amendment = /amend/i.test(title) || /amend/i.test(reference.reportTitle);
  if (amendment) warnings.push("amendment_requires_reconciliation");
  const simplify = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  if (!simplify(filer).includes(simplify(reference.lastName)) || !simplify(filer).includes(simplify(reference.firstName.split(/\s+/)[0]))) {
    warnings.push("index_document_filer_mismatch");
  }
  return { schemaVersion: 1, parserVersion: "senate-electronic-ptr-v1", reference, documentSha256: hash(html),
    filer, title, filedDate, filedTimestampRaw: filedText, amendment, warnings, rows,
    publicationApproved: false as const };
}
