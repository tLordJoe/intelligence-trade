#!/usr/bin/env node --experimental-strip-types
/**
 * One-time capture of daily closing prices into the repository.
 *
 * The comparison preview reads a committed dataset rather than calling a
 * provider at request time. Two reasons.
 *
 * The repository held no price history at all — `/api/history` fetches live and
 * caches in memory for an hour, persisting nothing. And a comparison page that
 * called that endpoint would have added five to ten new upstream requests per
 * view against an unofficial integration, which is exactly the production
 * dependency this stage is meant not to grow.
 *
 * A committed snapshot with recorded provenance also matches the shape a
 * licensed provider will need later: the page consumes a dataset that declares
 * its source, its coverage and its return methodology, not a vendor.
 *
 * Usage:
 *   node --experimental-strip-types scripts/snapshot-fund-prices.ts
 *   node --experimental-strip-types scripts/snapshot-fund-prices.ts --dry-run
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "lib", "fund-prices.json");

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * Symbols captured.
 *
 * The five on the comparison page by default, plus SOXX as an additional
 * semiconductor comparison. Nothing here is a recommendation or a ranking; it
 * is the set the preview can currently draw.
 */
const SYMBOLS = ["VOO", "QQQ", "XLK", "SMH", "XLU", "SOXX"] as const;

/**
 * Six years, so a five-year window is genuinely covered rather than nearly so.
 *
 * Yahoo's `range=5y` returned 4.99 years for every symbol, which would have
 * left the five-year option short of its own label.
 */
const YEARS = 6;

const MIN_INTERVAL_MS = 400;
let lastAt = 0;

async function polite(url: string): Promise<unknown> {
  const wait = Math.max(0, lastAt + MIN_INTERVAL_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

interface Captured {
  symbol: string;
  dates: string[];
  closes: number[];
}

async function capture(symbol: string, from: number, to: number): Promise<Captured> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?period1=${from}&period2=${to}&interval=1d`;
  const json = (await polite(url)) as {
    chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
  };
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length) throw new Error(`${symbol}: empty series`);

  const dates: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const close = closes[i];
    if (close === null || close === undefined || !Number.isFinite(close)) continue;
    dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
    values.push(Number(close.toFixed(4)));
  }
  return { symbol, dates, closes: values };
}

async function main(): Promise<void> {
  const now = new Date();
  const to = Math.floor(now.getTime() / 1000);
  const from = Math.floor(new Date(now.getTime() - YEARS * 365.25 * 86_400_000).getTime() / 1000);

  const series: Record<string, { dates: string[]; closes: number[] }> = {};
  for (const symbol of SYMBOLS) {
    const captured = await capture(symbol, from, to);
    series[symbol] = { dates: captured.dates, closes: captured.closes };
    const first = captured.dates[0];
    const last = captured.dates[captured.dates.length - 1];
    const years =
      (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / (365.25 * 86_400_000);
    console.log(`  ${symbol.padEnd(5)} ${first} → ${last}  ${captured.dates.length} points  ${years.toFixed(2)}y`);
  }

  const dataset = {
    schemaVersion: 1,
    capturedAt: now.toISOString(),
    provenance: {
      sourceId: "yahoo-chart-unofficial",
      sourceName: "Yahoo Finance chart endpoint (unofficial integration)",
      licensed: false,
      capturedBy: "scripts/snapshot-fund-prices.ts",
      note:
        "One-time development capture committed to the repository. The comparison " +
        "page reads this file and makes no request to any price provider.",
    },
    methodology: {
      returnBasis: "price_return",
      field: "chart.indicators.quote[0].close",
      splitAdjusted: true,
      splitAdjustmentEvidence:
        "NVIDIA's 10:1 split took effect 2024-06-10. In this field the series runs " +
        "120.89 (2024-06-07) to 121.79 (2024-06-10) with no ten-fold discontinuity, " +
        "so prior prices are restated for the split.",
      dividendAdjusted: false,
      dividendAdjustmentEvidence:
        "This field differs from the provider's dividend-adjusted series " +
        "(NVDA 2024-06-05: 122.44 here against 122.23 adjusted), so distributions " +
        "are not reflected.",
      excludes: ["dividends", "distributions", "taxes", "trading costs", "reinvestment"],
    },
    series,
  };

  if (DRY_RUN) {
    console.log("\n  Dry run — nothing written.");
    return;
  }
  writeFileSync(OUT, `${JSON.stringify(dataset)}\n`);
  console.log(`\n  Wrote ${OUT}`);
}

main().catch((error) => {
  console.error(`snapshot failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
