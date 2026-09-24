import type { DisclosureRecord } from "./congress-schema.ts";
import { archiveRecords, disclosureFilerKey, displayFiler, validDisclosureDate } from "./home-discovery.ts";
import { resolveCompanyMark, resolvePortrait, srcOrNull } from "./image-library/index.ts";
import type { SenatePublicPayload } from "./senate/public-view.ts";
import type { InsiderPayload } from "./form4/public-view.ts";

export type HomePeriod = "ytd" | "30" | "90";
export interface HomeFiler { key: string; name: string; state: string; district: string; href?: string; /** Resolved server-side from the image library; undefined means initials. */ portrait?: string }
export interface HomeCompany {
  ticker: string; name: string; cik?: string; href?: string; /** Resolved server-side; undefined means ticker tile. */ mark?: string; buyers: number; purchases: number; sales: number;
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

/** Approved Senate rows adapted to the same homepage view without changing their source record. */
export function buildSenateHomeWindow(payload: SenatePublicPayload, period: HomePeriod, asOf: string): HomeWindow {
  const start = homePeriodStart(period, asOf);
  const eligible = payload.records.filter(row => row.transactionDate >= start && row.transactionDate <= asOf && row.filedDate <= asOf);
  const groups = new Map<string, typeof eligible>();
  for (const row of eligible) groups.set(row.ticker, [...(groups.get(row.ticker) ?? []), row]);
  const companies: HomeCompany[] = [];
  const accepted = new Set<string>();
  for (const [ticker, group] of groups) {
    if (new Set(group.map(row => row.cik)).size !== 1) continue;
    const purchases = group.filter(row => row.type === "Buy");
    if (!purchases.length) continue;
    accepted.add(ticker);
    const filers = [...new Map(purchases.map(row => {
      const key = `senate:${row.bioguide}`;
      const portrait = srcOrNull(resolvePortrait({ filerKey: key, name: row.politician, chamber: "Senate", state: row.state, district: "" }));
      const person: HomeFiler = { key, name: row.politician, state: row.state, district: "Senate",
        href: `/senate/filers/${encodeURIComponent(row.bioguide)}`, ...(portrait ? { portrait } : {}) };
      return [key, person] as const;
    })).values()];
    const cik = group[0].cik;
    const mark = srcOrNull(resolveCompanyMark({ ticker, cik }));
    companies.push({ ticker, name: group[0].issuerName, cik, href: `/senate?${new URLSearchParams({ q: ticker, period })}`,
      ...(mark ? { mark } : {}), buyers: filers.length, purchases: purchases.length,
      sales: group.filter(row => row.type === "Sell").length, filers });
  }
  companies.sort((a, b) => b.buyers - a.buyers || a.ticker.localeCompare(b.ticker));
  return { start, end: asOf, companies, recent: eligible.filter(row => row.type === "Buy" && accepted.has(row.ticker)).slice(0, 3).map(row => {
    const key = `senate:${row.bioguide}`;
    const portrait = srcOrNull(resolvePortrait({ filerKey: key, name: row.politician, chamber: "Senate", state: row.state, district: "" }));
    const mark = srcOrNull(resolveCompanyMark({ ticker: row.ticker, cik: row.cik }));
    return { id: row.id, ticker: row.ticker, name: row.issuerName, cik: row.cik, ...(mark ? { mark } : {}),
      filer: { key, name: row.politician, state: row.state, district: "Senate",
        href: `/senate/filers/${encodeURIComponent(row.bioguide)}`, ...(portrait ? { portrait } : {}) },
      amount: row.amount, traded: row.transactionDate, filed: row.filedDate, source: row.sourceUrl };
  }) };
}

/** Approved Form 4 rows adapted to the homepage without blending in awards, options, gifts or holdings. */
export function buildInsiderHomeWindow(payload: InsiderPayload, period: HomePeriod, asOf: string): HomeWindow {
  const start = homePeriodStart(period, asOf);
  const eligible = payload.records.filter(row => row.transactionDate >= start && row.transactionDate <= asOf && row.filedDate <= asOf);
  const groups = new Map<string, typeof eligible>();
  for (const row of eligible) groups.set(row.ticker, [...(groups.get(row.ticker) ?? []), row]);
  const companies: HomeCompany[] = [];
  const accepted = new Set<string>();
  for (const [ticker, group] of groups) {
    if (new Set(group.map(row => row.issuerCik)).size !== 1) continue;
    const purchases = group.filter(row => row.classification === "reported_purchase");
    if (!purchases.length) continue;
    accepted.add(ticker);
    const filers = [...new Map(purchases.flatMap(row => row.reportingOwners).map(owner => {
      const key = `insider:${owner.cik}`;
      const name = owner.name ?? owner.cik;
      const person: HomeFiler = { key, name, state: "", district: owner.officerTitle ?? "Corporate insider",
        href: `/insiders?${new URLSearchParams({ q: name, period })}` };
      return [key, person] as const;
    })).values()];
    const cik = group[0].issuerCik;
    const mark = srcOrNull(resolveCompanyMark({ ticker, cik }));
    companies.push({ ticker, name: group[0].issuerName ?? ticker, cik, href: `/stocks/${encodeURIComponent(ticker)}`,
      ...(mark ? { mark } : {}), buyers: filers.length, purchases: purchases.length,
      sales: group.filter(row => row.classification === "reported_sale").length, filers });
  }
  companies.sort((a, b) => b.buyers - a.buyers || a.ticker.localeCompare(b.ticker));
  return { start, end: asOf, companies, recent: eligible
    .filter(row => row.classification === "reported_purchase" && accepted.has(row.ticker))
    .slice(0, 3).map(row => {
      const owner = row.reportingOwners[0];
      const key = `insider:${owner.cik}`;
      const name = owner.name ?? owner.cik;
      const mark = srcOrNull(resolveCompanyMark({ ticker: row.ticker, cik: row.issuerCik }));
      return { id: row.id, ticker: row.ticker, name: row.issuerName ?? row.ticker, cik: row.issuerCik, ...(mark ? { mark } : {}),
        filer: { key, name, state: "", district: owner.officerTitle ?? "Corporate insider",
          href: `/insiders?${new URLSearchParams({ q: name, period })}` },
        amount: `${row.reportedShares} shares`, traded: row.transactionDate, filed: row.filedDate, source: row.sourceUrl };
    }) };
}

export function mergeHomeWindows(left: HomeWindow, right: HomeWindow): HomeWindow {
  const groups = new Map<string, HomeCompany[]>();
  for (const company of [...left.companies, ...right.companies]) groups.set(company.ticker, [...(groups.get(company.ticker) ?? []), company]);
  const companies: HomeCompany[] = [];
  for (const [ticker, entries] of groups) {
    const ciks = new Set(entries.map(entry => entry.cik).filter(Boolean));
    if (ciks.size > 1) continue;
    const filers = [...new Map(entries.flatMap(entry => entry.filers).map(person => [person.key, person])).values()];
    companies.push({ ticker, name: entries[0].name, cik: entries[0].cik, mark: entries.find(entry => entry.mark)?.mark,
      buyers: filers.length, purchases: entries.reduce((sum, entry) => sum + entry.purchases, 0),
      sales: entries.reduce((sum, entry) => sum + entry.sales, 0), filers });
  }
  companies.sort((a, b) => b.buyers - a.buyers || a.ticker.localeCompare(b.ticker));
  return { start: left.start < right.start ? left.start : right.start, end: left.end > right.end ? left.end : right.end, companies,
    recent: [...left.recent, ...right.recent].sort((a, b) => b.filed.localeCompare(a.filed) || b.traded.localeCompare(a.traded)).slice(0, 3) };
}
