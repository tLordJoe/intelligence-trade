"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllTickers } from "@/lib/data";

interface Props {
  comparedTickers: string[];
  onAddTicker: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
}

interface HistoryData {
  ticker: string;
  timestamps: number[];
  closes: number[];
}

interface ChartSeries {
  ticker: string;
  points: { timestamp: number; value: number }[];
  change: number;
}

const ETF_TICKERS = ["QQQ", "SMH", "SOXX", "VGT", "XLK", "CIBR", "HACK"];
const COLORS = ["#2563eb", "#f97316", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4", "#eab308", "#ec4899", "#6366f1", "#84cc16", "#64748b"];
const RANGE_BY_TIMEFRAME: Record<string, string> = {
  "1M": "1mo",
  "3M": "3mo",
  "6M": "6mo",
  "1Y": "1y",
  YTD: "ytd",
  ALL: "max",
};

function linePath(series: ChartSeries, minTime: number, maxTime: number, minValue: number, maxValue: number) {
  const width = 920;
  const height = 300;
  const xSpan = Math.max(maxTime - minTime, 1);
  const ySpan = Math.max(maxValue - minValue, 1);
  return series.points
    .map((point, index) => {
      const x = 58 + ((point.timestamp - minTime) / xSpan) * width;
      const y = 18 + (1 - (point.value - minValue) / ySpan) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function PerformanceChart({ comparedTickers, onAddTicker, onRemoveTicker }: Props) {
  const [timeframe, setTimeframe] = useState("1Y");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [series, setSeries] = useState<ChartSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);
  const [retryVersion, setRetryVersion] = useState(0);

  const tickers = useMemo(() => ["SPY", ...comparedTickers], [comparedTickers]);
  const availableTickers = useMemo(
    () => Array.from(new Set([...ETF_TICKERS, ...getAllTickers()])).sort(),
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailedTickers([]);

    Promise.allSettled(
      tickers.map(async (ticker) => {
        const response = await fetch(`/api/history?ticker=${ticker}&range=${RANGE_BY_TIMEFRAME[timeframe]}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(ticker);
        const data = (await response.json()) as HistoryData;
        if (data.closes.length < 2) throw new Error(ticker);
        const base = data.closes[0];
        const points = data.closes.map((close, index) => ({
          timestamp: data.timestamps[index],
          value: ((close / base) - 1) * 100,
        }));
        return { ticker, points, change: points.at(-1)?.value ?? 0 } satisfies ChartSeries;
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded: ChartSeries[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") loaded.push(result.value);
        else failed.push(tickers[index]);
      });
      setSeries(loaded);
      setFailedTickers(failed);
      setLoading(false);
    });

    return () => controller.abort();
  }, [tickers, timeframe, retryVersion]);

  const bounds = useMemo(() => {
    const points = series.flatMap((item) => item.points);
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const times = points.map((point) => point.timestamp);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = Math.max((rawMax - rawMin) * 0.1, 2);
    return {
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      minValue: rawMin - padding,
      maxValue: rawMax + padding,
    };
  }, [series]);

  const gridValues = useMemo(() => {
    if (!bounds) return [];
    return Array.from({ length: 5 }, (_, index) => bounds.maxValue - ((bounds.maxValue - bounds.minValue) * index) / 4);
  }, [bounds]);

  const addSelectedTicker = () => {
    if (!selectedTicker) return;
    onAddTicker(selectedTicker);
    setSelectedTicker("");
  };

  const timeframes = ["1M", "3M", "6M", "1Y", "YTD", "ALL"];
  const reachedLimit = comparedTickers.length >= 10;

  return (
    <section id="market-performance" className="scroll-mt-20 px-4 md:px-8 py-8">
      <div className="rounded-lg border p-4 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="kicker mb-1">Compare investments</div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Market performance</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          SPY is the benchmark. Add up to ten stocks or ETFs to compare percentage performance.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <label className="sr-only" htmlFor="comparison-ticker">Stock or ETF to compare</label>
          <select
            id="comparison-ticker"
            value={selectedTicker}
            onChange={(event) => setSelectedTicker(event.target.value)}
            disabled={reachedLimit}
            className="min-h-10 flex-1 rounded-md border px-3 text-sm"
            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <option value="">{reachedLimit ? "Maximum of ten comparisons reached" : "Choose a stock or ETF…"}</option>
            {availableTickers.filter((ticker) => ticker !== "SPY" && !comparedTickers.includes(ticker)).map((ticker) => (
              <option key={ticker} value={ticker}>{ticker}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addSelectedTicker}
            disabled={!selectedTicker || reachedLimit}
            className="min-h-10 rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add comparison
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="rounded-full border px-3 py-1.5 font-semibold" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
            SPY · benchmark
          </span>
          {comparedTickers.map((ticker) => (
            <button
              type="button"
              key={ticker}
              onClick={() => onRemoveTicker(ticker)}
              className="rounded-full border px-3 py-1.5 transition-colors hover:border-[var(--red)]"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              aria-label={`Remove ${ticker} from comparison chart`}
            >
              {ticker} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {timeframes.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setTimeframe(item)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: timeframe === item ? "var(--accent)" : "transparent",
                color: timeframe === item ? "#fff" : "var(--text-dim)",
                border: timeframe === item ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="relative min-h-[390px] rounded-lg border p-3" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center text-sm" style={{ color: "var(--text-dim)" }}>
              Loading market history…
            </div>
          )}

          {!loading && series.length === 0 && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <div>
                <p className="font-semibold" style={{ color: "var(--text)" }}>Market history is temporarily unavailable.</p>
                <button type="button" onClick={() => setRetryVersion((version) => version + 1)} className="mt-2 text-sm underline" style={{ color: "var(--accent)" }}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && bounds && series.length > 0 && (
            <>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs">
                {series.map((item, index) => (
                  <span key={item.ticker} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--text)" }}>
                    <span className="h-0.5 w-4" style={{ backgroundColor: COLORS[index] }} />
                    {item.ticker}
                    <span style={{ color: item.change >= 0 ? "var(--green)" : "var(--red)" }}>
                      {item.change >= 0 ? "+" : ""}{item.change.toFixed(1)}%
                    </span>
                  </span>
                ))}
              </div>
              <svg viewBox="0 0 1000 340" className="h-[330px] w-full" role="img" aria-label={`Percentage performance chart for ${series.map((item) => item.ticker).join(", ")}`}>
                {gridValues.map((value, index) => {
                  const y = 18 + (index / 4) * 300;
                  return (
                    <g key={value}>
                      <line x1="58" x2="978" y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
                      <text x="50" y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-dim)">{value.toFixed(0)}%</text>
                    </g>
                  );
                })}
                {bounds.minValue < 0 && bounds.maxValue > 0 && (
                  <line
                    x1="58"
                    x2="978"
                    y1={18 + (1 - (0 - bounds.minValue) / (bounds.maxValue - bounds.minValue)) * 300}
                    y2={18 + (1 - (0 - bounds.minValue) / (bounds.maxValue - bounds.minValue)) * 300}
                    stroke="var(--text-dim)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                )}
                {series.map((item, index) => (
                  <path
                    key={item.ticker}
                    d={linePath(item, bounds.minTime, bounds.maxTime, bounds.minValue, bounds.maxValue)}
                    fill="none"
                    stroke={COLORS[index]}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>
            </>
          )}
        </div>

        {failedTickers.length > 0 && series.length > 0 && (
          <p className="mt-3 text-xs" style={{ color: "var(--red)" }}>
            History could not be loaded for {failedTickers.join(", ")}; the remaining comparisons are still shown.
          </p>
        )}
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-dim)" }}>
          Percentage return from the first available market close in the selected period. Historical data via Yahoo Finance.
        </p>
      </div>
    </section>
  );
}
