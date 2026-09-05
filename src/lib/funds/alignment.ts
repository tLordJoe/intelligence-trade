/**
 * Aligning several series onto one timeline.
 *
 * Two failures this module exists to prevent.
 *
 * **Positional alignment.** Given two funds' arrays, the obvious thing is to
 * pair `a.values[i]` with `b.values[i]`. It is wrong the moment one series is
 * missing a day the other has: every later observation of the shorter series
 * slides one day earlier, and the error grows with each additional gap. The
 * chart still draws — it just draws the wrong dates against each other. Nothing
 * downstream can detect it. So alignment here is always by date key.
 *
 * **Per-fund endpoints.** If each fund measures from its own first available
 * date to its own last, a comparison of five funds is five different
 * measurements printed in one table. One fund's five years might start a month
 * later than another's and end two days earlier, and the difference between
 * them is then partly the market and partly the calendar. So a comparison has
 * exactly one start date and exactly one end date, shared by every fund and
 * every metric, and a fund that cannot supply an observation on both is
 * excluded with a reason rather than measured on its own terms.
 */

import type { PriceSeries } from "./types.ts";

export interface CommonEndpoints {
  startDate: string;
  endDate: string;
  /** Symbols that have an observation on both endpoints. */
  includedSymbols: string[];
  /** Symbols excluded, and why, so the interface can say so. */
  excluded: Array<{ symbol: string; reason: string }>;
}

export type EndpointResult =
  | { status: "ok"; endpoints: CommonEndpoints }
  | { status: "unavailable"; reason: string };

const DAY_MS = 86_400_000;

function ms(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Dates on which every one of the given series has an observation. */
export function commonDates(series: PriceSeries[]): string[] {
  if (series.length === 0) return [];
  const sets = series.map((s) => new Set(s.dates));
  return series[0].dates.filter((date) => sets.every((set) => set.has(date)));
}

/**
 * The single pair of dates the whole comparison is measured between.
 *
 * The end is the latest date every selected fund reports. The start is the
 * earliest such date on or after `end − years`. Both are real observations
 * present in every included series, so no fund's figure is interpolated and no
 * two funds are measured over different spans.
 */
export function resolveCommonEndpoints(series: PriceSeries[], years: number): EndpointResult {
  if (series.length === 0) {
    return { status: "unavailable", reason: "No funds are selected." };
  }

  const shared = commonDates(series);
  if (shared.length < 2) {
    return {
      status: "unavailable",
      reason:
        "The selected funds do not share at least two dates, so there is no period " +
        "over which all of them can be measured.",
    };
  }

  const endDate = shared[shared.length - 1];
  const cutoff = ms(endDate) - Math.round(years * 365.25 * DAY_MS);
  const startDate = shared.find((date) => ms(date) >= cutoff);

  if (!startDate || startDate === endDate) {
    return {
      status: "unavailable",
      reason:
        "The selected funds share too little history for this period. Choose a " +
        "shorter period, or remove the fund with the shortest history.",
    };
  }

  return {
    status: "ok",
    endpoints: {
      startDate,
      endDate,
      includedSymbols: series.map((s) => s.symbol),
      excluded: [],
    },
  };
}

/**
 * The years of history every selected fund shares.
 *
 * Governed by the overlap, not by the longest series: five funds of which one
 * has two years of history do not support a five-year comparison, however long
 * the other four run.
 */
export function sharedYears(series: PriceSeries[]): number {
  const shared = commonDates(series);
  if (shared.length < 2) return 0;
  return (ms(shared[shared.length - 1]) - ms(shared[0])) / (365.25 * DAY_MS);
}

// --- aligned frames ----------------------------------------------------------

/**
 * Several series on one date axis.
 *
 * `dates` is the union of every observation date in the window, ascending. Each
 * column is the same length as `dates`, holding `null` where that series has no
 * observation on that day. The null is the honest answer and is drawn as a
 * break in the line — never carried forward, never interpolated, never dropped
 * so the remaining points shuffle up.
 */
export interface AlignedFrame {
  dates: string[];
  columns: Array<{ symbol: string; values: Array<number | null> }>;
  startDate: string;
  endDate: string;
}

export function alignSeries(
  series: PriceSeries[],
  startDate: string,
  endDate: string
): AlignedFrame {
  const union = new Set<string>();
  for (const s of series) {
    for (const date of s.dates) {
      if (date >= startDate && date <= endDate) union.add(date);
    }
  }
  const dates = [...union].sort();

  const columns = series.map((s) => {
    // One pass to a lookup, so alignment stays linear rather than quadratic in
    // the number of observations.
    const byDate = new Map<string, number>();
    for (let i = 0; i < s.dates.length; i += 1) byDate.set(s.dates[i], s.values[i]);
    return { symbol: s.symbol, values: dates.map((date) => byDate.get(date) ?? null) };
  });

  return { dates, columns, startDate, endDate };
}

/**
 * Rebase an aligned frame to percentage change from each series' value at the
 * frame's start date.
 *
 * The base is read at `startDate` specifically — not at the first non-null
 * value in the column — because a series missing the common start date has no
 * business being rebased at all. It returns null throughout instead, and the
 * caller excludes it.
 */
export function toPercentChange(frame: AlignedFrame): AlignedFrame {
  const startIndex = frame.dates.indexOf(frame.startDate);

  const columns = frame.columns.map((column) => {
    const base = startIndex === -1 ? null : column.values[startIndex];
    if (base === null || base === undefined || !(base > 0)) {
      return { symbol: column.symbol, values: frame.dates.map(() => null) };
    }
    return {
      symbol: column.symbol,
      values: column.values.map((value) =>
        value === null ? null : ((value - base) / base) * 100
      ),
    };
  });

  return { ...frame, columns };
}

/**
 * Contiguous runs of non-null points.
 *
 * A path drawn straight through a gap asserts a value on days the source did
 * not report. Splitting into runs lets the chart leave the gap visibly empty.
 */
export function contiguousRuns(
  values: Array<number | null>
): Array<Array<{ index: number; value: number }>> {
  const runs: Array<Array<{ index: number; value: number }>> = [];
  let current: Array<{ index: number; value: number }> = [];

  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push({ index, value });
  });
  if (current.length > 0) runs.push(current);

  return runs;
}
