import type { DisclosureRecord } from "./congress-schema.ts";
import { archiveRecords, disclosureFilerKey, displayFiler, validDisclosureDate } from "./home-discovery.ts";
import { resolveCompanyMark, resolvePortrait, srcOrNull } from "./image-library/index.ts";

export type HomePeriod = "ytd" | "30" | "90";
export interface HomeFiler { key: string; name: string; state: string; district: string; /** Resolved server-side from the image library; undefined means initials. */ portrait?: string }
export interface HomeCompany {
  ticker: string; name: string; cik?: string; /** Resolved server-side; undefined means ticker tile. */ mark?: string; buyers: number; purchases: number; sales: number;
  filers: HomeFiler[];
}
export interface HomePurchase {
  id: string; ticker: string; name: string; cik?: string; mark?: string; filer: HomeFiler;
  amount: string; traded: string; filed: string; source: string;
}
export interface HomeWindow {
  start: string; end: string; companies: HomeCompany[]; recent: HomePurchase[];
}
export function homePeriodStart(period: HomePeriod, asOf: string): string {
  if (!validDisclosureDate(asOf)) throw new Error("Invalid homepage as-of date");
  return period === "ytd" ? `${asOf.slice(0, 4)}-01-01` :
    new Date(Date.parse(asOf) - (Number(period) - 1) * 86_400_000).toISOString().slice(0, 10);
}
function filer(record: DisclosureRecord): HomeFiler {
  const key = disclosureFilerKey(record);
  const portrait = srcOrNull(resolvePortrait({ filerKey: key, name: record.politician, chamber: record.chamber, state: record.state, district: record.district }));
  return { key, name: displayFiler(record.politician), state: record.state, district: record.district, ...(portrait ? { portrait } : {}) };
}
/** Transaction-date windows; only filings public by asOf. Raw archive stays unchanged. */
export function buildHomeWindow(records: DisclosureRecord[], period: HomePeriod, asOf: string): HomeWindow {
  const start = homePeriodStart(period, asOf);
  const eligible = archiveRecords(records, asOf).filter(r =>
    validDisclosureDate(r.transactionDate) && r.transactionDate >= start && r.transactionDate <= r.filedDate &&
    !r.isOptions && ["verified", "aliased"].includes(r.tickerResolution) && ["Buy", "Sell"].includes(r.type));
  const groups = new Map<string, DisclosureRecord[]>();
  for (const record of eligible) groups.set(record.ticker, [...(groups.get(record.ticker) ?? []), record]);
  const companies: HomeCompany[] = [];
  const accepted = new Set<string>();
  for (const [ticker, group] of groups) {
    if (new Set(group.map(r => r.cik).filter(Boolean)).size > 1) continue;
    accepted.add(ticker);
    const purchases = group.filter(r => r.type === "Buy");
    if (!purchases.length) continue;
    const people = [...new Map(purchases.map(r => [disclosureFilerKey(r), filer(r)])).values()];
    const cik = group.find(r => r.cik)?.cik;
    const mark = srcOrNull(resolveCompanyMark({ ticker, cik: cik ?? null }));
    companies.push({ ticker, name: group[0].companyName, cik, ...(mark ? { mark } : {}), buyers: people.length,
      purchases: purchases.length, sales: group.filter(r => r.type === "Sell").length, filers: people });
  }
  companies.sort((a, b) => b.buyers - a.buyers || a.ticker.localeCompare(b.ticker));
  return { start, end: asOf, companies, recent: eligible.filter(r => r.type === "Buy" && accepted.has(r.ticker)).slice(0, 3).map(r => ({
    id: r.id, ticker: r.ticker, name: r.companyName, cik: r.cik, ...(srcOrNull(resolveCompanyMark({ ticker: r.ticker, cik: r.cik ?? null })) ? { mark: srcOrNull(resolveCompanyMark({ ticker: r.ticker, cik: r.cik ?? null })) as string } : {}), filer: filer(r),
    amount: r.amount || "Amount unavailable", traded: r.transactionDate, filed: r.filedDate, source: r.source,
  })) };
}
