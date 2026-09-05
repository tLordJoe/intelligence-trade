/**
 * Comparison selection, windows, returns and ranking.
 *
 * Every figure produced here is computed between **one** start date and **one**
 * end date shared by every selected fund, from values looked up by date rather
 * than by array position. `alignment.ts` establishes those dates; this file
 * refuses to measure anything without them.
 *
 * The return basis travels with every result. Nothing here may be described as
 * total return, as growth, or as what a reader would have earned, and when the
 * underlying source is demonstration data nothing here may be described as
 * market history either.
 *
 * Kept free of React so the arithmetic can be tested directly.
 */

import {
  alignSeries,
  resolveCommonEndpoints,
  sharedYears,
  toPercentChange,
  type AlignedFrame,
  type CommonEndpoints,
} from "./alignment.ts";
import { valueOn, type PriceSeries, type ReturnBasis, type ReturnMethodology } from "./types.ts";

// --- selection ---------------------------------------------------------------

export const MIN_FUNDS = 2;
export const MAX_FUNDS = 10;

/**
 * Funds shown when the page first loads.
 *
 * A starting point for the demonstration, deliberately spanning different kinds
 * of exposure. It is not a recommended portfolio, a ranking, or a "top" list,
 * and no copy anywhere may present it as one.
 */
export const STARTER_SYMBOLS = ["VOO", "QQQ", "XLK", "SMH", "XLU"] as const;

export type SelectionError =
  | { kind: "too_few"; message: string }
  | { kind: "too_many"; message: string }
  | { kind: "unknown_symbol"; symbol: string; message: string }
  | { kind: "duplicate"; symbol: string; message: string };

export interface SelectionResult {
  symbols: string[];
  errors: SelectionError[];
}

/**
 * Validate a set of symbols against what the provider can actually supply.
 *
 * Returns the usable selection *and* the reasons anything was refused, so the
 * interface can explain a rejection rather than silently dropping a choice.
 */
export function validateSelection(
  requested: string[],
  availableSymbols: string[]
): SelectionResult {
  const known = new Set(availableSymbols);
  const errors: SelectionError[] = [];
  const symbols: string[] = [];

  for (const raw of requested) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) continue;
    if (!known.has(symbol)) {
      errors.push({
        kind: "unknown_symbol",
        symbol,
        message: `${symbol} is not in this preview's data set, so it cannot be compared here.`,
      });
      continue;
    }
    if (symbols.includes(symbol)) {
      errors.push({ kind: "duplicate", symbol, message: `${symbol} is already in the comparison.` });
      continue;
    }
    if (symbols.length >= MAX_FUNDS) {
      errors.push({
        kind: "too_many",
        message:
          `This comparison holds up to ${MAX_FUNDS} funds. Remove one before adding ${symbol}.`,
      });
      continue;
    }
    symbols.push(symbol);
  }

  if (symbols.length < MIN_FUNDS) {
    errors.push({ kind: "too_few", message: `Choose at least ${MIN_FUNDS} funds to compare.` });
  }

  return { symbols, errors };
}

export function canAddFund(current: string[]): boolean {
  return current.length < MAX_FUNDS;
}

export function canRemoveFund(current: string[]): boolean {
  return current.length > MIN_FUNDS;
}

// --- example amounts ---------------------------------------------------------

/**
 * Preset illustration amounts.
 *
 * These size an example calculation. They are not suggested investment amounts,
 * and the interface says so wherever they appear.
 */
export const AMOUNT_PRESETS = [100, 500, 1000, 5000] as const;
export const DEFAULT_AMOUNT = 1000;
export const MAX_AMOUNT = 10_000_000;

export type AmountValidation = { valid: true; amount: number } | { valid: false; message: string };

export function validateAmount(input: number | string): AmountValidation {
  const amount = typeof input === "number" ? input : Number(String(input).replace(/[,$\s]/g, ""));

  if (!Number.isFinite(amount)) return { valid: false, message: "Enter a number." };
  if (amount <= 0) return { valid: false, message: "Enter an amount greater than zero." };
  if (amount > MAX_AMOUNT) {
    return {
      valid: false,
      message: `Enter an amount up to ${MAX_AMOUNT.toLocaleString("en-US")}.`,
    };
  }
  return { valid: true, amount: Math.round(amount * 100) / 100 };
}

// --- time windows ------------------------------------------------------------

export type WindowKey = "1y" | "3y" | "5y";

export interface TimeWindow {
  key: WindowKey;
  label: string;
  years: number;
}

export const WINDOWS: TimeWindow[] = [
  { key: "1y", label: "1 year", years: 1 },
  { key: "3y", label: "3 years", years: 3 },
  { key: "5y", label: "5 years", years: 5 },
];

export interface WindowAvailability {
  key: WindowKey;
  label: string;
  enabled: boolean;
  /** Why a window is unavailable, for display next to the disabled control. */
  reason: string | null;
  /** Years of history every selected fund shares. Not the longest series'. */
  sharedYears: number;
}

/**
 * Which windows the selected funds jointly support.
 *
 * Governed by the shared history, not the longest: a five-year comparison in
 * which one fund only has two years is not a five-year comparison. Windows
 * beyond the overlap are disabled with the reason, never approximated.
 */
export function availableWindows(series: PriceSeries[]): WindowAvailability[] {
  if (series.length === 0) {
    return WINDOWS.map((w) => ({
      key: w.key, label: w.label, enabled: false,
      reason: "No funds selected.", sharedYears: 0,
    }));
  }

  const years = sharedYears(series);

  return WINDOWS.map((w) => {
    const enabled = resolveCommonEndpoints(series, w.years).status === "ok" && years >= w.years;
    return {
      key: w.key,
      label: w.label,
      enabled,
      reason: enabled
        ? null
        : `The selected funds share ${years.toFixed(1)} years of overlapping data, so a ` +
          `comparison over ${w.label.toLowerCase()} cannot cover all of them.`,
      sharedYears: years,
    };
  });
}

// --- returns -----------------------------------------------------------------

export interface FundReturn {
  symbol: string;
  /** Percentage change over the common period, on the stated basis. */
  changePercent: number;
  basis: ReturnBasis;
  /** Identical across every fund in a comparison. */
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  /** The example amount scaled by the change. Illustration only. */
  illustrativeEndValue: number;
}

/** Percentage change between two values. */
export function changePercent(startValue: number, endValue: number): number {
  if (!(startValue > 0)) return 0;
  return ((endValue - startValue) / startValue) * 100;
}

/**
 * Scale an example amount by a change.
 *
 * Deliberately named an illustration. It is the example amount moved by the
 * series and nothing else — no distributions, no reinvestment, no costs, no
 * taxes — so it is not a statement of what anyone would have.
 */
export function illustrativeValue(amount: number, startValue: number, endValue: number): number {
  if (!(startValue > 0) || !(amount > 0)) return 0;
  return Math.round(amount * (endValue / startValue) * 100) / 100;
}

// --- ranking -----------------------------------------------------------------

export interface RankedReturn extends FundReturn {
  /** 1-based. Ties share a rank, and the next rank skips accordingly (1, 1, 3). */
  rank: number;
  isHighest: boolean;
  tiedAtRank: boolean;
}

/**
 * Rank by measured change over the common period.
 *
 * Ties share a rank and are marked, so the interface never presents one of two
 * identical results as ahead of the other. The label attached to the top rank
 * is contextual — highest *in this comparison, over this period* — and never
 * "best", "winner", or a recommendation.
 */
export function rankReturns(returns: FundReturn[]): RankedReturn[] {
  const sorted = [...returns].sort((a, b) => b.changePercent - a.changePercent);
  const ranked: RankedReturn[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const tiedWithPrevious = i > 0 && closeEnough(current.changePercent, sorted[i - 1].changePercent);
    const rank = tiedWithPrevious ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...current, rank, isHighest: rank === 1, tiedAtRank: false });
  }

  const counts = new Map<number, number>();
  for (const entry of ranked) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  for (const entry of ranked) entry.tiedAtRank = (counts.get(entry.rank) ?? 0) > 1;

  return ranked;
}

/** Changes within a hundredth of a percentage point are treated as equal. */
function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export const HIGHEST_RETURN_LABEL = "Highest measured change in this comparison";

// --- the whole comparison ----------------------------------------------------

export type Comparison =
  | {
      status: "measured";
      endpoints: CommonEndpoints;
      ranked: RankedReturn[];
      /** Every selected series on one date axis, aligned by date key. */
      frame: AlignedFrame;
      /** The same frame rebased to percentage change from the common start. */
      percentFrame: AlignedFrame;
      basis: ReturnBasis;
      /** Funds dropped for want of an observation on a common endpoint. */
      excluded: Array<{ symbol: string; reason: string }>;
    }
  | { status: "unmeasurable"; reason: string };

/**
 * Measure a comparison.
 *
 * Establishes the common endpoints first, then measures every fund between
 * exactly those two dates — which is the whole reason this returns one object
 * rather than a list of per-fund results computed independently.
 *
 * The endpoints come from the intersection of every selected fund's dates, so a
 * fund with a shorter history pulls the shared period in rather than being
 * measured over a longer one of its own. The exclusion path below therefore
 * catches the remaining case: a value present but unusable as a base, such as a
 * zero, which would otherwise divide into an infinity or a silent zero.
 */
export function buildComparison(
  series: PriceSeries[],
  window: WindowKey,
  amount: number
): Comparison {
  const years = WINDOWS.find((w) => w.key === window)?.years;
  if (!years) return { status: "unmeasurable", reason: `Unknown period ${window}.` };

  const resolved = resolveCommonEndpoints(series, years);
  if (resolved.status !== "ok") return { status: "unmeasurable", reason: resolved.reason };

  const { startDate, endDate } = resolved.endpoints;
  const basis: ReturnBasis = series[0]?.methodology.basis ?? "price_return";

  const returns: FundReturn[] = [];
  const excluded: Array<{ symbol: string; reason: string }> = [];

  for (const s of series) {
    const startValue = valueOn(s, startDate);
    const endValue = valueOn(s, endDate);

    if (startValue === null || endValue === null || !(startValue > 0)) {
      excluded.push({
        symbol: s.symbol,
        reason:
          `${s.symbol} has no observation on ${startValue === null ? startDate : endDate}, ` +
          "so it cannot be measured over the same period as the others.",
      });
      continue;
    }

    returns.push({
      symbol: s.symbol,
      changePercent: changePercent(startValue, endValue),
      basis: s.methodology.basis,
      startDate,
      endDate,
      startValue,
      endValue,
      illustrativeEndValue: illustrativeValue(amount, startValue, endValue),
    });
  }

  if (returns.length === 0) {
    return {
      status: "unmeasurable",
      reason: "None of the selected funds report on both ends of the common period.",
    };
  }

  const included = series.filter((s) => returns.some((r) => r.symbol === s.symbol));
  const frame = alignSeries(included, startDate, endDate);

  return {
    status: "measured",
    endpoints: { ...resolved.endpoints, includedSymbols: returns.map((r) => r.symbol), excluded },
    ranked: rankReturns(returns),
    frame,
    percentFrame: toPercentChange(frame),
    basis,
    excluded,
  };
}

// --- plain-English summary ---------------------------------------------------

/**
 * A summary built only from measured values.
 *
 * Rules-based rather than generated: it states which fund changed most and
 * least over the stated period and stops there. It draws no conclusion about
 * quality, suitability, or what happens next, because nothing in the data
 * supports one — and when the data is a demonstration fixture, it says that
 * first, before any number.
 */
export function summarize(
  ranked: RankedReturn[],
  window: WindowKey,
  methodology: ReturnMethodology,
  options: { demonstration: boolean }
): string[] {
  if (ranked.length === 0) return ["Select at least two funds to compare."];

  const label = WINDOWS.find((w) => w.key === window)?.label ?? window;
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const lines: string[] = [];

  if (options.demonstration) {
    lines.push(
      "These figures come from generated demonstration data. They describe no real " +
        "fund and no real market, and nothing below is a statement about how any " +
        "fund has performed."
    );
  }

  const period = `${top.startDate} to ${top.endDate}`;
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const topTied = ranked.filter((r) => r.rank === 1);
  if (topTied.length > 1) {
    lines.push(
      `Over ${label} (${period}), ${topTied.map((r) => r.symbol).join(" and ")} show the ` +
        `same highest change in this comparison, ${fmt(top.changePercent)}.`
    );
  } else {
    lines.push(
      `Over ${label} (${period}), ${top.symbol} shows the highest change in this ` +
        `comparison at ${fmt(top.changePercent)}.`
    );
  }

  if (ranked.length > 1 && bottom.rank !== top.rank) {
    lines.push(`${bottom.symbol} shows the lowest at ${fmt(bottom.changePercent)}.`);
  }

  lines.push(
    `Every fund is measured between the same two dates, ${period}, so no part of the ` +
      "difference between them comes from measuring different periods."
  );

  if (methodology.basis === "price_return") {
    lines.push(
      "This is a price basis only. Distributions are not included, so it is not total " +
        "return and not a measure of what an investor would have received."
    );
  }

  lines.push("Past movement does not indicate future results.");
  return lines;
}

// --- URL state ---------------------------------------------------------------

export interface CompareState {
  symbols: string[];
  amount: number;
  window: WindowKey;
}

export function encodeState(state: CompareState): string {
  const params = new URLSearchParams();
  params.set("funds", state.symbols.join(","));
  params.set("amount", String(state.amount));
  params.set("period", state.window);
  return params.toString();
}

/**
 * Restore a comparison from a query string.
 *
 * Every field falls back to a default rather than throwing: a shared link with
 * one bad parameter should still open a working comparison.
 */
export function decodeState(
  query: URLSearchParams | string,
  availableSymbols: string[]
): CompareState {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;

  const requested = (params.get("funds") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const { symbols } = validateSelection(requested, availableSymbols);
  const fallback = STARTER_SYMBOLS.filter((s) => availableSymbols.includes(s));
  const usable = symbols.length >= MIN_FUNDS ? symbols : [...fallback];

  const amountCheck = validateAmount(params.get("amount") ?? DEFAULT_AMOUNT);
  const amount = amountCheck.valid ? amountCheck.amount : DEFAULT_AMOUNT;

  const windowParam = params.get("period") as WindowKey | null;
  const window = WINDOWS.some((w) => w.key === windowParam) ? (windowParam as WindowKey) : "1y";

  return { symbols: usable, amount, window };
}

// --- placeholders for sources not yet connected ------------------------------

export interface PlaceholderSection {
  id: string;
  title: string;
  description: string;
  /**
   * Always the unavailable variant. Typed narrowly rather than as a general
   * `Availability`, because a placeholder that could carry a value would defeat
   * the point of the section.
   */
  value: { status: "unavailable"; reason: "source_not_connected" };
}

/**
 * Sections the interface shows but cannot yet fill.
 *
 * Present so the shape of the finished comparison is visible, and explicitly
 * unavailable so nothing here reads as zero, none, or nil.
 */
export function placeholderSections(): PlaceholderSection[] {
  const pending = { status: "unavailable" as const, reason: "source_not_connected" as const };
  return [
    { id: "total-return", title: "Total return",
      description: "Change including distributions, reinvested — the basis a finished comparison should lead with.",
      value: pending },
    { id: "expenses", title: "Expense ratio and annual cost",
      description: "What the fund charges annually, and what that costs on the example amount.",
      value: pending },
    { id: "aum", title: "Fund size",
      description: "Assets under management, and how that has changed.",
      value: pending },
    { id: "concentration", title: "Holdings concentration",
      description: "How much of the fund sits in its largest positions.",
      value: pending },
    { id: "overlap", title: "Holdings overlap",
      description: "How much the selected funds hold in common, compared at a holdings date they all report.",
      value: pending },
    { id: "stack", title: "AI and data-centre stack exposure",
      description: "How much of each fund maps to the layers of the AI build-out.",
      value: pending },
    { id: "disclosures", title: "Disclosed activity in holdings",
      description: "House, insider and institutional disclosures touching these holdings, kept as separate lanes.",
      value: pending },
  ];
}
