/**
 * The demonstration provider.
 *
 * Serves the locally generated fixture in `../fixtures/demo-price-series.json`.
 * Its values are not prices. They came out of a seeded random walk, they
 * describe no fund and no market, and every one of them starts at 100 on day
 * one — which no real fund's history does.
 *
 * It is a real implementation of `FundDataProvider`, not a stub, which is the
 * point: the page is already running against the interface a licensed source
 * will implement, so connecting one is a swap rather than a rewrite.
 *
 * It supplies **price return only**. Total return needs distribution records,
 * and inventing those would be inventing income. Asked for total return it
 * answers `basis_not_supplied`, and the interface says so on screen.
 */

import demoData from "../fixtures/demo-price-series.json" with { type: "json" };

import { FUND_IDENTITIES, getLegalIdentity, type FundLegalIdentity } from "../identity.ts";
import type { FundDataProvider } from "../provider.ts";
import {
  DEMONSTRATION_LABEL, DEMONSTRATION_PROVIDER_ID, DEMONSTRATION_PROVIDER_NAME,
  DEMONSTRATION_RIGHTS, demonstrationProvenance,
} from "./demonstration-meta.ts";
import {
  available,
  unavailable,
  type Availability,
  type Coverage,
  type DisclosureOverlay,
  type ExpenseData,
  type HoldingsHistory,
  type PriceSeries,
  type ReturnBasis,
  type ReturnMethodology,
} from "../types.ts";

interface DemoFile {
  schemaVersion: number;
  label: string;
  disclaimer: string;
  generatedAt: string;
  generator: string;
  synthetic: boolean;
  method: string;
  series: Record<
    string,
    {
      symbol: string;
      dates: string[];
      values: number[];
      parameters: {
        annualDriftPercent: number;
        annualVolatilityPercent: number;
        startValue: number;
        seed: number;
      };
      gaps: Array<{ from: string; to: string; reason: string }>;
    }
  >;
}

const file = demoData as unknown as DemoFile;

const RIGHTS = DEMONSTRATION_RIGHTS;
const PROVENANCE = demonstrationProvenance(file.method);

/**
 * Split adjustment is *not applicable* here, and saying so is the honest answer.
 *
 * The walk has no shares, so it has had no splits and needs no restatement.
 * Recording `splitAdjusted: true` would imply a check was made against a filing
 * that does not exist for a fund this data does not describe.
 */
const METHODOLOGY: ReturnMethodology = {
  basis: "price_return",
  splitAdjusted: false,
  distributionAdjusted: false,
  excludes: [
    "Distributions and dividends",
    "Reinvestment",
    "Taxes",
    "Trading costs and spreads",
    "Any relationship to a real fund",
  ],
  adjustmentEvidence:
    "Not applicable. These values are generated, not observed, so there are no " +
    "share splits to restate and no distributions to add back. No adjustment " +
    "claim is made about any real fund.",
};

function coverageOf(symbol: string): Coverage {
  const raw = file.series[symbol];
  return {
    firstDate: raw.dates[0] ?? null,
    lastDate: raw.dates[raw.dates.length - 1] ?? null,
    observations: raw.dates.length,
    gaps: raw.gaps,
  };
}

function seriesFor(symbol: string): PriceSeries | null {
  const raw = file.series[symbol];
  if (!raw) return null;
  return {
    symbol,
    dates: raw.dates,
    values: raw.values,
    methodology: METHODOLOGY,
    provenance: PROVENANCE,
    coverage: coverageOf(symbol),
  };
}

export const demonstrationProvider: FundDataProvider = {
  id: DEMONSTRATION_PROVIDER_ID,
  displayName: DEMONSTRATION_PROVIDER_NAME,
  kind: "demonstration",
  rights: RIGHTS,
  provenance: PROVENANCE,
  supportedBases: ["price_return"],

  listSymbols(): string[] {
    return Object.keys(file.series)
      .filter((symbol) => FUND_IDENTITIES[symbol])
      .sort();
  },

  getLegalIdentity(symbol: string): FundLegalIdentity | null {
    return getLegalIdentity(symbol);
  },

  getPriceSeries(symbol: string, basis: ReturnBasis): Availability<PriceSeries> {
    if (basis !== "price_return") {
      return unavailable(
        "basis_not_supplied",
        "The demonstration series has no distribution records, so total return " +
          "cannot be computed from it. Inventing distributions would be inventing income."
      );
    }
    const series = seriesFor(symbol.trim().toUpperCase());
    if (!series) {
      return unavailable("source_not_connected", `${symbol} is not in the demonstration set.`);
    }
    return available(series, series.coverage.lastDate ?? file.generatedAt, DEMONSTRATION_PROVIDER_ID);
  },

  /**
   * Expenses are not supplied.
   *
   * A fund's expense ratio is a fact about a real fund. There is no honest way
   * to demonstrate it with generated data — a plausible-looking 0.09% would be
   * a fabricated fee, which is exactly what this stage is forbidden to ship.
   */
  getExpenses(symbol: string): ExpenseData {
    return {
      symbol,
      expenseRatioPercent: unavailable<number>(
        "source_not_connected",
        "No licensed source for expense ratios is connected. Expense ratios are " +
          "facts about real funds and are never generated."
      ),
    };
  },

  getHoldings(): Availability<HoldingsHistory> {
    return unavailable(
      "source_not_connected",
      "No holdings source is connected, and holdings are never generated."
    );
  },

  getOverlays(): DisclosureOverlay[] {
    return [];
  },
};

/** Re-exported so surfaces need only one import to render a labelled value. */
export { DEMONSTRATION_LABEL, DEMONSTRATION_PROVIDER_ID };
export const DEMONSTRATION_DISCLAIMER = file.disclaimer;
export const DEMONSTRATION_METHOD = file.method;
