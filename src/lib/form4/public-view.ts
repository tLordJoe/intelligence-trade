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
  { schemaVersion: 2; coverageFrom: string; coverageBasis: "filing_date_window" } |
  { schemaVersion: 3; coverageFrom: string; coverageBasis: "collected_filings";
    collectionScopes: { from: string; to: string; universeSha256: string; universeSize: number; expectedFilings: number; collectedFilings: number }[] }
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
/** Publish verified collected rows now. Gaps and changing collection scopes are
 * explicit metadata, not reasons to suppress otherwise valid disclosures. */
export function prepareCollectedInsiderRelease(reviews: ReturnType<typeof loadInsiderCandidateReview>[]): InsiderRelease {
  if (!reviews.length) throw new Error("No reviewed collections");
  const held = new Set(reviews.flatMap(review => review.heldIssuers));
  const versions = new Map<string, { hash: string; cik: string }>();
  for (const review of reviews) for (const row of review.records) {
    const previous = versions.get(row.accessionNumber);
    if (previous && previous.hash !== row.sourceDocumentSha256) { held.add(row.issuerCik); held.add(previous.cik); }
    versions.set(row.accessionNumber, {hash: row.sourceDocumentSha256, cik: row.issuerCik});
  }
  const heldIssuers = [...held].sort();
  const scopes = new Map<string, Extract<InsiderPayload, {schemaVersion: 3}>["collectionScopes"][number]>();
  for (const review of reviews) for (const window of review.coverage) {
    if (!window.universeSha256) continue;
    const scope = { from: window.from, to: window.to, universeSha256: window.universeSha256, universeSize: window.universeSize,
      expectedFilings: window.expectedFilings, collectedFilings: window.expectedFilings - window.missingAccessions.length };
    const key = `${scope.from}:${scope.to}:${scope.universeSha256}`;
    const previous = scopes.get(key);
    if (!previous || scope.collectedFilings > previous.collectedFilings) scopes.set(key, scope);
  }
  const collectionScopes = [...scopes.values()].sort((a,b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.universeSha256.localeCompare(b.universeSha256));
  if (!collectionScopes.length) throw new Error("No source-linked collection scopes");
  const records = new Map<string, InsiderActivity>();
  for (const review of reviews) for (const row of review.records) {
    if (heldIssuers.includes(row.issuerCik) || !review.universeCiks.includes(row.issuerCik)) continue;
    const previous = records.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error("Conflicting reviewed insider row");
    records.set(row.id, row);
  }
  const excluded: Record<string, number> = {};
  for (const review of reviews) for (const [reason,count] of Object.entries(review.excluded)) excluded[reason] = (excluded[reason] ?? 0) + count;
  return { approval: null, payload: { schemaVersion: 3, source: "sec-form4", coverageBasis: "collected_filings",
    coverageFrom: collectionScopes[0].from, coverageThrough: collectionScopes.map(scope => scope.to).sort().at(-1)!,
    universeSha256: createHash("sha256").update(JSON.stringify(collectionScopes)).digest("hex"),
    universeSize: new Set(reviews.flatMap(review => review.universeCiks)).size,
    collectionScopes, windows: collectionScopes.map(({from,to,expectedFilings}) => ({from,to,expectedFilings})),
    limitations: "Searchable, source-checked disclosures from the collected filing windows below. History is still being added: gaps between windows and uncollected filings are not evidence of no trading. Issuer directories can differ between collections. Only non-derivative purchases and sales are shown; awards, exercises, gifts, holdings and derivatives are excluded. Unresolved amendments hold the affected issuer. Prices may be weighted averages or unspecified. This is not a complete YTD or current-portfolio view, and it is not used as complete-period input to homepage rankings.",
    heldIssuers, excluded, records: [...records.values()].sort((a,b) => b.filedDate.localeCompare(a.filedDate) || a.id.localeCompare(b.id)) } };
}
function collectedCoverageReady(payload: Extract<InsiderPayload, {schemaVersion: 3}>): boolean {
  const scopes = payload.collectionScopes;
  return payload.coverageBasis === "collected_filings" && Array.isArray(scopes) && scopes.length > 0 &&
    scopes.every(s => parseDate(s.from).value === s.from && parseDate(s.to).value === s.to && s.from <= s.to &&
      /^[a-f0-9]{64}$/.test(s.universeSha256) && Number.isSafeInteger(s.universeSize) && s.universeSize > 0 &&
      Number.isSafeInteger(s.expectedFilings) && Number.isSafeInteger(s.collectedFilings) && s.collectedFilings >= 0 && s.collectedFilings <= s.expectedFilings) &&
    payload.coverageFrom === scopes.map(s => s.from).sort()[0] && payload.coverageThrough === scopes.map(s => s.to).sort().at(-1) &&
    payload.universeSha256 === createHash("sha256").update(JSON.stringify(scopes)).digest("hex") &&
    JSON.stringify(payload.windows) === JSON.stringify(scopes.map(({from,to,expectedFilings}) => ({from,to,expectedFilings})));
}
export function readApprovedInsiderRelease(value: unknown): InsiderPayload | null {
  const release = value as InsiderRelease;
  if (!release?.approval) return null;
  const { payload, approval } = release;
  if (![1,2,3].includes(payload?.schemaVersion) || payload.source !== "sec-form4" || !approval.reviewedBy?.trim() || !Number.isFinite(Date.parse(approval.reviewedAt)) ||
      approval.boundedCoverageAcknowledged !== true || insiderPayloadHash(payload) !== approval.payloadSha256 || !/^[a-f0-9]{64}$/.test(payload.universeSha256) ||
      (payload.schemaVersion === 2 && (payload.coverageBasis !== "filing_date_window" || !payload.coverageFrom)) ||
      !(payload.schemaVersion === 3 ? collectedCoverageReady(payload) : insiderRangeCoverageReady(payload.windows.map(window => ({ ...window, universeSha256: payload.universeSha256, universeSize: payload.universeSize, missingAccessions: [] })), payload.schemaVersion === 2 ? payload.coverageFrom : "2026-01-01", payload.coverageThrough))) throw new Error("Invalid insider release review or coverage");
  const ids = new Set<string>();
  for (const row of payload.records) {
    const source = new URL(row.sourceUrl);
    if (ids.has(row.id) || !row.id.startsWith(`${row.filingId}::nonDerivative::transaction::`) || row.filingId !== `${row.accessionNumber}::${row.sourceDocumentSha256}` ||
        !/^[a-f0-9]{64}$/.test(row.sourceDocumentSha256) || !/^\d{10}$/.test(row.issuerCik) || !row.ticker || !row.reportingOwners.length ||
        row.reportingOwners.some(owner => !/^\d{10}$/.test(owner.cik)) || !["reported_purchase", "reported_sale"].includes(row.classification) ||
        !/^\d+(?:\.\d+)?$/.test(row.reportedShares) || !/[1-9]/.test(row.reportedShares) || parseDate(row.transactionDate).value !== row.transactionDate || parseDate(row.filedDate).value !== row.filedDate ||
        row.transactionDate > row.filedDate || row.filedDate > payload.coverageThrough || (payload.schemaVersion !== 1 && row.filedDate < payload.coverageFrom) || payload.heldIssuers.includes(row.issuerCik) || !payload.windows.some(window => row.filedDate >= window.from && row.filedDate <= window.to) ||
        source.protocol !== "https:" || source.hostname !== "www.sec.gov" || source.username || source.password || source.port ||
        !source.pathname.includes(`/${row.accessionNumber.replaceAll("-", "")}/`) || !source.pathname.startsWith("/Archives/edgar/data/")) throw new Error("Invalid insider public record");
    ids.add(row.id);
  }
  return payload;
}
export function queryInsiders(payload: InsiderPayload, query: { q?: string; period?: string; page?: string; side?: string; window?: string }, asOf: string) {
  if (parseDate(asOf).value !== asOf) throw new Error("Invalid query date");
  const window = payload.windows.some(w => `${w.from}:${w.to}` === query.window) ? query.window! : "all";
  const period = payload.schemaVersion !== 1 ? "filings" : ["30", "90"].includes(query.period ?? "") ? query.period! : "ytd";
  const from = window !== "all" ? window.split(":")[0] : payload.schemaVersion !== 1 ? payload.coverageFrom : period === "ytd" ? `${asOf.slice(0, 4)}-01-01` : new Date(Date.parse(`${asOf}T00:00:00Z`) - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
  const to = window !== "all" ? window.split(":")[1] : payload.schemaVersion !== 1 ? payload.coverageThrough : asOf;
  const q = (query.q ?? "").trim().slice(0, 100), side = ["buy", "sell"].includes(query.side ?? "") ? query.side! : "all";
  const rows = payload.records.filter(row => (payload.schemaVersion !== 1 || window !== "all" ? row.filedDate >= from && row.filedDate <= to : row.transactionDate >= from) && row.transactionDate <= asOf && row.filedDate <= asOf &&
    (side === "all" || row.classification === (side === "buy" ? "reported_purchase" : "reported_sale")) &&
    (!q || `${row.ticker} ${row.issuerName} ${row.reportingOwners.map(owner => owner.name).join(" ")}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.filedDate.localeCompare(a.filedDate) || b.transactionDate.localeCompare(a.transactionDate) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / 25)), page = Math.min(pages, Math.max(1, /^\d+$/.test(query.page ?? "") ? Number(query.page) : 1));
  return { period, from, to, window, q, side, pages, page, total: rows.length, records: rows.slice((page - 1) * 25, page * 25) };
}
