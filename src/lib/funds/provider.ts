/**
 * The seam a licensed data source plugs into.
 *
 * Everything above this line — the page, the chart, the arithmetic, the tests —
 * talks to `FundDataProvider` and never to a vendor. Connecting a licensed
 * source later means writing one implementation of this interface and changing
 * one line in `data.ts`; it does not mean touching a component.
 *
 * Three things the interface enforces rather than documents:
 *
 *   - **Rights travel with the data.** A provider states what it is permitted
 *     to be used for, and `assertDisplayable` refuses to hand anything to a
 *     public surface unless that permission is explicit.
 *
 *   - **The return basis is an argument.** `getPriceSeries(symbol, basis)` can
 *     answer "I do not supply total return" instead of quietly returning price
 *     return under the wrong name.
 *
 *   - **Absence is a value.** Every getter returns an `Availability`, so a
 *     provider that lacks holdings says so and cannot be mistaken for a fund
 *     that holds nothing.
 */

import type { FundLegalIdentity } from "./identity.ts";
import { permitsPublicDisplay, type DataRights, type RightsDecision } from "./rights.ts";
import {
  unavailable,
  type Availability,
  type DisclosureOverlay,
  type ExpenseData,
  type HoldingsHistory,
  type PriceSeries,
  type ReturnBasis,
  type SourceProvenance,
} from "./types.ts";

export interface FundDataProvider {
  /** Stable machine identifier, e.g. `outfox-demonstration-v1`. */
  readonly id: string;
  /** What a reader should be told the source is. */
  readonly displayName: string;
  /**
   * `demonstration` data describes nothing real and must be labelled wherever
   * it appears. `licensed` data comes from a provider under terms.
   */
  readonly kind: "demonstration" | "licensed";
  readonly rights: DataRights;
  readonly provenance: SourceProvenance;

  /** Which return bases this provider can actually supply. */
  readonly supportedBases: ReturnBasis[];

  listSymbols(): string[];
  getLegalIdentity(symbol: string): FundLegalIdentity | null;
  getPriceSeries(symbol: string, basis: ReturnBasis): Availability<PriceSeries>;
  getExpenses(symbol: string): ExpenseData;
  getHoldings(symbol: string): Availability<HoldingsHistory>;
  getOverlays(symbol: string): DisclosureOverlay[];
}

/**
 * The gate every public surface must pass through.
 *
 * Fails closed: a provider whose rights are empty, unexamined, or lack an
 * explicit public-display grant is refused, and the refusal carries a reason a
 * reader can be shown.
 */
export function assertDisplayable(provider: FundDataProvider): RightsDecision {
  return permitsPublicDisplay(provider.rights);
}

/**
 * Fetch a series only when the provider is cleared for public display.
 *
 * The point of routing through here is that forgetting the rights check
 * requires deliberately calling `getPriceSeries` directly, rather than being
 * the default path.
 */
export function getDisplayableSeries(
  provider: FundDataProvider,
  symbol: string,
  basis: ReturnBasis
): Availability<PriceSeries> {
  const decision = assertDisplayable(provider);
  if (!decision.allowed) {
    return unavailable<PriceSeries>("rights_not_established", decision.reason);
  }
  if (!provider.supportedBases.includes(basis)) {
    return unavailable<PriceSeries>(
      "basis_not_supplied",
      `${provider.displayName} does not supply ${basis.replace(/_/g, " ")}.`
    );
  }
  return provider.getPriceSeries(symbol, basis);
}
