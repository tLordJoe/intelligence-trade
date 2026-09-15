import { createHash } from "node:crypto";
import type { loadSenateCandidateReview } from "./candidate-review.ts";
import { isoDate, officialSenateUrl } from "./source.ts";

export interface SenatePublicRow {
  id: string; reportId: string; politician: string; bioguide: string; state: string;
  ticker: string; issuerName: string; cik: string; assetNameAsFiled: string; assetTypeAsFiled: string;
  securityClassification: "unclassified_listed_security";
  type: "Buy" | "Sell"; owner: string; amount: string; amountLow: number; amountHigh: number;
  transactionDate: string; filedDate: string; receivedDate: string; sourceUrl: string; documentSha256: string;
  sourceComment: string | null;
  filingNotes: string[];
}
export interface SenatePublicPayload {
  schemaVersion: 1;
  source: "senate-efd";
  windows: { from: string; to: string }[];
  limitations: string;
  omitted: { paperOrUnparsedReports: number; reconciliationIssues: number; otherSourceRows: number };
  records: SenatePublicRow[];
}
export interface SenatePublicRelease {
  payload: SenatePublicPayload;
  approval: null | { reviewedBy: string; reviewedAt: string; payloadSha256: string; partialCoverageAcknowledged: true };
}
export const senatePayloadHash = (payload: SenatePublicPayload) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");
/** Owner's explicit publication prerequisite, not an automatically moving annual cutoff. */
export const SENATE_REQUIRED_COVERAGE_START = "2026-01-01";
export const SENATE_REQUIRED_COVERAGE_THROUGH = "2026-09-15";
export function senateCoverageReady(windows: SenatePublicPayload["windows"], through = SENATE_REQUIRED_COVERAGE_THROUGH): boolean {
  isoDate(through);
  let cursor = SENATE_REQUIRED_COVERAGE_START;
  const relevant = windows.filter(window => window.to >= cursor && window.from <= through).sort((a, b) => a.from.localeCompare(b.from));
  if (!relevant.length) return false;
  for (const window of relevant) {
    const from = isoDate(window.from), to = isoDate(window.to);
    if (from > to || from > cursor) return false;
    if (to >= cursor) cursor = new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }
  return cursor > through;
}

/** Public-facing subset deliberately excludes unlinked identities and held report families. */
export function prepareSenatePublicRelease(candidate: ReturnType<typeof loadSenateCandidateReview>): SenatePublicRelease {
  const meaningfulComment = (value: string) => !!value.trim() && !/^(--|n\/a|none)$/i.test(value.trim());
  const reportNotes = new Map(candidate.filings.map(filing => [filing.reference.id,
    [...new Set(filing.rows.map(row => row.raw.comment).filter(meaningfulComment))]]));
  const records: SenatePublicRow[] = candidate.disclosureRows.map((row): SenatePublicRow => {
    if (!row.bioguide || !row.state || !row.securityMatch?.cik || !row.securityMatch.title || !row.transactionDate ||
        row.amountLow === null || row.amountHigh === null || (row.direction !== "Buy" && row.direction !== "Sell")) throw new Error("Ineligible Senate display row");
    return { id: row.id, reportId: row.reportId, politician: row.filer.replace(/,\s*$/, ""), bioguide: row.bioguide, state: row.state,
      ticker: row.securityMatch.ticker, cik: row.securityMatch.cik, issuerName: row.securityMatch.title,
      assetNameAsFiled: row.assetName, assetTypeAsFiled: row.assetType, securityClassification: "unclassified_listed_security",
      type: row.direction, owner: row.owner, amount: row.raw.amountText, amountLow: row.amountLow, amountHigh: row.amountHigh,
      transactionDate: row.transactionDate, filedDate: row.filedDate, receivedDate: row.receivedDate,
      sourceUrl: row.sourceUrl, documentSha256: row.documentSha256,
      sourceComment: meaningfulComment(row.raw.comment) ? row.raw.comment : null,
      filingNotes: reportNotes.get(row.reportId) ?? [] };
  }).sort((a, b) => b.filedDate.localeCompare(a.filedDate) || a.id.localeCompare(b.id));
  const windows = [...new Map(candidate.runs.map(run => [`${run.from}:${run.to}`, { from: run.from, to: run.to }])).values()].sort((a, b) => a.from.localeCompare(b.from));
  return { approval: null, payload: { schemaVersion: 1, source: "senate-efd", windows,
    limitations: "Partial electronic Senate disclosure coverage by received-date window. Paper reports, unresolved amendments and related originals, ambiguous filer names, and unmatched assets are omitted. These are source-reported purchases and sales, not exact executions or current holdings. The source labels some funds as Stock; stock versus fund classification is not established here. No stock-only rankings or investment recommendations are inferred.",
    omitted: { paperOrUnparsedReports: candidate.unresolved.length, reconciliationIssues: candidate.blockers.length,
      otherSourceRows: candidate.rows.length - records.length }, records } };
}

/** A pending candidate or altered payload cannot appear accidentally on the public route. */
export function readApprovedSenateRelease(value: unknown): SenatePublicPayload | null {
  const release = value as SenatePublicRelease;
  if (!release?.approval) return null;
  const { payload, approval } = release;
  if (!payload || payload.schemaVersion !== 1 || payload.source !== "senate-efd" || !Array.isArray(payload.records) || !payload.records.length ||
      !approval.reviewedBy?.trim() || !Number.isFinite(Date.parse(approval.reviewedAt)) || approval.partialCoverageAcknowledged !== true ||
      senatePayloadHash(payload) !== approval.payloadSha256 || !payload.windows.length || !payload.limitations) throw new Error("Invalid Senate publication review");
  if (!senateCoverageReady(payload.windows)) throw new Error("Senate publication requires continuous received-date coverage from January 1 through September 15, 2026");
  const ids = new Set<string>();
  for (const window of payload.windows) if (isoDate(window.from) > isoDate(window.to)) throw new Error("Invalid Senate coverage window");
  for (const row of payload.records) {
    if (ids.has(row.id) || !row.id.startsWith(`senate:${row.reportId}:`) || !/^[A-Z]\d{6}$/.test(row.bioguide) || !/^\d{10}$/.test(row.cik) ||
        !/^[a-f0-9]{64}$/.test(row.documentSha256) || !row.politician || !row.ticker || !["Buy", "Sell"].includes(row.type) ||
        (row.sourceComment !== null && typeof row.sourceComment !== "string") || !Array.isArray(row.filingNotes) || row.filingNotes.some(note => typeof note !== "string") ||
        !Number.isSafeInteger(row.amountLow) || !Number.isSafeInteger(row.amountHigh) || row.amountLow < 0 || row.amountHigh < row.amountLow ||
        isoDate(row.transactionDate) > isoDate(row.filedDate) || row.securityClassification !== "unclassified_listed_security" ||
        !payload.windows.some(window => isoDate(row.receivedDate) >= window.from && row.receivedDate <= window.to) ||
        new URL(officialSenateUrl(row.sourceUrl)).pathname !== `/search/view/ptr/${row.reportId}/`) throw new Error("Invalid Senate public record");
    ids.add(row.id);
  }
  return payload;
}

/** Transaction-date filters are distinct from the source's received-date coverage. */
export function querySenateDisclosures(payload: SenatePublicPayload, query: { period?: string; q?: string; page?: string }, asOf: string) {
  isoDate(asOf);
  const period = query.period === "30" || query.period === "90" ? query.period : "ytd";
  const start = period === "ytd" ? `${asOf.slice(0, 4)}-01-01` :
    new Date(Date.parse(`${asOf}T00:00:00Z`) - (Number(period) - 1) * 86_400_000).toISOString().slice(0, 10);
  const q = (query.q ?? "").trim().slice(0, 100);
  const rows = payload.records.filter(row => row.transactionDate >= start && row.transactionDate <= asOf && row.filedDate <= asOf &&
    (!q || `${row.politician} ${row.ticker} ${row.assetNameAsFiled}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const page = Math.min(pages, Math.max(1, /^\d+$/.test(query.page ?? "") ? Number(query.page) : 1));
  return { period, q, start, end: asOf, total: rows.length, pages, page, records: rows.slice((page - 1) * 25, page * 25) };
}
