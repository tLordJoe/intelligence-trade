/**
 * Comparison selection, windows, returns and ranking.
 *
 * Every figure produced here is a **price return** computed from committed
 * closing prices. None of it accounts for dividends, distributions, taxes,
 * trading costs or reinvestment, and nothing in this file may be described as
 * what a reader would have earned.
 *
 * Kept free of React so the arithmetic can be tested directly.
 */

import type { Availability, PriceSeries, ReturnMethodology } from "./types.ts";

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
 * Validate a set of symbols against what the dataset can actually draw.
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
        message: `${symbol} is not in this preview's price data, so it cannot be compared yet.`,
      });
      continue;
    }
    if (symbols.includes(symbol)) {
      errors.push({
        kind: "duplicate",
        symbol,
        message: `${symbol} is already in the comparison.`,
      });
      continue;
    }
    if (symbols.length >= MAX_FUNDS) {
      errors.push({
        kind: "too_many",
        message:
          `This comparison holds up to ${MAX_FUNDS} funds. ` +
          `Remove one before adding ${symbol}.`,
      });
      continue;
    }
    symbols.push(symbol);
  }

  if (symbols.length < MIN_FUNDS) {
    errors.push({
      kind: "too_few",
      message: `Choose at least ${MIN_FUNDS} funds to compare.`,
    });
  }

  return { symbols, errors };
}

/** Whether another fund may be added. */
export function canAddFund(current: string[]): boolean {
  return current.length < MAX_FUNDS;
}

/** Whether a fund may be removed without dropping below the minimum. */
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

export type AmountValidation =
  | { valid: true; amount: number }
  | { valid: false; message: string };

/** A custom amount must be a positive, finite number within a sane bound. */
export function validateAmount(input: number | string): AmountValidation {
  const amount = typeof input === "number" ? input : Number(String(input).replace(/[,$\s]/g, ""));

  if (!Number.isFinite(amount)) {
    return { valid: false, message: "Enter a number." };
  }
  if (amount <= 0) {
    return { valid: false, message: "Enter an amount greater than zero." };
  }
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
  /** Years of history the shortest selected series actually provides. */
  coveredYears: number;
}

/**
 * Which windows the selected funds genuinely support.
 *
 * Governed by the *shortest* selected series: a five-year comparison in which
 * one fund only has two years of history is not a five-year comparison. Windows
 * beyond that are disabled with the reason, never approximated or extrapolated.
 */
export function availableWindows(series: PriceSeries[]): WindowAvailability[] {
  if (series.length === 0) {
    return WINDOWS.map((w) => ({
      key: w.key, label: w.label, enabled: false,
      reason: "No funds selected.", coveredYears: 0,
    }));
  }

  const spans = series.map((s) => {
    if (s.dates.length < 2) return 0;
    const first = Date.parse(`${s.dates[0]}T00:00:00Z`);
    const last = Date.parse(`${s.dates[s.dates.length - 1]}T00:00:00Z`);
    return (last - first) / (365.25 * 86_400_000);
  });
  const coveredYears = Math.min(...spans);

  return WINDOWS.map((w) => {
    const enabled = coveredYears >= w.years;
    return {
      key: w.key,
      label: w.label,
      enabled,
      reason: enabled
        ? null
        : `This preview holds ${coveredYears.toFixed(1)} years of prices for the ` +
          `selected funds, so a ${w.label.toLowerCase()} comparison cannot be measured.`,
      coveredYears,
    };
  });
}

// --- returns -----------------------------------------------------------------

export interface WindowSlice {
  symbol: string;
  startDate: string;
  endDate: string;
  startClose: number;
  endClose: number;
  dates: string[];
  closes: number[];
}

/**
 * The portion of a series covering the requested window.
 *
 * The start is the first observation on or after the cutoff, so the measured
 * period is always described by real dates present in the data rather than by
 * the nominal window.
 */
export function sliceWindow(series: PriceSeries, window: WindowKey): WindowSlice | null {
  const years = WINDOWS.find((w) => w.key === window)?.years;
  if (!years || series.dates.length < 2) return null;

  const lastMs = Date.parse(`${series.dates[series.dates.length - 1]}T00:00:00Z`);
  const cutoff = lastMs - years * 365.25 * 86_400_000;

  let startIndex = series.dates.findIndex(
    (d) => Date.parse(`${d}T00:00:00Z`) >= cutoff
  );
  if (startIndex === -1) return null;
  // Need at least two observations to measure a change.
  if (startIndex >= series.dates.length - 1) startIndex = series.dates.length - 2;

  const dates = series.dates.slice(startIndex);
  const closes = series.closes.slice(startIndex);
  if (closes.length < 2 || !(closes[0] > 0)) return null;

  return {
    symbol: series.symbol,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    startClose: closes[0],
    endClose: closes[closes.length - 1],
    dates,
    closes,
  };
}

export interface FundReturn {
  symbol: string;
  /** Percentage change in price over the measured period. */
  priceReturnPercent: number;
  startDate: string;
  endDate: string;
  startClose: number;
  endClose: number;
  /** The example amount scaled by the price change. Illustration only. */
  illustrativeEndValue: number;
  /** Percentage-change series indexed to the window start, for charting. */
  indexedSeries: Array<{ date: string; percent: number }>;
}

/** Percentage price change between two closes. */
export function priceReturnPercent(startClose: number, endClose: number): number {
  if (!(startClose > 0)) return 0;
  return ((endClose - startClose) / startClose) * 100;
}

/**
 * Scale an example amount by a price change.
 *
 * Deliberately named an illustration. It is the example amount moved by the
 * price series and nothing else — no distributions, no reinvestment, no costs,
 * no taxes — so it is not a statement of what anyone would have.
 */
export function illustrativeValue(amount: number, startClose: number, endClose: number): number {
  if (!(startClose > 0) || !(amount > 0)) return 0;
  return Math.round(amount * (endClose / startClose) * 100) / 100;
}

export function computeReturn(
  series: PriceSeries,
  window: WindowKey,
  amount: number
): FundReturn | null {
  const slice = sliceWindow(series, window);
  if (!slice) return null;

  return {
    symbol: slice.symbol,
    priceReturnPercent: priceReturnPercent(slice.startClose, slice.endClose),
    startDate: slice.startDate,
    endDate: slice.endDate,
    startClose: slice.startClose,
    endClose: slice.endClose,
    illustrativeEndValue: illustrativeValue(amount, slice.startClose, slice.endClose),
    indexedSeries: slice.dates.map((date, i) => ({
      date,
      percent: priceReturnPercent(slice.startClose, slice.closes[i]),
    })),
  };
}

// --- ranking -----------------------------------------------------------------

export interface RankedReturn extends FundReturn {
  /** 1-based. Ties share a rank. */
  rank: number;
  /** True for every fund sharing the top rank. */
  isHighest: boolean;
  tiedAtRank: boolean;
}

/**
 * Rank by measured price return over the window.
 *
 * Ties share a rank and are marked, so the interface can avoid presenting one
 * of two identical results as ahead of the other. The label attached to the top
 * rank is contextual — highest *in this comparison, over this period* — and
 * never "best", "winner" or a recommendation.
 */
export function rankReturns(returns: FundReturn[]): RankedReturn[] {
  const sorted = [...returns].sort((a, b) => b.priceReturnPercent - a.priceReturnPercent);
  const ranked: RankedReturn[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const tiedWithPrevious =
      i > 0 && closeEnough(current.priceReturnPercent, sorted[i - 1].priceReturnPercent);
    const rank = tiedWithPrevious ? ranked[i - 1].rank : i + 1;
    ranked.push({ ...current, rank, isHighest: rank === 1, tiedAtRank: false });
  }

  // Mark every member of a shared rank, including the first of the group.
  const counts = new Map<number, number>();
  for (const entry of ranked) counts.set(entry.rank, (counts.get(entry.rank) ?? 0) + 1);
  for (const entry of ranked) entry.tiedAtRank = (counts.get(entry.rank) ?? 0) > 1;

  return ranked;
}

/** Returns within a hundredth of a percentage point are treated as equal. */
function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export const HIGHEST_RETURN_LABEL = "Highest historical price return in this comparison";

// --- plain-English summary ---------------------------------------------------

/**
 * A summary built only from measured values.
 *
 * Rules-based rather than generated: it states which fund had the highest and
 * lowest price return over the stated period and stops there. It draws no
 * conclusion about quality, suitability or what happens next, because nothing
 * in the data supports one.
 */
export function summarize(
  ranked: RankedReturn[],
  window: WindowKey,
  methodology: ReturnMethodology
): string[] {
  if (ranked.length === 0) return ["Select at least two funds to compare."];

  const label = WINDOWS.find((w) => w.key === window)?.label ?? window;
  const top = ranked[0];
  const bottom = ranked[ranked.length - 1];
  const lines: string[] = [];

  const period = `${top.startDate} to ${top.endDate}`;
  const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  const topTied = ranked.filter((r) => r.rank === 1);
  if (topTied.length > 1) {
    lines.push(
      `Over ${label} (${period}), ${topTied.map((r) => r.symbol).join(" and ")} ` +
        `had the same highest price return in this comparison, ${fmt(top.priceReturnPercent)}.`
    );
  } else {
    lines.push(
      `Over ${label} (${period}), ${top.symbol} had the highest price return in this ` +
        `comparison at ${fmt(top.priceReturnPercent)}.`
    );
  }

  if (ranked.length > 1 && bottom.rank !== top.rank) {
    lines.push(
      `${bottom.symbol} had the lowest at ${fmt(bottom.priceReturnPercent)}.`
    );
  }

  if (!methodology.dividendAdjusted) {
    lines.push(
      "These are price changes only. Dividends and distributions are not included, " +
        "so they are not a measure of total return."
    );
  }

  lines.push("Past price movement does not indicate future results.");
  return lines;
}

// --- URL state ---------------------------------------------------------------

export interface CompareState {
  symbols: string[];
  amount: number;
  window: WindowKey;
}

/** Serialise to a query string so a comparison can be shared as a link. */
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
  const usable = symbols.length >= MIN_FUNDS ? symbols : [...STARTER_SYMBOLS];

  const amountCheck = validateAmount(params.get("amount") ?? DEFAULT_AMOUNT);
  const amount = amountCheck.valid ? amountCheck.amount : DEFAULT_AMOUNT;

  const windowParam = params.get("period") as WindowKey | null;
  const window = WINDOWS.some((w) => w.key === windowParam)
    ? (windowParam as WindowKey)
    : "1y";

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
  value: Extract<Availability<never>, { status: "unavailable" }>;
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
    { id: "expenses", title: "Expense ratio and annual cost",
      description: "What the fund charges annually, and what that costs on the example amount.",
      value: pending },
    { id: "concentration", title: "Holdings concentration",
      description: "How much of the fund sits in its largest positions.",
      value: pending },
    { id: "overlap", title: "Holdings overlap",
      description: "How much the selected funds hold in common.",
      value: pending },
    { id: "stack", title: "AI and data-centre stack exposure",
      description: "How much of each fund maps to the layers of the AI build-out.",
      value: pending },
    { id: "disclosures", title: "Disclosed activity in holdings",
      description: "House, insider and institutional disclosures touching these holdings, kept as separate lanes.",
      value: pending },
  ];
}
