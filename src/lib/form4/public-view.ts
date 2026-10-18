import { createHash } from "node:crypto";
import type { loadInsiderCandidateReview } from "./candidate-review.ts";
import type { InsiderActivity } from "./activity.ts";
import { parseDate } from "./validate.ts";
interface InsiderPayloadBase {
  source: "sec-form4"; coverageThrough: string;
  universeSha256: string; universeSize: number;
  windows: { from: string; to: string; expectedFilings: number }[];
  limitations: string; excluded: Record<string, number>; heldIssuers: string[];
  records: InsiderActivity[];
}
export type InsiderPayload = InsiderPayloadBase & (
  { schemaVersion: 1; coverageFrom?: never; coverageBasis?: never } |
  { schemaVersion: 2; coverageFrom: string; coverageBasis: "filing_date_window" }
);
export interface InsiderRelease { payload: InsiderPayload; approval: null | { reviewedBy: string; reviewedAt: string; payloadSha256: string; boundedCoverageAcknowledged: true } }
export const insiderPayloadHash = (payload: InsiderPayload) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");
export function insiderRangeCoverageReady(coverage: ReturnType<typeof loadInsiderCandidateReview>["coverage"], from: string, through: string): boolean {
  if (parseDate(from).value !== from || parseDate(through).value !== through || from < "2026-01-01" || from > through) return false;
  const hashes = new Set(coverage.filter(window => window.universeSha256).map(window => window.universeSha256));
  if (hashes.size !== 1) return false;
  const latest = [...new Map(coverage.filter(window => window.universeSha256).map(window => [`${window.from}:${window.to}`, window])).values()].sort((a, b) => a.from.localeCompare(b.from));
  let cursor = from;
  for (const window of latest) {
    if (window.from > through || window.to < from) continue;
    if (parseDate(window.from).value !== window.from || parseDate(window.to).value !== window.to || window.from > window.to || window.from > cursor || !Number.isSafeInteger(window.universeSize) || window.universeSize < 1000 || !Number.isSafeInteger(window.expectedFilings) || window.expectedFilings < 0 || window.missingAccessions.length) return false;
    if (window.to >= cursor) cursor = new Date(Date.parse(`${window.to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  return cursor > through;
}
export function insiderCoverageReady(coverage: ReturnType<typeof loadInsiderCandidateReview>["coverage"], through: string): boolean {
  return insiderRangeCoverageReady(coverage, "2026-01-01", through);
}
export function prepareInsiderRelease(review: ReturnType<typeof loadInsiderCandidateReview>, through: string): InsiderRelease {
  if (!insiderCoverageReady(review.coverage, through)) throw new Error("Insider release requires complete January 1–latest filing windows for one broad issuer universe");
  const coverage = [...new Map(review.coverage.filter(window => window.universeSha256).map(window => [`${window.from}:${window.to}`, window])).values()];
  return { approval: null, payload: { schemaVersion: 1, source: "sec-form4", coverageThrough: through,
    universeSha256: coverage[0].universeSha256!, universeSize: coverage[0].universeSize,
    windows: coverage.map(({ from, to, expectedFilings }) => ({ from, to, expectedFilings })),
    limitations: "Bounded to the frozen SEC-listed issuer directory and collected filing windows, not universal market coverage. Unresolved corrections hold the affected issuer. Only source-reported non-derivative purchases and sales are shown; awards, exercises, gifts, holdings and derivative activity are excluded. Filing rows can aggregate executions. Prices may be weighted averages or unspecified. No cash value, sentiment or current portfolio is inferred.",
    heldIssuers: review.heldIssuers, excluded: review.excluded, records: review.records.filter(row => row.filedDate <= through && review.universeCiks.includes(row.issuerCik)) } };
}
/** A separate dated-filings release, never a substitute for complete YTD coverage. */
export function prepareCurrentInsiderRelease(review: ReturnType<typeof loadInsiderCandidateReview>, from: string, through: string): InsiderRelease {
  const coverage = [...new Map(review.coverage.filter(window => window.universeSha256 && window.from >= from && window.to <= through)
    .map(window => [`${window.from}:${window.to}`, window])).values()];
  if (!insiderRangeCoverageReady(coverage, from, through)) throw new Error("Current insider release requires every selected filing in a continuous, fully replayed filing-date window");
  return { approval: null, payload: { schemaVersion: 2, source: "sec-form4", coverageFrom: from, coverageThrough: through, coverageBasis: "filing_date_window",
    universeSha256: coverage[0].universeSha256!, universeSize: coverage[0].universeSize,
    windows: coverage.map(({from,to,expectedFilings}) => ({from,to,expectedFilings})),
    limitations: "This view contains reviewed disclosures filed within the stated collection dates for a frozen SEC issuer directory. It is not a complete year-to-date, 30-day or 90-day trading history and is not included in those homepage rankings. Transaction dates can predate the filing window. Only source-reported non-derivative purchases and sales are shown; awards, exercises, gifts, holdings and derivative activity are excluded. Unresolved corrections hold the affected issuer. Reported prices may be weighted averages or unspecified; cash values and current portfolios are not inferred.",
    heldIssuers: review.heldIssuers, excluded: review.excluded,
    records: review.records.filter(row => row.filedDate >= from && row.filedDate <= through && review.universeCiks.includes(row.issuerCik)) } };
}
export function readApprovedInsiderRelease(value: unknown): InsiderPayload | null {
  const release = value as InsiderRelease;
  if (!release?.approval) return null;
  const { payload, approval } = release;
  if (![1,2].includes(payload?.schemaVersion) || payload.source !== "sec-form4" || !approval.reviewedBy?.trim() || !Number.isFinite(Date.parse(approval.reviewedAt)) ||
      approval.boundedCoverageAcknowledged !== true || insiderPayloadHash(payload) !== approval.payloadSha256 || !/^[a-f0-9]{64}$/.test(payload.universeSha256) ||
      (payload.schemaVersion === 2 && (payload.coverageBasis !== "filing_date_window" || !payload.coverageFrom)) ||
      !insiderRangeCoverageReady(payload.windows.map(window => ({ ...window, universeSha256: payload.universeSha256, universeSize: payload.universeSize, missingAccessions: [] })), payload.schemaVersion === 2 ? payload.coverageFrom : "2026-01-01", payload.coverageThrough)) throw new Error("Invalid insider release review or coverage");
  const ids = new Set<string>();
  for (const row of payload.records) {
    const source = new URL(row.sourceUrl);
    if (ids.has(row.id) || !row.id.startsWith(`${row.filingId}::nonDerivative::transaction::`) || row.filingId !== `${row.accessionNumber}::${row.sourceDocumentSha256}` ||
        !/^[a-f0-9]{64}$/.test(row.sourceDocumentSha256) || !/^\d{10}$/.test(row.issuerCik) || !row.ticker || !row.reportingOwners.length ||
        row.reportingOwners.some(owner => !/^\d{10}$/.test(owner.cik)) || !["reported_purchase", "reported_sale"].includes(row.classification) ||
        !/^\d+(?:\.\d+)?$/.test(row.reportedShares) || !/[1-9]/.test(row.reportedShares) || parseDate(row.transactionDate).value !== row.transactionDate || parseDate(row.filedDate).value !== row.filedDate ||
        row.transactionDate > row.filedDate || row.filedDate > payload.coverageThrough || (payload.schemaVersion === 2 && row.filedDate < payload.coverageFrom) || !payload.windows.some(window => row.filedDate >= window.from && row.filedDate <= window.to) ||
        source.protocol !== "https:" || source.hostname !== "www.sec.gov" || source.username || source.password || source.port ||
        !source.pathname.includes(`/${row.accessionNumber.replaceAll("-", "")}/`) || !source.pathname.startsWith("/Archives/edgar/data/")) throw new Error("Invalid insider public record");
    ids.add(row.id);
  }
  return payload;
}
export function queryInsiders(payload: InsiderPayload, query: { q?: string; period?: string; page?: string; side?: string }, asOf: string) {
  if (parseDate(asOf).value !== asOf) throw new Error("Invalid query date");
  const period = payload.schemaVersion === 2 ? "filings" : ["30", "90"].includes(query.period ?? "") ? query.period! : "ytd";
  const from = payload.schemaVersion === 2 ? payload.coverageFrom : period === "ytd" ? `${asOf.slice(0, 4)}-01-01` : new Date(Date.parse(`${asOf}T00:00:00Z`) - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
  const to = payload.schemaVersion === 2 ? payload.coverageThrough : asOf;
  const q = (query.q ?? "").trim().slice(0, 100), side = ["buy", "sell"].includes(query.side ?? "") ? query.side! : "all";
  const rows = payload.records.filter(row => (payload.schemaVersion === 2 ? row.filedDate >= from && row.filedDate <= to : row.transactionDate >= from) && row.transactionDate <= asOf && row.filedDate <= asOf &&
    (side === "all" || row.classification === (side === "buy" ? "reported_purchase" : "reported_sale")) &&
    (!q || `${row.ticker} ${row.issuerName} ${row.reportingOwners.map(owner => owner.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.filedDate.localeCompare(a.filedDate) || b.transactionDate.localeCompare(a.transactionDate) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / 25)), page = Math.min(pages, Math.max(1, /^\d+$/.test(query.page ?? "") ? Number(query.page) : 1));
  return { period, from, to, q, side, pages, page, total: rows.length, records: rows.slice((page - 1) * 25, page * 25) };
}
