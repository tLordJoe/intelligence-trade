/**
 * Transaction-code classification.
 *
 * Descriptive only. A code says what kind of event the filer reported; it does
 * not say whether the person was bullish, whether the trade was discretionary,
 * whether it happened on the open market, or whether anything about it was
 * improper. Nothing in this file may grow a field that implies otherwise.
 *
 * Two conversions are prohibited outright and are the reason this module is
 * separate from the parser:
 *
 *   acquired (A) is not "bought"
 *   disposed (D) is not "sold"
 *
 * A gift disposes shares at a price of zero; an award acquires them without a
 * purchase. Reading the acquired/disposed flag as a trade direction turns both
 * into transactions that never happened.
 */

import type { Form4Classification, Form4RowKind, PriceQuality } from "./types.ts";

/**
 * Codes as defined by the Form 4 instructions.
 *
 * `K` (equity swap) and `V` (voluntary early report) are *modifiers* — they
 * describe a transaction rather than being one, and are carried on the row
 * rather than classified here.
 */
const CODE_CLASSIFICATION: Record<string, Form4Classification> = {
  P: "reported_purchase",
  S: "reported_sale",
  A: "award",
  M: "exercise_or_conversion",
  C: "exercise_or_conversion",
  X: "exercise_or_conversion",
  O: "exercise_or_conversion",
  F: "withholding_or_exercise_cost",
  D: "disposition_to_issuer",
  E: "expiration_or_cancellation",
  H: "expiration_or_cancellation",
  G: "gift",
  W: "inheritance",
  Z: "voting_trust",
  L: "other_reported",
  I: "other_reported",
  J: "other_reported",
  U: "other_reported",
};

/** Codes that modify a transaction rather than describing one. */
export const MODIFIER_CODES = new Set(["K", "V"]);

/**
 * Codes eligible for a purchase or sale screen.
 *
 * Only P and S, and only on the non-derivative table. A derivative `P` is a
 * purchase of an option or similar instrument, not of ordinary shares, and
 * must not be totalled with common-stock purchases.
 */
const SCREENABLE = new Set<Form4Classification>(["reported_purchase", "reported_sale"]);

export function classifyRow(
  rowKind: Form4RowKind,
  transactionCodeRaw: string | null
): { classification: Form4Classification; warnings: string[] } {
  if (rowKind === "holding") {
    return { classification: "holding", warnings: [] };
  }

  const code = (transactionCodeRaw ?? "").trim().toUpperCase();
  if (!code) {
    return {
      classification: "unknown_code",
      warnings: ["transaction_code_missing"],
    };
  }

  if (MODIFIER_CODES.has(code)) {
    // A row coded only with a modifier has no event to classify.
    return {
      classification: "unknown_code",
      warnings: [`modifier_code_without_transaction_code:${code}`],
    };
  }

  const classification = CODE_CLASSIFICATION[code];
  if (!classification) {
    // Preserved and surfaced for review, never guessed at.
    return {
      classification: "unknown_code",
      warnings: [`unrecognized_transaction_code:${code}`],
    };
  }

  return { classification, warnings: [] };
}

/**
 * Whether a row may appear in an ordinary purchase/sale screen.
 *
 * Derivative rows are excluded even when coded P or S, so option activity is
 * never blended into common-stock totals.
 */
export function isOrdinaryShareTrade(
  table: "nonDerivative" | "derivative",
  classification: Form4Classification
): boolean {
  return table === "nonDerivative" && SCREENABLE.has(classification);
}

/**
 * Reader-facing label.
 *
 * Neutral by construction: "Reported purchase", not "Insider bought". The
 * distinction matters because the same code covers private purchases and
 * transactions with the issuer.
 */
export function classificationLabel(classification: Form4Classification): string {
  switch (classification) {
    case "reported_purchase": return "Reported purchase";
    case "reported_sale": return "Reported sale";
    case "award": return "Grant or award";
    case "exercise_or_conversion": return "Exercise or conversion";
    case "withholding_or_exercise_cost": return "Shares withheld for taxes or exercise cost";
    case "disposition_to_issuer": return "Disposition to the issuer";
    case "expiration_or_cancellation": return "Expiration or cancellation";
    case "gift": return "Gift";
    case "inheritance": return "Inheritance";
    case "voting_trust": return "Voting trust movement";
    case "other_reported": return "Other reported transaction";
    case "holding": return "Holding, no transaction";
    case "unknown_code": return "Unrecognized code — needs review";
  }
}


/**
 * Footnote language that marks a reported price as an aggregate.
 *
 * Drawn from the wording filers actually use. The corpus for this project
 * contains 39 footnotes saying "executed in multiple trades at prices ranging
 * from $X to $Y" and 27 saying the price "reflects the weighted average".
 */
const AGGREGATE_PRICE_LANGUAGE =
  /weighted[ -]average|average (?:purchase |sale |sales )?price|prices ranging|range of prices|multiple (?:trades|transactions)|various prices/i;

/**
 * Decide how much confidence a reported price deserves.
 *
 * Conservative by construction. A bare number with no footnote is the only case
 * treated as `exact`; a number carrying a footnote we cannot interpret is
 * `unspecified`, because that footnote may be qualifying the price in a way we
 * have not recognised.
 */
export function classifyPriceQuality(
  priceValue: string | null,
  footnoteIds: string[],
  footnotes: Record<string, string>
): PriceQuality {
  const text = footnoteIds
    .map((id) => footnotes[id] ?? "")
    .join(" ")
    .trim();

  if (priceValue === null) {
    return footnoteIds.length > 0 ? "footnote_only" : "unspecified";
  }
  if (footnoteIds.length === 0) return "exact";
  if (AGGREGATE_PRICE_LANGUAGE.test(text)) return "weighted_average";

  // A price with an explanation we did not recognise. It may be exact; we
  // cannot say so.
  return "unspecified";
}

/** Whether a price may be presented to a reader as the price actually paid. */
export function isExecutionPrice(quality: PriceQuality): boolean {
  return quality === "exact";
}
