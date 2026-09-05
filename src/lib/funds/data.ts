/**
 * Adapter from the committed price snapshot to the domain types.
 *
 * The only place in the application that knows the snapshot's shape. Everything
 * downstream consumes `FundRecord` and `PriceSeries`, so connecting a licensed
 * provider later means writing a second adapter beside this one — not touching
 * the page, the charts, or the calculations.
 */

import snapshot from "../fund-prices.json" with { type: "json" };

import {
  unavailable,
  type Coverage,
  type ExpenseData,
  type FundIdentity,
  type FundRecord,
  type PriceSeries,
  type ReturnMethodology,
  type SourceProvenance,
} from "./types.ts";

interface SnapshotFile {
  schemaVersion: number;
  capturedAt: string;
  provenance: { sourceId: string; sourceName: string; licensed: boolean; capturedBy: string; note: string };
  methodology: {
    returnBasis: string; field: string;
    splitAdjusted: boolean; splitAdjustmentEvidence: string;
    dividendAdjusted: boolean; dividendAdjustmentEvidence: string;
    excludes: string[];
  };
  series: Record<string, { dates: string[]; closes: number[] }>;
}

const file = snapshot as unknown as SnapshotFile;

export const PROVENANCE: SourceProvenance = {
  sourceId: file.provenance.sourceId,
  sourceName: file.provenance.sourceName,
  licensed: file.provenance.licensed,
  capturedAt: file.capturedAt,
  capturedBy: file.provenance.capturedBy,
  note: file.provenance.note,
};

export const METHODOLOGY: ReturnMethodology = {
  basis: file.methodology.returnBasis === "total_return" ? "total_return" : "price_return",
  splitAdjusted: file.methodology.splitAdjusted,
  dividendAdjusted: file.methodology.dividendAdjusted,
  excludes: file.methodology.excludes,
  splitAdjustmentEvidence: file.methodology.splitAdjustmentEvidence,
  dividendAdjustmentEvidence: file.methodology.dividendAdjustmentEvidence,
};

/**
 * Fund identities.
 *
 * Descriptions state what a fund holds, in neutral terms. None of them is a
 * rating, a ranking, or a suggestion, and the order here carries no meaning.
 */
const IDENTITIES: Record<string, FundIdentity> = {
  VOO: {
    symbol: "VOO", name: "Vanguard S&P 500 ETF", issuer: "Vanguard",
    exposure: "Large United States companies across the whole market",
    category: "Broad market",
  },
  QQQ: {
    symbol: "QQQ", name: "Invesco QQQ Trust", issuer: "Invesco",
    exposure: "The largest non-financial companies listed on the Nasdaq",
    category: "Growth",
  },
  XLK: {
    symbol: "XLK", name: "Technology Select Sector SPDR Fund", issuer: "State Street",
    exposure: "Technology companies within the S&P 500",
    category: "Sector",
  },
  SMH: {
    symbol: "SMH", name: "VanEck Semiconductor ETF", issuer: "VanEck",
    exposure: "Companies that design and manufacture semiconductors",
    category: "Industry",
  },
  XLU: {
    symbol: "XLU", name: "Utilities Select Sector SPDR Fund", issuer: "State Street",
    exposure: "Electric and other utilities within the S&P 500",
    category: "Utilities",
  },
  SOXX: {
    symbol: "SOXX", name: "iShares Semiconductor ETF", issuer: "BlackRock",
    exposure: "Semiconductor companies, as a comparison to SMH",
    category: "Industry",
  },
};

function coverageOf(dates: string[]): Coverage {
  return {
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    observations: dates.length,
  };
}

function seriesFor(symbol: string): PriceSeries | null {
  const raw = file.series[symbol];
  if (!raw) return null;
  return {
    symbol,
    dates: raw.dates,
    closes: raw.closes,
    methodology: METHODOLOGY,
    provenance: PROVENANCE,
    coverage: coverageOf(raw.dates),
  };
}

/**
 * Expenses are not connected.
 *
 * Returned explicitly unavailable rather than omitted, so the interface has a
 * value to render and cannot fall back to zero.
 */
function expensesFor(symbol: string): ExpenseData {
  return {
    symbol,
    expenseRatioPercent: unavailable<number>(
      "source_not_connected",
      "No licensed source for expense ratios is connected in this preview."
    ),
  };
}

export function availableSymbols(): string[] {
  return Object.keys(file.series).filter((s) => IDENTITIES[s]);
}

export function getFund(symbol: string): FundRecord | null {
  const key = symbol.trim().toUpperCase();
  const identity = IDENTITIES[key];
  const prices = seriesFor(key);
  if (!identity || !prices) return null;

  return {
    identity,
    prices,
    expenses: expensesFor(key),
    // Holdings and overlays are modelled but unconnected. Never an empty array
    // pretending to be an empty portfolio.
    holdings: unavailable("source_not_connected", "No holdings source is connected in this preview."),
    overlays: [],
  };
}

export function getFunds(symbols: string[]): FundRecord[] {
  return symbols.map(getFund).filter((f): f is FundRecord => f !== null);
}

export function getSeries(symbols: string[]): PriceSeries[] {
  return symbols
    .map((s) => seriesFor(s.trim().toUpperCase()))
    .filter((s): s is PriceSeries => s !== null);
}

/** All identities, for the picker. Sorted by symbol; the order means nothing. */
export function allIdentities(): FundIdentity[] {
  return availableSymbols()
    .map((s) => IDENTITIES[s])
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}
