import type { RadarTradeEvidence } from "./radar-engine.ts";

export const RADAR_ACTIVITY_RULES = {
  filingWindowDays: 30,
  minimumReportingUnits: 2,
  maximumHighlights: 12,
} as const;

export type RadarActivityKind = "buying" | "selling" | "mixed";
type Side = "Buy" | "Sell";
export interface RadarActivityItem {
  key: string;
  ticker: string;
  tickers: string[];
  cik: string;
  name: string;
  kind: RadarActivityKind;
  buyers: number;
  sellers: number;
  purchaseEvents: number;
  saleEvents: number;
  saleContextRows: number;
  supportingSources: RadarTradeEvidence["source"][];
  latestSupportingFiling: string;
  examples: RadarTradeEvidence[];
  rows: RadarTradeEvidence[];
}

export const activityLabels: Record<RadarActivityKind,string> = {
  buying:"Buying cluster", selling:"Selling cluster", mixed:"Buying and selling clusters",
};
const kinds = ["buying","selling","mixed"] as const;

const eventKey = (row: RadarTradeEvidence) => `${row.side}:${row.actor}:${row.traded}`;
const newestFirst = (a: RadarTradeEvidence, b: RadarTradeEvidence) =>
  b.filed.localeCompare(a.filed) || b.traded.localeCompare(a.traded) || a.id.localeCompare(b.id);

export function summarizeRadarActivity(
  identity: Pick<RadarActivityItem,"key"|"cik"|"ticker"|"tickers"|"name">,
  trades: RadarTradeEvidence[],
  filedFrom: string,
): RadarActivityItem | null {
  const rows = trades.filter(row => row.filed >= filedFrom).sort(newestFirst);
  const counted = rows.filter(row => !row.activitySaleContext);
  const actors = (side: Side) => new Set(counted.filter(row => row.side === side).map(row => row.actor));
  const events = (side: Side) => new Set(counted.filter(row => row.side === side).map(eventKey)).size;
  const cluster = (side: Side, units: Set<string>) => {
    if (units.size < RADAR_ACTIVITY_RULES.minimumReportingUnits) return false;
    const sideRows = counted.filter(row => row.side === side);
    // Multiple names on one date in one source aren't enough on their own.
    return new Set(sideRows.map(row => row.traded)).size > 1 || new Set(sideRows.map(row => row.source)).size > 1;
  };
  const buyers = actors("Buy"), sellers = actors("Sell");
  const buying = cluster("Buy", buyers), selling = cluster("Sell", sellers);
  if (!buying && !selling) return null;
  const kind = buying ? selling ? "mixed" : "buying" : "selling";
  const supports = counted.filter(row => row.side === "Buy" ? buying : selling);
  const examples: RadarTradeEvidence[] = [];
  for (const side of (kind === "mixed" ? ["Buy","Sell"] : kind === "buying" ? ["Buy"] : ["Sell"]) as Side[]) {
    const seen = new Set<string>();
    for (const row of supports.filter(row => row.side === side)) {
      if (seen.has(row.actor)) continue;
      seen.add(row.actor);
      examples.push(row);
      if (seen.size >= (kind === "mixed" ? 1 : 2)) break;
    }
  }
  return {
    ...identity, kind, buyers: buyers.size, sellers: sellers.size,
    purchaseEvents: events("Buy"), saleEvents: events("Sell"),
    saleContextRows: rows.length - counted.length,
    supportingSources: [...new Set(supports.map(row => row.source))].sort(),
    latestSupportingFiling: supports[0].filed, examples, rows,
  };
}

const supportCount = (item: RadarActivityItem) => item.kind === "buying" ? item.buyers : item.kind === "selling" ? item.sellers : item.buyers + item.sellers;
const compareRadarActivity = (a: RadarActivityItem, b: RadarActivityItem) =>
  b.supportingSources.length - a.supportingSources.length || supportCount(b) - supportCount(a) ||
  b.latestSupportingFiling.localeCompare(a.latestSupportingFiling) || a.key.localeCompare(b.key);

/** Represent both directions when the current evidence supports them. */
export function radarActivityPreview(items: RadarActivityItem[]) {
  const selected = new Set<RadarActivityItem>(items.slice(0,1));
  for (const kind of kinds) {
    if (selected.size === 3) break;
    if ([...selected].some(item => item.kind === kind)) continue;
    const match = items.find(item => item.kind === kind);
    if (match) selected.add(match);
  }
  for (const item of items) {
    if (selected.size === 3) break;
    selected.add(item);
  }
  return [...selected];
}

export function rankRadarActivity(items: RadarActivityItem[]) {
  const ranked = [...items].sort(compareRadarActivity);
  const prioritized = new Set([...radarActivityPreview(ranked), ...ranked]);
  const selected = new Set([...prioritized].slice(0, RADAR_ACTIVITY_RULES.maximumHighlights));
  return ranked.filter(item => selected.has(item));
}
