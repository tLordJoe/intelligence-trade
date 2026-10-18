/** Radar v1: deterministic disclosure discovery, not a return forecast or trade instruction. */
import type { DisclosureRecord } from "./congress-schema.ts";
import type { SenatePublicPayload } from "./senate/public-view.ts";
import { archiveRecords, disclosureFilerKey, displayFiler, validDisclosureDate } from "./home-discovery.ts";
import { filerProfilePath } from "./filer-profile.ts";

export const RADAR_RULES = { version: "1.0", lookbackDays: 90, freshFilingDays: 30, minimumBuyers: 2,
  minimumPurchases: 3, minimumRepeatBuyers: 1, maximumHighlights: 10 } as const;
export interface RadarEvidence {
  id: string; ticker: string; cik: string; side: "Buy" | "Sell"; chamber: "House" | "Senate";
  filerKey: string; filerName: string; filerHref: string; owner: string | null;
  traded: string; filed: string; amount: string; sourceUrl: string;
}
export interface RadarItem {
  ticker: string; cik: string; name: string; buyers: number; sellers: number; purchases: number; sales: number;
  repeatBuyers: number; chambers: string[]; latestBuyFiled: string; medianFilingDelayDays: number;
  mixedActivity: boolean; evidence: RadarEvidence[];
}
export interface RadarView { asOf: string; start: string; freshFrom: string; universeSize: number; items: RadarItem[] }
type Identities = Record<string, { ticker: string; cik: string; title: string }>;
const day = 86_400_000;
const offset = (date: string, days: number) => new Date(Date.parse(date) - days * day).toISOString().slice(0, 10);

export function buildRadar(house: DisclosureRecord[], senate: SenatePublicPayload | null, identities: Identities, asOf: string): RadarView {
  if (!validDisclosureDate(asOf)) throw new Error("Invalid Radar as-of date");
  const start = offset(asOf, RADAR_RULES.lookbackDays - 1), freshFrom = offset(asOf, RADAR_RULES.freshFilingDays - 1);
  const houseRows: RadarEvidence[] = archiveRecords(house, asOf)
    .filter(row => !row.isOptions && ["verified", "aliased"].includes(row.tickerResolution) && ["Buy", "Sell"].includes(row.type))
    .map(row => ({ id: `house:${row.id}`, ticker: row.ticker, cik: row.cik ?? "", side: row.type as "Buy" | "Sell", chamber: "House",
      filerKey: disclosureFilerKey(row), filerName: displayFiler(row.politician), filerHref: filerProfilePath(disclosureFilerKey(row)),
      owner: row.raw.ownerText || null, traded: row.transactionDate, filed: row.filedDate, amount: row.amount, sourceUrl: row.source }));
  const senateRows: RadarEvidence[] = (senate?.records ?? []).map(row => ({ id: row.id, ticker: row.ticker, cik: row.cik, side: row.type,
    chamber: "Senate", filerKey: `senate:${row.bioguide}`, filerName: row.politician, filerHref: `/senate/filers/${row.bioguide}`,
    owner: row.owner, traded: row.transactionDate, filed: row.filedDate, amount: row.amount, sourceUrl: row.sourceUrl }));
  const seen = new Set<string>(), groups = new Map<string, RadarEvidence[]>();
  for (const row of [...houseRows, ...senateRows]) {
    // A narrow, published company identity universe prevents funds and symbol collisions
    // from quietly entering a list described as stocks. No fuzzy issuer-name joins.
    if (seen.has(row.id) || identities[row.ticker]?.cik !== row.cik ||
        !validDisclosureDate(row.traded) || !validDisclosureDate(row.filed) || row.traded < start || row.traded > row.filed ||
        row.filed > asOf || row.filed < start || !row.filerKey || !["Buy", "Sell"].includes(row.side)) continue;
    seen.add(row.id);
    groups.set(row.ticker, [...(groups.get(row.ticker) ?? []), row]);
  }
  const items: RadarItem[] = [];
  for (const [ticker, evidence] of groups) {
    const buys = evidence.filter(row => row.side === "Buy"), sells = evidence.filter(row => row.side === "Sell");
    const buyerDates = new Map<string, Set<string>>();
    for (const row of buys) buyerDates.set(row.filerKey, new Set([...(buyerDates.get(row.filerKey) ?? []), row.traded]));
    const repeatBuyers = [...buyerDates.values()].filter(dates => dates.size >= 2).length;
    const latestBuyFiled = buys.map(row => row.filed).sort().at(-1) ?? "";
    if (buyerDates.size < RADAR_RULES.minimumBuyers || buys.length < RADAR_RULES.minimumPurchases ||
        repeatBuyers < RADAR_RULES.minimumRepeatBuyers || latestBuyFiled < freshFrom) continue;
    const delays = buys.map(row => (Date.parse(row.filed) - Date.parse(row.traded)) / day).sort((a,b) => a-b);
    const middle = Math.floor(delays.length / 2);
    const medianFilingDelayDays = delays.length % 2 ? delays[middle] : (delays[middle-1] + delays[middle]) / 2;
    items.push({ ticker, cik: identities[ticker].cik, name: identities[ticker].title, buyers: buyerDates.size,
      sellers: new Set(sells.map(row => row.filerKey)).size, purchases: buys.length, sales: sells.length,
      repeatBuyers, chambers: [...new Set(buys.map(row => row.chamber))].sort(), latestBuyFiled, medianFilingDelayDays,
      mixedActivity: sells.length >= buys.length, evidence: evidence.sort((a,b) => b.filed.localeCompare(a.filed) || a.id.localeCompare(b.id)) });
  }
  items.sort((a,b) => b.buyers-a.buyers || b.repeatBuyers-a.repeatBuyers || b.chambers.length-a.chambers.length ||
    b.latestBuyFiled.localeCompare(a.latestBuyFiled) || a.ticker.localeCompare(b.ticker));
  return { asOf, start, freshFrom, universeSize: Object.keys(identities).length, items: items.slice(0,RADAR_RULES.maximumHighlights) };
}
