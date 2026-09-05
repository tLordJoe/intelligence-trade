"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  AMOUNT_PRESETS, HIGHEST_RETURN_LABEL, MAX_FUNDS, MIN_FUNDS,
  availableWindows, canRemoveFund, computeReturn, decodeState, encodeState,
  placeholderSections, rankReturns, summarize, validateAmount,
  type RankedReturn, type WindowKey,
} from "@/lib/funds/compare";
import { METHODOLOGY, PROVENANCE, allIdentities, availableSymbols, getSeries } from "@/lib/funds/data";
import { describeUnavailable } from "@/lib/funds/types";

/**
 * Fund comparison preview.
 *
 * Every figure is a price return computed from a committed price snapshot. The
 * page makes no request to a price provider, and nothing here may be described
 * as total return or as what a reader would have earned.
 *
 * Interaction rule: nothing important is hover-only. The chart shows shape; the
 * table beside it carries every number the chart encodes, always visible, and
 * every control is a real button or input reachable by keyboard and touch.
 */

const SERIES_COLORS = [
  "var(--accent)", "#3B82F6", "#F59E0B", "#EF4444", "#10B981",
  "#A855F7", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

const SYMBOLS = availableSymbols();
const IDENTITIES = allIdentities();

type ChartMode = "percent" | "dollars";

export default function FundComparison() {
  const initial = useMemo(
    () => decodeState(typeof window === "undefined" ? "" : window.location.search, SYMBOLS),
    []
  );

  const [symbols, setSymbols] = useState<string[]>(initial.symbols);
  const [amount, setAmount] = useState<number>(initial.amount);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>(initial.window);
  const [mode, setMode] = useState<ChartMode>("percent");
  const [notice, setNotice] = useState<string | null>(null);

  const series = useMemo(() => getSeries(symbols), [symbols]);
  const windows = useMemo(() => availableWindows(series), [series]);

  /**
   * The window actually used, derived rather than stored.
   *
   * Removing a long-history fund can leave the chosen period uncovered. Falling
   * back during render — instead of correcting stored state in an effect —
   * avoids a cascading render, and keeps the reader's original choice so it
   * returns intact if they add the longer fund back.
   */
  const effectiveWindow: WindowKey = useMemo(() => {
    const chosen = windows.find((w) => w.key === windowKey);
    if (chosen?.enabled) return windowKey;
    return windows.find((w) => w.enabled)?.key ?? windowKey;
  }, [windows, windowKey]);

  const ranked: RankedReturn[] = useMemo(() => {
    const returns = series
      .map((s) => computeReturn(s, effectiveWindow, amount))
      .filter((r): r is NonNullable<typeof r> => r !== null);
    return rankReturns(returns);
  }, [series, effectiveWindow, amount]);

  const summary = useMemo(
    () => summarize(ranked, effectiveWindow, METHODOLOGY),
    [ranked, effectiveWindow]
  );
  const placeholders = useMemo(() => placeholderSections(), []);

  // Keep the address bar in step so the view is always shareable as it stands.
  useEffect(() => {
    const query = encodeState({ symbols, amount, window: effectiveWindow });
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }, [symbols, amount, effectiveWindow]);

  const addFund = useCallback((symbol: string) => {
    setSymbols((current) => {
      if (current.includes(symbol)) {
        setNotice(`${symbol} is already in this comparison.`);
        return current;
      }
      if (current.length >= MAX_FUNDS) {
        setNotice(
          `This comparison holds up to ${MAX_FUNDS} funds. Remove one before adding ${symbol}.`
        );
        return current;
      }
      setNotice(null);
      return [...current, symbol];
    });
  }, []);

  const removeFund = useCallback((symbol: string) => {
    setSymbols((current) => {
      if (!canRemoveFund(current)) {
        setNotice(`Keep at least ${MIN_FUNDS} funds to compare.`);
        return current;
      }
      setNotice(null);
      return current.filter((s) => s !== symbol);
    });
  }, []);

  const applyCustomAmount = useCallback(() => {
    const result = validateAmount(customAmount);
    if (!result.valid) {
      setAmountError(result.message);
      return;
    }
    setAmountError(null);
    setAmount(result.amount);
  }, [customAmount]);

  const measured = ranked[0];
  const card = { backgroundColor: "var(--bg-card)", borderColor: "var(--border)" };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="kicker mb-2">Fund comparison · Preview</div>
      <h1
        className="text-3xl md:text-5xl font-extrabold mb-4"
        style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
      >
        Compare funds on price history
      </h1>
      <p className="text-base md:text-lg max-w-2xl mb-3" style={{ color: "var(--text-dim)" }}>
        Pick {MIN_FUNDS} to {MAX_FUNDS} funds and see how their share prices moved over a
        period you choose. These are price changes only — not a measure of what
        you would have earned.
      </p>
      <p className="text-xs mb-8" style={{ color: "var(--text-dim)" }}>
        Prices captured {new Date(PROVENANCE.capturedAt).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        })} from {PROVENANCE.sourceName}. This preview reads a stored snapshot and does not
        query a price provider.
      </p>

      {/* --- selection ------------------------------------------------------ */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="funds-heading">
        <h2 id="funds-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
          Funds in this comparison
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          A starting set spanning different kinds of exposure. It is not a recommended
          portfolio and the order carries no meaning.
        </p>

        <ul className="flex flex-wrap gap-2 mb-4 list-none p-0">
          {symbols.map((symbol, i) => {
            const identity = IDENTITIES.find((f) => f.symbol === symbol);
            return (
              <li key={symbol}>
                <span
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-inset)" }}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                  />
                  <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{symbol}</span>
                  <span className="hidden sm:inline text-xs" style={{ color: "var(--text-dim)" }}>
                    {identity?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFund(symbol)}
                    disabled={!canRemoveFund(symbols)}
                    aria-label={`Remove ${identity?.name ?? symbol} from the comparison`}
                    /*
                      The glyph is small; the target is not. A 22x16 hit area
                      measured on a 375px viewport is not reliably tappable, so
                      the button carries a 44px minimum in both directions with
                      the mark centred inside it.
                    */
                    className="ml-1 -my-1.5 -mr-2 inline-flex items-center justify-center rounded text-base leading-none disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: "var(--text-dim)", minWidth: 44, minHeight: 44 }}
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-xs font-bold mb-2" style={{ color: "var(--text-dim)" }}>
            Add a fund
          </legend>
          <div className="flex flex-wrap gap-2">
            {IDENTITIES.filter((f) => !symbols.includes(f.symbol)).map((identity) => (
              <button
                key={identity.symbol}
                type="button"
                onClick={() => addFund(identity.symbol)}
                className="rounded-lg border px-3 py-1.5 text-sm transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              >
                <span className="font-mono font-bold">{identity.symbol}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  {identity.exposure}
                </span>
              </button>
            ))}
            {IDENTITIES.every((f) => symbols.includes(f.symbol)) && (
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                Every fund in this preview is already selected.
              </span>
            )}
          </div>
        </fieldset>

        {notice && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-xs rounded-md px-3 py-2"
            style={{ color: "var(--text)", backgroundColor: "var(--accent-soft)" }}
          >
            {notice}
          </p>
        )}
      </section>

      {/* --- controls -------------------------------------------------------- */}
      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <section className="rounded-xl border p-5 md:p-6" style={card} aria-labelledby="amount-heading">
          <h2 id="amount-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
            Example amount
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
            Used to illustrate the size of a price change. This is not a suggested
            investment amount.
          </p>

          <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Example amount presets">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => { setAmount(preset); setAmountError(null); setCustomAmount(""); }}
                aria-pressed={amount === preset}
                className="rounded-lg border px-4 py-2 text-sm font-mono font-bold"
                style={{
                  borderColor: amount === preset ? "var(--accent)" : "var(--border)",
                  backgroundColor: amount === preset ? "var(--accent-soft)" : "transparent",
                  color: "var(--text)",
                }}
              >
                ${preset.toLocaleString("en-US")}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="custom-amount" className="block text-xs mb-1" style={{ color: "var(--text-dim)" }}>
                Custom amount
              </label>
              <input
                id="custom-amount"
                type="text"
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCustomAmount(); } }}
                aria-describedby={amountError ? "amount-error" : undefined}
                aria-invalid={amountError ? true : undefined}
                placeholder="2,500"
                className="rounded-lg border px-3 py-2 text-sm font-mono w-32"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-inset)", color: "var(--text)" }}
              />
            </div>
            <button
              type="button"
              onClick={applyCustomAmount}
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              Apply
            </button>
            <span className="text-xs self-center" style={{ color: "var(--text-dim)" }}>
              Using ${amount.toLocaleString("en-US")}
            </span>
          </div>
          {amountError && (
            <p id="amount-error" role="alert" className="mt-2 text-xs" style={{ color: "var(--red)" }}>
              {amountError}
            </p>
          )}
        </section>

        <section className="rounded-xl border p-5 md:p-6" style={card} aria-labelledby="period-heading">
          <h2 id="period-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
            Measurement period
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
            Only periods this preview&rsquo;s stored prices actually cover can be selected.
          </p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Measurement period">
            {windows.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setWindowKey(w.key)}
                disabled={!w.enabled}
                aria-pressed={effectiveWindow === w.key}
                aria-describedby={w.enabled ? undefined : `period-${w.key}-reason`}
                className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  borderColor: effectiveWindow === w.key ? "var(--accent)" : "var(--border)",
                  backgroundColor: effectiveWindow === w.key ? "var(--accent-soft)" : "transparent",
                  color: "var(--text)",
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
          {windows.filter((w) => !w.enabled).map((w) => (
            <p key={w.key} id={`period-${w.key}-reason`} className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
              {w.label}: {w.reason}
            </p>
          ))}
        </section>
      </div>

      {/* --- chart ----------------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="chart-heading">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 id="chart-heading" className="text-lg font-bold" style={{ color: "var(--text)" }}>
            {mode === "percent" ? "Price change" : "Price-only dollar illustration"}
          </h2>
          <div className="flex gap-2" role="group" aria-label="Chart mode">
            <button
              type="button" onClick={() => setMode("percent")} aria-pressed={mode === "percent"}
              className="rounded-lg border px-3 text-xs font-semibold"
              style={{
                minHeight: 40,
                borderColor: mode === "percent" ? "var(--accent)" : "var(--border)",
                backgroundColor: mode === "percent" ? "var(--accent-soft)" : "transparent",
                color: "var(--text)",
              }}
            >
              Percentage
            </button>
            <button
              type="button" onClick={() => setMode("dollars")} aria-pressed={mode === "dollars"}
              className="rounded-lg border px-3 text-xs font-semibold"
              style={{
                minHeight: 40,
                borderColor: mode === "dollars" ? "var(--accent)" : "var(--border)",
                backgroundColor: mode === "dollars" ? "var(--accent-soft)" : "transparent",
                color: "var(--text)",
              }}
            >
              Dollar illustration
            </button>
          </div>
        </div>

        {measured && (
          <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
            Measured {measured.startDate} to {measured.endDate}
            {mode === "dollars" && ` · illustrating $${amount.toLocaleString("en-US")}`}
          </p>
        )}

        {mode === "dollars" && (
          <p
            className="text-xs md:text-sm rounded-lg px-4 py-3 mb-4 font-semibold"
            style={{ color: "var(--text)", backgroundColor: "var(--accent-soft)", border: "1px solid var(--border)" }}
          >
            Dividends, distributions, taxes, trading costs, and reinvestment are not
            included. This is not a statement of what you would have earned.
          </p>
        )}

        <ComparisonChart ranked={ranked} mode={mode} amount={amount} />

        {/* The numbers the chart encodes, always visible — reading this page
            never requires hovering a line. */}
        <div className="overflow-x-auto mt-5">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Price return by fund for the selected period, with an example-amount illustration
            </caption>
            <thead>
              <tr style={{ color: "var(--text-dim)" }}>
                <th scope="col" className="text-left font-semibold py-2 pr-3">Fund</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">Price change</th>
                <th scope="col" className="text-right font-semibold py-2 px-3">
                  ${amount.toLocaleString("en-US")} illustration
                </th>
                <th scope="col" className="text-left font-semibold py-2 pl-3">Rank</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((entry) => {
                const identity = IDENTITIES.find((f) => f.symbol === entry.symbol);
                const colorIndex = symbols.indexOf(entry.symbol);
                return (
                  <tr key={entry.symbol} style={{ borderTop: "1px solid var(--border)" }}>
                    <th scope="row" className="text-left font-normal py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: SERIES_COLORS[colorIndex % SERIES_COLORS.length] }}
                        />
                        <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{entry.symbol}</span>
                        <span className="hidden md:inline text-xs" style={{ color: "var(--text-dim)" }}>
                          {identity?.name}
                        </span>
                      </span>
                    </th>
                    <td
                      className="text-right py-2.5 px-3 font-mono font-bold"
                      style={{ color: entry.priceReturnPercent >= 0 ? "var(--green)" : "var(--red)" }}
                    >
                      {entry.priceReturnPercent >= 0 ? "+" : ""}
                      {entry.priceReturnPercent.toFixed(1)}%
                    </td>
                    <td className="text-right py-2.5 px-3 font-mono" style={{ color: "var(--text)" }}>
                      ${entry.illustrativeEndValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 pl-3 text-xs" style={{ color: "var(--text-dim)" }}>
                      {entry.isHighest ? (
                        <span
                          className="inline-block rounded px-2 py-1 font-semibold"
                          style={{ backgroundColor: "var(--accent-soft)", color: "var(--text)" }}
                        >
                          {HIGHEST_RETURN_LABEL}
                          {entry.tiedAtRank ? " (tied)" : ""}
                        </span>
                      ) : (
                        <>#{entry.rank}{entry.tiedAtRank ? " (tied)" : ""}</>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- summary ---------------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>
          What the numbers say
        </h2>
        <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          {summary.map((line) => <p key={line}>{line}</p>)}
        </div>
      </section>

      {/* --- not yet connected ------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
          Not yet connected
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          These comparisons need data sources this preview does not have. They are shown
          so the shape of the finished comparison is visible, and left explicitly empty
          rather than filled with estimates.
        </p>
        <ul className="grid sm:grid-cols-2 gap-3 list-none p-0">
          {placeholders.map((section) => (
            <li key={section.id} className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
              <div className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>{section.title}</div>
              <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>{section.description}</p>
              <div className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                {describeUnavailable(section.value.reason)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --- methodology -------------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6" style={card} aria-labelledby="method-heading">
        <h2 id="method-heading" className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>
          Methodology and limitations
        </h2>
        <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          <p>
            <strong style={{ color: "var(--text)" }}>Price return, not total return.</strong>{" "}
            Every figure is the change in a fund&rsquo;s share price between two dates.
            Dividends and distributions are not included, so a fund that pays a large
            distribution will look weaker here than a total-return measure would show.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>The measurement period.</strong>{" "}
            {measured
              ? `The current comparison measures ${measured.startDate} to ${measured.endDate}. `
              : ""}
            The start is the first trading day in the stored data on or after the period
            you selected, so the dates shown are real observations rather than a nominal
            window.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Split adjustment.</strong>{" "}
            Prices are adjusted for share splits. Checked rather than assumed:{" "}
            {METHODOLOGY.splitAdjustmentEvidence}
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Distributions are absent.</strong>{" "}
            {METHODOLOGY.dividendAdjustmentEvidence}
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>The dollar illustration.</strong>{" "}
            The example amount is multiplied by the ratio of the ending price to the
            starting price. Nothing else enters the calculation — no distributions, no
            reinvestment, no trading costs and no tax. It shows the size of a price
            move, not an outcome.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Past movement is not a forecast.</strong>{" "}
            A fund with the highest price return over one period tells you what happened
            in that period. It does not indicate what will happen next.
          </p>
          <p>
            Read more in our{" "}
            <Link href="/methodology" className="underline" style={{ color: "var(--accent)" }}>
              methodology
            </Link>{" "}
            and{" "}
            <Link href="/learn" className="underline" style={{ color: "var(--accent)" }}>
              Outfox Academy
            </Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * Multi-series chart.
 *
 * Draws shape only. Every value it encodes is also printed in the table below
 * it, so no information here is reachable exclusively by pointing at a line.
 */
function ComparisonChart({
  ranked, mode, amount,
}: {
  ranked: RankedReturn[];
  mode: ChartMode;
  amount: number;
}) {
  const width = 900;
  const height = 320;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };

  if (ranked.length === 0) {
    return (
      <div
        className="rounded-lg border p-8 text-center text-sm"
        style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
      >
        Select at least {MIN_FUNDS} funds to see a comparison.
      </div>
    );
  }

  const toValue = (percent: number) =>
    mode === "percent" ? percent : amount * (1 + percent / 100);

  const allValues = ranked.flatMap((r) => r.indexedSeries.map((p) => toValue(p.percent)));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const points = ranked[0].indexedSeries.length;

  const x = (i: number) => pad.left + (i / Math.max(points - 1, 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - min) / span) * (height - pad.top - pad.bottom);

  const ticks = [min, min + span / 2, max];
  const fmt = (v: number) =>
    mode === "percent"
      ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`
      : `$${Math.round(v).toLocaleString("en-US")}`;

  const label =
    mode === "percent"
      ? "Percentage price change over the selected period, by fund"
      : `Illustrative value of $${amount.toLocaleString("en-US")} scaled by price change, by fund`;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        style={{ minWidth: 320 }}
        role="img"
        aria-label={label}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)}
              stroke="var(--grid-color)" strokeWidth="1"
            />
            <text
              x={pad.left - 8} y={y(tick) + 4} textAnchor="end"
              fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-body)"
            >
              {fmt(tick)}
            </text>
          </g>
        ))}

        {ranked.map((entry) => {
          const colorIndex = ranked.findIndex((r) => r.symbol === entry.symbol);
          const path = entry.indexedSeries
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(toValue(p.percent)).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={entry.symbol}
              d={path}
              fill="none"
              stroke={SERIES_COLORS[colorIndex % SERIES_COLORS.length]}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          );
        })}

        <text
          x={pad.left} y={height - 8} fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-body)"
        >
          {ranked[0].startDate}
        </text>
        <text
          x={width - pad.right} y={height - 8} textAnchor="end"
          fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-body)"
        >
          {ranked[0].endDate}
        </text>
      </svg>
    </div>
  );
}
