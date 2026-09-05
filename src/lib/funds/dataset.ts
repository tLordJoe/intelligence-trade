/**
 * What the comparison page hands to the browser.
 *
 * The client component never imports a provider. It is given one of these —
 * built on the server, only after the access gate has said yes — and works from
 * it alone. That is the mechanism by which the demonstration fixture stays out
 * of every browser asset: a module the client never imports is a module the
 * bundler never ships, and a prop the server never builds is a payload the
 * browser never receives.
 *
 * Everything here is plain data. No functions, no class instances, nothing a
 * React Server Component could not serialise across the boundary.
 */

import { buildColorAssignment, type ColorAssignment } from "./colors.ts";
import type { FundIdentity, PriceSeries, SourceProvenance } from "./types.ts";

export interface ComparisonDataset {
  /** Every symbol the source offers, sorted. Colours are assigned from this. */
  symbols: string[];
  identities: FundIdentity[];
  /** Series for every symbol in `symbols`, on the active basis. */
  series: PriceSeries[];
  provenance: SourceProvenance;
  /** True when every value must be labelled as demonstration output. */
  demonstration: boolean;
}

/**
 * Colours for a dataset.
 *
 * Built from the dataset's full symbol list, not from the current selection,
 * so a fund keeps its colour when others are added, removed or re-ranked.
 */
export function colorsFor(dataset: ComparisonDataset): ColorAssignment {
  return buildColorAssignment(dataset.symbols);
}

export function seriesFrom(dataset: ComparisonDataset, symbols: string[]): PriceSeries[] {
  const bySymbol = new Map(dataset.series.map((s) => [s.symbol, s]));
  return symbols
    .map((symbol) => bySymbol.get(symbol.trim().toUpperCase()))
    .filter((s): s is PriceSeries => s !== undefined);
}
