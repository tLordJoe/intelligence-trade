"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { contiguousRuns, type AlignedFrame } from "@/lib/funds/alignment";
import {
  AMOUNT_PRESETS, HIGHEST_RETURN_LABEL, MAX_FUNDS, MIN_FUNDS,
  availableWindows, buildComparison, canRemoveFund, decodeState, encodeState,
  placeholderSections, summarize, validateAmount,
  type Comparison, type WindowKey,
} from "@/lib/funds/compare";
import { COLORS, PROVENANCE, activeProvider, allIdentities, availableSymbols, getSeries } from "@/lib/funds/data";
import { basisLabel, describeBasis, describeUnavailable } from "@/lib/funds/types";

/**
 * Fund comparison preview.
 *
 * Runs on generated demonstration data. Nothing on this screen describes a real
 * fund's performance, and the label saying so is placed above the first number
 * rather than beneath the last.
 *
 * Three rules the layout enforces:
 *
 *   **Nothing is hover-only.** The chart shows shape. The readout under it and
 *   the table beside it carry every value the chart encodes, always visible,
 *   and the inspection control is a real slider that works from the keyboard.
 *
 *   **One colour per fund, for the life of the dataset.** Assigned in
 *   `data.ts` from the whole universe of symbols, so sorting the table or
 *   removing a fund cannot move a colour onto a different line.
 *
 *   **One period for everything.** Every figure is measured between the same
 *   two dates. A fund that cannot report on both is listed as excluded rather
 *   than measured over a period of its own.
 */

const SYMBOLS = availableSymbols();
const IDENTITIES = allIdentities();

type ChartMode = "percent" | "dollars";

export default function FundComparison() {
  /**
   * Opening state, read from the query string exactly once.
   *
   * Through `useSearchParams` rather than `window.location`, because the route
   * is prerendered: reading `window.location` gives the server the empty string
   * and the browser the real query, and the two then render different text.
   * `useSearchParams` makes the tree up to the nearest Suspense boundary
   * client-rendered instead, so there is nothing to mismatch. (The boundary is
   * in `app/compare/page.tsx`.)
   *
   * Held in a `useState` initialiser so later changes to the address bar — all
   * of which this component makes itself — do not feed back in and reset the
   * reader's selection.
   */
  const searchParams = useSearchParams();
  const [initial] = useState(() => decodeState(searchParams.toString(), SYMBOLS));

  const [symbols, setSymbols] = useState<string[]>(initial.symbols);
  const [amount, setAmount] = useState<number>(initial.amount);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>(initial.window);
  const [mode, setMode] = useState<ChartMode>("percent");
  const [notice, setNotice] = useState<string | null>(null);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  const isDemonstration = activeProvider.kind === "demonstration";

  const series = useMemo(() => getSeries(symbols), [symbols]);
  const windows = useMemo(() => availableWindows(series), [series]);

  /**
   * The window actually used, derived rather than stored.
   *
   * Removing a long-history fund can leave the chosen period uncovered. Falling
   * back during render — instead of correcting stored state in an effect —
   * avoids a cascading render and keeps the reader's original choice, so it
   * returns intact if they add the longer fund back.
   */
  const effectiveWindow: WindowKey = useMemo(() => {
    const chosen = windows.find((w) => w.key === windowKey);
    if (chosen?.enabled) return windowKey;
    return windows.find((w) => w.enabled)?.key ?? windowKey;
  }, [windows, windowKey]);

  const comparison: Comparison = useMemo(
    () => buildComparison(series, effectiveWindow, amount),
    [series, effectiveWindow, amount]
  );

  const methodology = series[0]?.methodology;
  const summary = useMemo(
    () =>
      comparison.status === "measured" && methodology
        ? summarize(comparison.ranked, effectiveWindow, methodology, { demonstration: isDemonstration })
        : [],
    [comparison, effectiveWindow, methodology, isDemonstration]
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
      setInspectIndex(null);
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
      setInspectIndex(null);
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

  const card = { backgroundColor: "var(--bg-card)", borderColor: "var(--border)" };
  const measured = comparison.status === "measured" ? comparison : null;

  // Default the inspected point to the last date, so the readout is populated
  // before anyone touches anything and no value lives behind a hover.
  const frame = measured?.percentFrame;
  const lastIndex = frame ? frame.dates.length - 1 : 0;
  const activeIndex = Math.min(inspectIndex ?? lastIndex, lastIndex);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="kicker mb-2">Fund comparison · Preview</div>
      <h1
        className="text-3xl md:text-5xl font-extrabold mb-4"
        style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
      >
        Fund comparison preview
      </h1>

      {/* The label goes above the first number on the page, not below the last. */}
      {isDemonstration && <DemonstrationBanner />}

      <p className="text-base md:text-lg max-w-2xl mb-8" style={{ color: "var(--text-dim)" }}>
        A preview of how Outfox will compare funds side by side. Pick {MIN_FUNDS} to{" "}
        {MAX_FUNDS} funds, choose a period, and every fund is measured between the same
        two dates. {describeBasis(methodology?.basis ?? "price_return")}
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
          {symbols.map((symbol) => {
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
                    style={{ backgroundColor: COLORS.colorFor(symbol) }}
                  />
                  <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{symbol}</span>
                  <span className="hidden sm:inline text-xs" style={{ color: "var(--text-dim)" }}>
                    {identity?.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFund(symbol)}
                    disabled={!canRemoveFund(symbols)}
                    aria-label={`Remove ${identity?.displayName ?? symbol} from the comparison`}
                    /*
                      The glyph is small; the target is not. A 22×16 hit area
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
                className="rounded-lg border px-3 py-2 text-sm text-left transition-colors"
                style={{ borderColor: "var(--border)", color: "var(--text)", minHeight: 44 }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0 mr-2 align-middle"
                  style={{ backgroundColor: COLORS.colorFor(identity.symbol) }}
                />
                <span className="font-mono font-bold">{identity.symbol}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  {identity.displayName}
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
            Used to illustrate the size of a change. This is not a suggested investment
            amount, and on demonstration data it is not an investment result either.
          </p>

          <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Example amount presets">
            {AMOUNT_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => { setAmount(preset); setAmountError(null); setCustomAmount(""); }}
                aria-pressed={amount === preset}
                className="rounded-lg border px-4 text-sm font-mono font-bold"
                style={{
                  minHeight: 44,
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
                className="rounded-lg border px-3 text-sm font-mono w-32"
                style={{ minHeight: 44, borderColor: "var(--border)", backgroundColor: "var(--bg-inset)", color: "var(--text)" }}
              />
            </div>
            <button
              type="button"
              onClick={applyCustomAmount}
              className="rounded-lg border px-4 text-sm font-semibold"
              style={{ minHeight: 44, borderColor: "var(--border)", color: "var(--text)" }}
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
            Only periods every selected fund covers can be chosen. The period is governed
            by the overlap between them, not by the longest history in the set.
          </p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Measurement period">
            {windows.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => { setWindowKey(w.key); setInspectIndex(null); }}
                disabled={!w.enabled}
                aria-pressed={effectiveWindow === w.key}
                aria-describedby={w.enabled ? undefined : `period-${w.key}-reason`}
                className="rounded-lg border px-4 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  minHeight: 44,
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
            {mode === "percent" ? "Change over the period" : "Example-amount illustration"}
          </h2>
          <div className="flex gap-2" role="group" aria-label="Chart mode">
            {(["percent", "dollars"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                aria-pressed={mode === option}
                className="rounded-lg border px-3 text-xs font-semibold"
                style={{
                  minHeight: 44,
                  borderColor: mode === option ? "var(--accent)" : "var(--border)",
                  backgroundColor: mode === option ? "var(--accent-soft)" : "transparent",
                  color: "var(--text)",
                }}
              >
                {option === "percent" ? "Percentage" : "Amount illustration"}
              </button>
            ))}
          </div>
        </div>

        {measured && (
          <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
            Every fund measured {measured.endpoints.startDate} to {measured.endpoints.endDate}
            {mode === "dollars" && ` · illustrating $${amount.toLocaleString("en-US")}`}
          </p>
        )}

        {mode === "dollars" && (
          <p
            className="text-xs md:text-sm rounded-lg px-4 py-3 mb-4 font-semibold"
            style={{ color: "var(--text)", backgroundColor: "var(--accent-soft)", border: "1px solid var(--border)" }}
          >
            Distributions, taxes, trading costs and reinvestment are not included. This is
            not a statement of what anyone would have earned
            {isDemonstration ? ", and the underlying values are generated, not observed." : "."}
          </p>
        )}

        {measured && frame ? (
          <>
            <InspectableChart
              frame={frame}
              mode={mode}
              amount={amount}
              activeIndex={activeIndex}
              onInspect={setInspectIndex}
            />

            {/* The readout is a permanent part of the page, not a hover popup:
                keyboard, touch and pointer all land in the same place. */}
            <div
              className="mt-4 rounded-lg border p-4"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-inset)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Inspecting {frame.dates[activeIndex]}
                </div>
                <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
                  <span>Move through dates</span>
                  <input
                    type="range"
                    min={0}
                    max={lastIndex}
                    step={1}
                    value={activeIndex}
                    onChange={(e) => setInspectIndex(Number(e.target.value))}
                    aria-label="Inspect a date on the chart"
                    aria-valuetext={`${frame.dates[activeIndex]}`}
                    className="w-40 md:w-64"
                    style={{ minHeight: 44 }}
                  />
                </label>
              </div>
              <div role="status" aria-live="polite" className="flex flex-wrap gap-x-5 gap-y-2">
                {frame.columns.map((column) => {
                  const value = column.values[activeIndex];
                  return (
                    <span key={column.symbol} className="inline-flex items-center gap-2 text-sm">
                      <span
                        aria-hidden="true"
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS.colorFor(column.symbol) }}
                      />
                      <span className="font-mono font-bold" style={{ color: "var(--text)" }}>
                        {column.symbol}
                      </span>
                      <span className="font-mono" style={{ color: "var(--text-dim)" }}>
                        {value === null
                          ? "no observation"
                          : mode === "percent"
                            ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
                            : `$${(amount * (1 + value / 100)).toLocaleString("en-US", {
                                minimumFractionDigits: 2, maximumFractionDigits: 2,
                              })}`}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div
            className="rounded-lg border p-8 text-center text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            {comparison.status === "unmeasurable"
              ? comparison.reason
              : `Select at least ${MIN_FUNDS} funds to see a comparison.`}
          </div>
        )}

        {measured && measured.excluded.length > 0 && (
          <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
              Not measured over this period
            </div>
            <ul className="text-xs space-y-1 list-none p-0" style={{ color: "var(--text-dim)" }}>
              {measured.excluded.map((entry) => (
                <li key={entry.symbol}>{entry.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* The numbers the chart encodes, always visible. Reading this page
            never requires pointing at a line. */}
        {measured && (
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">
                Measured change by fund between {measured.endpoints.startDate} and{" "}
                {measured.endpoints.endDate}, with an example-amount illustration
              </caption>
              <thead>
                <tr style={{ color: "var(--text-dim)" }}>
                  <th scope="col" className="text-left font-semibold py-2 pr-3">Fund</th>
                  <th scope="col" className="text-right font-semibold py-2 px-3">
                    {basisLabel(measured.basis)}
                  </th>
                  <th scope="col" className="text-right font-semibold py-2 px-3">
                    ${amount.toLocaleString("en-US")} illustration
                  </th>
                  <th scope="col" className="text-left font-semibold py-2 pl-3">Rank</th>
                </tr>
              </thead>
              <tbody>
                {measured.ranked.map((entry) => {
                  const identity = IDENTITIES.find((f) => f.symbol === entry.symbol);
                  return (
                    <tr key={entry.symbol} style={{ borderTop: "1px solid var(--border)" }}>
                      <th scope="row" className="text-left font-normal py-2.5 pr-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS.colorFor(entry.symbol) }}
                          />
                          <span className="font-mono font-bold" style={{ color: "var(--text)" }}>
                            {entry.symbol}
                          </span>
                          <span className="hidden md:inline text-xs" style={{ color: "var(--text-dim)" }}>
                            {identity?.displayName}
                          </span>
                        </span>
                      </th>
                      <td
                        className="text-right py-2.5 px-3 font-mono font-bold"
                        style={{ color: entry.changePercent >= 0 ? "var(--green)" : "var(--red)" }}
                      >
                        {entry.changePercent >= 0 ? "+" : ""}
                        {entry.changePercent.toFixed(1)}%
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono" style={{ color: "var(--text)" }}>
                        ${entry.illustrativeEndValue.toLocaleString("en-US", {
                          minimumFractionDigits: 2, maximumFractionDigits: 2,
                        })}
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
        )}
      </section>

      {/* --- summary ---------------------------------------------------------- */}
      {summary.length > 0 && (
        <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-lg font-bold mb-3" style={{ color: "var(--text)" }}>
            What the numbers say
          </h2>
          <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {summary.map((line) => <p key={line}>{line}</p>)}
          </div>
        </section>
      )}

      {/* --- fund identities --------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="identity-heading">
        <h2 id="identity-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
          What these funds actually are
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          Names and identifiers read from SEC EDGAR. A ticker names a share class, not a
          fund, and two funds can share a registrant — XLK and XLU are both series of the
          same trust, which is why the series identifier is recorded and not just the CIK.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ color: "var(--text-dim)" }}>
                <th scope="col" className="text-left font-semibold py-2 pr-3">Ticker</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Registered fund (series)</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Registrant</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">CIK</th>
                <th scope="col" className="text-left font-semibold py-2 px-3">Series</th>
                <th scope="col" className="text-left font-semibold py-2 pl-3">Class</th>
              </tr>
            </thead>
            <tbody>
              {IDENTITIES.filter((f) => symbols.includes(f.symbol)).map((identity) => (
                <tr key={identity.symbol} style={{ borderTop: "1px solid var(--border)" }}>
                  <th scope="row" className="text-left font-mono font-bold py-2.5 pr-3" style={{ color: "var(--text)" }}>
                    {identity.symbol}
                  </th>
                  <td className="py-2.5 px-3" style={{ color: "var(--text)" }}>
                    {identity.legal.seriesName}
                    <div style={{ color: "var(--text-dim)" }}>{identity.legal.exposure}</div>
                  </td>
                  <td className="py-2.5 px-3" style={{ color: "var(--text-dim)" }}>{identity.legal.registrantName}</td>
                  <td className="py-2.5 px-3 font-mono" style={{ color: "var(--text-dim)" }}>{identity.legal.cik}</td>
                  <td className="py-2.5 px-3 font-mono" style={{ color: "var(--text-dim)" }}>{identity.legal.seriesId}</td>
                  <td className="py-2.5 pl-3 font-mono" style={{ color: "var(--text-dim)" }}>
                    {identity.legal.classId}
                    <div>{identity.legal.className}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- not yet connected ------------------------------------------------- */}
      <section className="rounded-xl border p-5 md:p-6 mb-5" style={card} aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>
          Not yet connected
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          These comparisons need data this preview does not have. They are shown so the
          shape of the finished comparison is visible, and left explicitly empty rather
          than filled with estimates.
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
          {isDemonstration && (
            <p>
              <strong style={{ color: "var(--text)" }}>Where the numbers come from.</strong>{" "}
              {PROVENANCE.method} No market data is involved at any point.
            </p>
          )}
          <p>
            <strong style={{ color: "var(--text)" }}>One period, not one per fund.</strong>{" "}
            {measured
              ? `This comparison measures every fund between ${measured.endpoints.startDate} and ${measured.endpoints.endDate}. `
              : ""}
            Both dates are days on which every included fund reports. A fund measured from
            its own first available date would be measured over a different period from
            the others, and part of the difference between them would be the calendar
            rather than anything about the funds.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Observations are matched by date.</strong>{" "}
            When one fund is missing a day another has, the chart leaves a break rather
            than joining across it, and never slides later observations onto earlier days
            to close the hole.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>
              {basisLabel(methodology?.basis ?? "price_return")}, not total return.
            </strong>{" "}
            {describeBasis(methodology?.basis ?? "price_return")} A finished comparison
            should lead with total return, adjusted for splits and distributions, because
            that is the basis that answers what an investor actually received. This
            preview cannot compute it and says so rather than approximating it.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Adjustments.</strong>{" "}
            {methodology?.adjustmentEvidence}
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>The amount illustration.</strong>{" "}
            The example amount is multiplied by the ratio of the ending value to the
            starting value. Nothing else enters the calculation — no distributions, no
            reinvestment, no trading costs and no tax. It shows the size of a change, not
            an outcome.
          </p>
          <p>
            <strong style={{ color: "var(--text)" }}>Past movement is not a forecast.</strong>{" "}
            A fund with the highest change over one period tells you what happened in that
            period. It does not indicate what will happen next.
          </p>
          <p>
            Read more in our{" "}
            <Link href="/methodology" className="underline" style={{ color: "var(--accent)" }}>
              methodology
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * The demonstration label.
 *
 * Placed high, given the visual weight of a warning, and repeated in the
 * chart's accessible description — a caveat at the bottom of a long page is a
 * caveat most readers never reach.
 */
function DemonstrationBanner() {
  return (
    <div
      role="note"
      className="rounded-xl border-2 p-4 md:p-5 mb-6"
      style={{ borderColor: "var(--accent)", backgroundColor: "var(--accent-soft)" }}
    >
      <p className="text-sm md:text-base font-bold mb-1" style={{ color: "var(--text)" }}>
        Demonstration data — not actual market performance.
      </p>
      <p className="text-xs md:text-sm" style={{ color: "var(--text)" }}>
        Every value on this page was generated by Outfox from a fixed seed to show how the
        comparison works. It is not market data, it describes no real fund, and no figure
        here is a historical result or an investment outcome. Real figures arrive when a
        licensed data source is connected.
      </p>
    </div>
  );
}

/**
 * Multi-series chart with an active-date indicator.
 *
 * Positions come from the aligned frame's date axis, so series are drawn against
 * each other by date and a missing observation leaves a gap in the line instead
 * of shifting everything after it.
 *
 * Inspection is driven from outside — pointer here, slider in the parent — so
 * the chart holds no state of its own and there is exactly one active date on
 * the page.
 */
function InspectableChart({
  frame, mode, amount, activeIndex, onInspect,
}: {
  frame: AlignedFrame;
  mode: ChartMode;
  amount: number;
  activeIndex: number;
  onInspect: (index: number) => void;
}) {
  const width = 900;
  const height = 320;
  const pad = { top: 16, right: 16, bottom: 30, left: 60 };

  const toDisplay = (percent: number) => (mode === "percent" ? percent : amount * (1 + percent / 100));

  const values = frame.columns
    .flatMap((c) => c.values)
    .filter((v): v is number => v !== null)
    .map(toDisplay);

  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 1;
  const span = max - min || 1;
  const points = frame.dates.length;

  const x = (i: number) => pad.left + (i / Math.max(points - 1, 1)) * (width - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - (v - min) / span) * (height - pad.top - pad.bottom);

  const ticks = [min, min + span / 2, max];
  const fmt = (v: number) =>
    mode === "percent"
      ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`
      : `$${Math.round(v).toLocaleString("en-US")}`;

  const indexFromPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    // The SVG scales to its box, so map the client x back through the viewBox
    // before converting to an index.
    const viewX = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (viewX - pad.left) / (width - pad.left - pad.right);
    const index = Math.round(ratio * (points - 1));
    onInspect(Math.max(0, Math.min(points - 1, index)));
  };

  const activeDate = frame.dates[activeIndex];
  const activeX = x(activeIndex);
  const labelAnchor = activeX > width - 120 ? "end" : "start";

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto touch-none"
        style={{ minWidth: 320 }}
        role="img"
        aria-label={
          `Demonstration data. Generated values for ${frame.columns.length} funds between ` +
          `${frame.startDate} and ${frame.endDate}. Every value is also listed in the ` +
          `readout below the chart and in the comparison table.`
        }
        onPointerDown={indexFromPointer}
        onPointerMove={(event) => { if (event.pressure > 0 || event.pointerType === "mouse") indexFromPointer(event); }}
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

        {/* Active-date indicator, drawn under the lines so it never hides one. */}
        <line
          x1={activeX} x2={activeX} y1={pad.top} y2={height - pad.bottom}
          stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 3"
        />

        {frame.columns.map((column) => {
          const color = COLORS.colorFor(column.symbol);
          // Contiguous runs, so a missing observation leaves a break rather than
          // a straight line asserting values on days nobody reported.
          const runs = contiguousRuns(column.values.map((v) => (v === null ? null : toDisplay(v))));
          return (
            <g key={column.symbol}>
              {runs.map((run) => (
                <path
                  key={`${column.symbol}-${run[0].index}`}
                  d={run.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.index).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")}
                  fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"
                />
              ))}
            </g>
          );
        })}

        {/* A dot on each line at the active date. Absent where the fund has no
            observation, which is itself the information. */}
        {frame.columns.map((column) => {
          const value = column.values[activeIndex];
          if (value === null) return null;
          return (
            <circle
              key={`dot-${column.symbol}`}
              cx={activeX} cy={y(toDisplay(value))} r="4"
              fill={COLORS.colorFor(column.symbol)} stroke="var(--bg-card)" strokeWidth="1.5"
            />
          );
        })}

        <text
          x={labelAnchor === "end" ? activeX - 6 : activeX + 6}
          y={pad.top + 12}
          textAnchor={labelAnchor}
          fontSize="11" fontWeight="700" fill="var(--text)" fontFamily="var(--font-body)"
        >
          {activeDate}
        </text>

        <text x={pad.left} y={height - 8} fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-body)">
          {frame.dates[0]}
        </text>
        <text
          x={width - pad.right} y={height - 8} textAnchor="end"
          fontSize="11" fill="var(--text-dim)" fontFamily="var(--font-body)"
        >
          {frame.dates[frame.dates.length - 1]}
        </text>
      </svg>
    </div>
  );
}
