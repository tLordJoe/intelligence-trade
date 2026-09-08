/** Evidence-led homepage projections. No prices, forecasts, or inferred ownership. */
import type { DisclosureRecord } from "./congress-schema.ts";
import { isOfficialHouseFilingUrl } from "./congress-utils.ts";

const DAY = 86_400_000;
export function validDisclosureDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

export function displayFiler(name: string): string {
  return name.replace(/\b(?:Mr|Mrs|Ms|Hon)\b\.?\s*/gi, "").replace(/\s+/g, " ").trim();
}

export function filerKey(name: string): string {
  return displayFiler(name).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Narrow archive alias: both names report VA05 in the original filing metadata.
 * Do not generally strip middle names or merge by district (seats change hands).
 * Evidence: House PTRs 20035367, 20034521, and 20033956.
 * This is an Outfox counting key, not an official person identifier.
 */
export function disclosureFilerKey(record: Pick<DisclosureRecord, "politician" | "chamber" | "district" | "state">): string {
  const name = filerKey(record.politician);
  if (record.chamber === "House" && record.state === "VA" && record.district === "VA05" &&
      (name === "john j mcguire" || name === "john mcguire")) return "house:va05:john-mcguire";
  return `${record.chamber}:${record.state}:${record.district}:${name}`;
}

export function archiveRecords(records: DisclosureRecord[], asOf: string): DisclosureRecord[] {
  if (!validDisclosureDate(asOf)) throw new Error("A valid as-of date is required.");
  const ids = new Set<string>();
  const keys = new Set<string>();
  return [...records].sort((a, b) => (b.provenance?.lastSeen ?? "").localeCompare(a.provenance?.lastSeen ?? ""))
    .filter((r) => {
      if (!r.id || r.chamber !== "House" || r.status === "quarantined" ||
          !isOfficialHouseFilingUrl(r.source) || !filerKey(r.politician) ||
          !validDisclosureDate(r.filedDate) || r.filedDate > asOf) return false;
      const key = r.provenance?.reconciliationKey;
      if (ids.has(r.id) || (key && keys.has(key))) return false;
      ids.add(r.id);
      if (key) keys.add(key);
      return true;
    }).sort((a, b) => b.filedDate.localeCompare(a.filedDate) ||
      b.transactionDate.localeCompare(a.transactionDate) || a.id.localeCompare(b.id));
}

export interface PurchaseCluster {
  ticker: string;
  companyName: string;
  buyers: number;
  sellers: number;
  purchases: number;
  sales: number;
  records: DisclosureRecord[];
}

export function buildHomeDiscovery(records: DisclosureRecord[], updatedAt: string, asOf: string) {
  const archive = archiveRecords(records, asOf);
  const periodStart = new Date(Date.parse(asOf) - 29 * DAY).toISOString().slice(0, 10);
  const dated = archive.filter((r) => validDisclosureDate(r.transactionDate) && r.transactionDate <= r.filedDate);
  const eligible = dated.filter((r) => r.filedDate >= periodStart && !r.isOptions &&
    (r.tickerResolution === "verified" || r.tickerResolution === "aliased") && (r.type === "Buy" || r.type === "Sell"));
  const byTicker = new Map<string, DisclosureRecord[]>();
  for (const r of eligible) byTicker.set(r.ticker, [...(byTicker.get(r.ticker) ?? []), r]);
  const clusters: PurchaseCluster[] = [];
  for (const [ticker, group] of byTicker) {
    // A reused/ambiguous symbol must not combine different issuers.
    if (new Set(group.map((r) => r.cik).filter(Boolean)).size > 1) continue;
    const buys = group.filter((r) => r.type === "Buy");
    const sells = group.filter((r) => r.type === "Sell");
    const buyers = new Set(buys.map(disclosureFilerKey)).size;
    if (buyers < 2) continue;
    clusters.push({ ticker, companyName: group[0].companyName, buyers,
      sellers: new Set(sells.map(disclosureFilerKey)).size,
      purchases: buys.length, sales: sells.length, records: group });
  }
  clusters.sort((a, b) => b.buyers - a.buyers || a.ticker.localeCompare(b.ticker));
  const lastImport = Date.parse(updatedAt);
  return {
    archiveCount: archive.length,
    recentPurchases: dated.filter((r) => r.type === "Buy").slice(0, 5),
    clusters: clusters.slice(0, 5),
    periodStart, periodEnd: asOf, updatedAt,
    stale: !Number.isFinite(lastImport) || Date.parse(asOf) - lastImport > 14 * DAY,
  };
}

export function queryArchive(records: DisclosureRecord[], query: { q?: string; ticker?: string; page?: string }) {
  const q = (query.q ?? "").trim().toLowerCase().slice(0, 100);
  const ticker = (query.ticker ?? "").trim().toUpperCase().slice(0, 20);
  const matching = records.filter((r) => (!ticker || r.ticker === ticker) && (!q ||
    [r.ticker, r.companyName, displayFiler(r.politician)].some((value) => value.toLowerCase().includes(q))));
  const pages = Math.max(1, Math.ceil(matching.length / 25));
  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  return { records: matching.slice((page - 1) * 25, page * 25), total: matching.length, page, pages, q, ticker };
}
