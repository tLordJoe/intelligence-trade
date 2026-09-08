import type { DisclosureRecord } from "./congress-schema.ts";
import { archiveRecords, disclosureFilerKey, displayFiler, validDisclosureDate } from "./home-discovery.ts";

export type ActivityPeriod = "year" | "month";
export interface ActivityStock {
  ticker: string;
  name: string;
  buyers: number;
  sellers: number;
  purchases: number;
  sales: number;
  evidence: { id: string; filer: string; direction: "Buy" | "Sell"; traded: string; filed: string; source: string }[];
}
export interface ActivityWindow { start: string; end: string; stocks: ActivityStock[] }
export interface LayerActivity {
  updatedAt: string;
  byLayer: Record<string, Record<ActivityPeriod, ActivityWindow>>;
}

/** Read-only projection of reported stock transactions; no prices or inferred ETF holdings. */
export function buildLayerActivity(
  records: DisclosureRecord[],
  layers: { slug: string; stocks: { ticker: string; name: string }[] }[],
  updatedAt: string,
  asOf: string,
): LayerActivity {
  const archive = archiveRecords(records, asOf);
  const eligible = archive.filter(r => validDisclosureDate(r.transactionDate) &&
    r.transactionDate <= r.filedDate && !r.isOptions &&
    (r.tickerResolution === "verified" || r.tickerResolution === "aliased") &&
    (r.type === "Buy" || r.type === "Sell"));
  const byLayer: LayerActivity["byLayer"] = {};
  const starts: Record<ActivityPeriod, string> = {
    year: `${asOf.slice(0, 4)}-01-01`,
    month: new Date(Date.parse(asOf) - 29 * 86_400_000).toISOString().slice(0, 10),
  };
  for (const layer of layers) {
    const windows = {} as Record<ActivityPeriod, ActivityWindow>;
    for (const period of ["year", "month"] as const) {
      const stocks: ActivityStock[] = [];
      for (const stock of new Map(layer.stocks.map(s => [s.ticker, s])).values()) {
        const all = eligible.filter(r => r.ticker === stock.ticker);
        // A reused symbol cannot join unrelated issuers, even across periods.
        if (new Set(all.map(r => r.cik).filter(Boolean)).size > 1) continue;
        const rows = all.filter(r => r.transactionDate >= starts[period] && r.transactionDate <= asOf);
        if (!rows.length) continue;
        const buys = rows.filter(r => r.type === "Buy");
        const sells = rows.filter(r => r.type === "Sell");
        stocks.push({ ...stock, buyers: new Set(buys.map(disclosureFilerKey)).size,
          sellers: new Set(sells.map(disclosureFilerKey)).size,
          purchases: buys.length, sales: sells.length,
          evidence: rows.map(r => ({ id: r.id, filer: displayFiler(r.politician),
            direction: r.type as "Buy" | "Sell", traded: r.transactionDate, filed: r.filedDate, source: r.source })),
        });
      }
      stocks.sort((a, b) => b.buyers - a.buyers || b.purchases - a.purchases || a.ticker.localeCompare(b.ticker));
      windows[period] = { start: starts[period], end: asOf, stocks };
    }
    byLayer[layer.slug] = windows;
  }
  return { updatedAt, byLayer };
}
