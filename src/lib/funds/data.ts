/**
 * The composition root for the fund comparison.
 *
 * The one place that names a concrete provider. Everything else — the page, the
 * chart, the arithmetic, the tests — goes through `FundDataProvider`, so
 * connecting a licensed source is a change to the constant below and nothing
 * more.
 *
 * Two independent gates stand between a dataset and a reader — rights, and
 * environment. Both live in `./access.ts`, which is importable without this
 * module's data, and are re-exported at the foot of this file.
 */

// This module reaches the fixture and must never be imported by a client
// component. That is enforced twice, neither of them here: a source assertion
// in `tests/fund-ui-contract.test.ts` that no client component imports it, and
// `scripts/verify-compare-assets.ts`, which scans the emitted browser assets in
// CI. Next's `server-only` marker was considered and dropped — its npm package
// throws on import under plain Node, which is what the offline test suite runs
// on, so it would have traded a build-time guard for a broken test run.

import { buildColorAssignment, type ColorAssignment } from "./colors.ts";
import type { ComparisonDataset } from "./dataset.ts";
import { getLegalIdentity } from "./identity.ts";
import { demonstrationProvider } from "./providers/demonstration.ts";
import { getDisplayableSeries, type FundDataProvider } from "./provider.ts";
import {
  isAvailable,
  toFundIdentity,
  type Availability,
  type FundIdentity,
  type FundRecord,
  type PriceSeries,
  type ReturnBasis,
  type SourceProvenance,
} from "./types.ts";

/**
 * The provider in use.
 *
 * Swap this line — and nothing else — to connect a licensed source. The
 * interface is what the rest of the application is written against.
 */
export const activeProvider: FundDataProvider = demonstrationProvider;

/** The basis this preview measures. Total return needs distribution records. */
export const ACTIVE_BASIS: ReturnBasis = "price_return";

export const PROVENANCE: SourceProvenance = activeProvider.provenance;

export function availableSymbols(): string[] {
  return activeProvider.listSymbols();
}

/**
 * Colours, assigned once from the provider's whole universe.
 *
 * Built here rather than in the component so that the same assignment is used
 * by the chart, the table, the legend and the tests, and so that nothing can
 * accidentally rebuild it from a filtered or sorted list.
 */
export const COLORS: ColorAssignment = buildColorAssignment(availableSymbols());

export function identityFor(symbol: string): FundIdentity | null {
  const legal = getLegalIdentity(symbol);
  return legal ? toFundIdentity(legal) : null;
}

/** All identities, sorted by symbol. The order carries no meaning. */
export function allIdentities(): FundIdentity[] {
  return availableSymbols()
    .map(identityFor)
    .filter((f): f is FundIdentity => f !== null);
}

export function seriesFor(symbol: string, basis: ReturnBasis = ACTIVE_BASIS): Availability<PriceSeries> {
  return getDisplayableSeries(activeProvider, symbol, basis);
}

/** Series for the given symbols, silently omitting any the provider cannot supply. */
export function getSeries(symbols: string[], basis: ReturnBasis = ACTIVE_BASIS): PriceSeries[] {
  return symbols
    .map((symbol) => seriesFor(symbol, basis))
    .filter(isAvailable)
    .map((entry) => entry.value);
}

export function getFund(symbol: string): FundRecord | null {
  const key = symbol.trim().toUpperCase();
  const identity = identityFor(key);
  if (!identity) return null;

  return {
    identity,
    prices: seriesFor(key),
    expenses: activeProvider.getExpenses(key),
    // Holdings and overlays are modelled but unconnected. Never an empty array
    // pretending to be an empty portfolio.
    holdings: activeProvider.getHoldings(key),
    overlays: activeProvider.getOverlays(key),
  };
}

export function getFunds(symbols: string[]): FundRecord[] {
  return symbols.map(getFund).filter((f): f is FundRecord => f !== null);
}

/**
 * Everything the comparison page needs, as plain data.
 *
 * Built on the server, after the access gate, and handed to the client
 * component as a prop. The client never imports this module or the provider,
 * which is what keeps the fixture out of the browser bundle — see
 * `./dataset.ts`.
 */
export function buildComparisonDataset(): ComparisonDataset {
  const symbols = availableSymbols();
  return {
    symbols,
    identities: allIdentities(),
    series: getSeries(symbols),
    provenance: PROVENANCE,
    demonstration: activeProvider.kind === "demonstration",
  };
}

// --- the gates --------------------------------------------------------------

/**
 * Re-exported from `./access.ts`, which is importable without the fixture.
 *
 * A page that only needs to decide whether to show the preview should import
 * from there rather than from here — importing this module pulls in the
 * provider and its data, which is exactly what a refusal is trying to avoid
 * shipping.
 */
export {
  ACTIVE_PROVIDER_DESCRIPTOR, evaluatePreviewAccess, previewAccessFromEnv,
  type EnvironmentInput, type PreviewAccess, type ProviderDescriptor,
} from "./access.ts";
