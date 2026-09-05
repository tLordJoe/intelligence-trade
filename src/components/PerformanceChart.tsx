"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { getAllTickers, layers } from "@/lib/data";
import { percentagePerformance } from "@/lib/market-data";
import { clampIndex, clientPointToSvg, nearestTimestampIndex } from "@/lib/chart-interaction";

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

interface LayerHistoryData {
  layer: string;
  timestamps: number[];
  values: number[];
}

interface ChartSeries {
  ticker: string;
  points: { timestamp: number; value: number; price: number }[];
  change: number;
  color: string;
  isLayer: boolean;
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
  const [hoveredPoint, setHoveredPoint] = useState<{ timestamp: number; activeTicker: string } | null>(null);
  const [chartMode, setChartMode] = useState<"investments" | "layers">("investments");
  const [selectedLayers, setSelectedLayers] = useState<string[]>(layers.map((layer) => layer.slug));

  const tickers = useMemo(() => ["SPY", ...comparedTickers], [comparedTickers]);
  const availableTickers = useMemo(
    () => Array.from(new Set([...ETF_TICKERS, ...getAllTickers()])).sort(),
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const requests = chartMode === "layers"
      ? selectedLayers.map((slug) => ({ id: slug, url: `/api/layer-history?layer=${slug}&range=${RANGE_BY_TIMEFRAME[timeframe]}` }))
      : tickers.map((ticker) => ({ id: ticker, url: `/api/history?ticker=${ticker}&range=${RANGE_BY_TIMEFRAME[timeframe]}` }));

    if (!requests.length) {
      return () => controller.abort();
    }
    Promise.allSettled(
      requests.map(async ({ id, url }, colorIndex) => {
        const response = await fetch(url, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(id);
        if (chartMode === "layers") {
          const data = (await response.json()) as LayerHistoryData;
          if (data.values.length < 2) throw new Error(id);
          const layer = layers.find((item) => item.slug === id)!;
          const points = data.values.map((value, index) => ({
            timestamp: data.timestamps[index],
            value,
            price: Number.NaN,
          }));
          return { ticker: layer.name, points, change: points.at(-1)?.value ?? 0, color: layer.color, isLayer: true } satisfies ChartSeries;
        }
        const data = (await response.json()) as HistoryData;
        if (data.closes.length < 2) throw new Error(id);
        const base = data.closes[0];
        const points = data.closes.map((close, index) => ({
          timestamp: data.timestamps[index],
          value: percentagePerformance(base, close),
          price: close,
        }));
        return { ticker: id, points, change: points.at(-1)?.value ?? 0, color: COLORS[colorIndex], isLayer: false } satisfies ChartSeries;
      })
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded: ChartSeries[] = [];
      const failed: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") loaded.push(result.value);
        else failed.push(requests[index].id);
      });
      setSeries(loaded);
      setFailedTickers(failed);
      setLoading(false);
    });

    return () => controller.abort();
  }, [tickers, timeframe, retryVersion, chartMode, selectedLayers]);

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

  const hoverDetails = useMemo(() => {
    if (!bounds || !hoveredPoint || !series.length) return null;
    const items = series.map((item) => {
      const pointIndex = nearestTimestampIndex(
        item.points.map((point) => point.timestamp),
        hoveredPoint.timestamp
      );
      const point = item.points[pointIndex];
      return { ...point, ticker: item.ticker, color: item.color, isLayer: item.isLayer };
    });
    const active = items.find((item) => item.ticker === hoveredPoint.activeTicker) ?? items[0];
    const x = 58 + ((active.timestamp - bounds.minTime) / Math.max(bounds.maxTime - bounds.minTime, 1)) * 920;
    const y = 18 + (1 - (active.value - bounds.minValue) / Math.max(bounds.maxValue - bounds.minValue, 1)) * 300;
    return { items, active, x, y };
  }, [bounds, hoveredPoint, series]);

  const inspectAtPointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!bounds || !series.length) return;
    const point = clientPointToSvg(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    const viewX = point.x;
    const viewY = point.y;
    const ratio = Math.min(Math.max((viewX - 58) / 920, 0), 1);
    const target = bounds.minTime + ratio * (bounds.maxTime - bounds.minTime);
    const anchor = series[0];
    const anchorIndex = nearestTimestampIndex(anchor.points.map((point) => point.timestamp), target);
    const timestamp = anchor.points[anchorIndex].timestamp;
    let activeTicker = anchor.ticker;
    let closestDistance = Infinity;

    for (const item of series) {
      const index = nearestTimestampIndex(item.points.map((point) => point.timestamp), timestamp);
      const point = item.points[index];
      const pointY = 18 + (1 - (point.value - bounds.minValue) / Math.max(bounds.maxValue - bounds.minValue, 1)) * 300;
      const distance = Math.abs(pointY - viewY);
      if (distance < closestDistance) {
        closestDistance = distance;
        activeTicker = item.ticker;
      }
    }
    setHoveredPoint({ timestamp, activeTicker });
  };

  const inspectWithKeyboard = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!series.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const anchor = series[0];
    const current = hoveredPoint
      ? nearestTimestampIndex(anchor.points.map((point) => point.timestamp), hoveredPoint.timestamp)
      : anchor.points.length - 1;
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? anchor.points.length - 1
        : clampIndex(current + (event.key === "ArrowLeft" ? -1 : 1), anchor.points.length);
    setHoveredPoint({ timestamp: anchor.points[next].timestamp, activeTicker: hoveredPoint?.activeTicker ?? anchor.ticker });
  };

  const addSelectedTicker = () => {
    if (!selectedTicker) return;
    setLoading(true);
    setHoveredPoint(null);
    onAddTicker(selectedTicker);
    setSelectedTicker("");
  };

  const timeframes = ["1M", "3M", "6M", "1Y", "YTD", "ALL"];
  const reachedLimit = comparedTickers.length >= 10;

  const toggleLayer = (slug: string) => {
    setLoading(true);
    setHoveredPoint(null);
    setSelectedLayers((current) => current.includes(slug)
      ? current.filter((item) => item !== slug)
      : [...current, slug]
    );
  };

  return (
    <section id="market-performance" className="scroll-mt-20 px-4 md:px-8 py-8">
      <div className="rounded-lg border p-4 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="kicker mb-1">Compare investments</div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>Market performance</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          {chartMode === "investments"
            ? "SPY is the benchmark. Add up to ten stocks or ETFs to compare percentage performance."
            : "Toggle equal-weight indexes for each supply-chain layer on or off."}
        </p>

        <div className="mb-4 inline-flex rounded-md border p-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}>
          {(["investments", "layers"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              onClick={() => {
                setLoading(true);
                setHoveredPoint(null);
                setChartMode(mode);
              }}
              className="rounded px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: chartMode === mode ? "var(--accent)" : "transparent",
                color: chartMode === mode ? "#fff" : "var(--text-dim)",
              }}
            >
              {mode === "investments" ? "Stocks & ETFs" : "By layer"}
            </button>
          ))}
        </div>

        {chartMode === "investments" ? (
          <>
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
                  onClick={() => {
                    setLoading(true);
                    setHoveredPoint(null);
                    onRemoveTicker(ticker);
                  }}
                  className="rounded-full border px-3 py-1.5 transition-colors hover:border-[var(--red)]"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  aria-label={`Remove ${ticker} from comparison chart`}
                >
                  {ticker} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setSelectedLayers(layers.map((layer) => layer.slug));
              }}
              className="font-semibold underline"
              style={{ color: "var(--text-dim)" }}
            >
              All
            </button>
            <span style={{ color: "var(--border)" }}>|</span>
            <button type="button" onClick={() => {
              setLoading(false);
              setSeries([]);
              setFailedTickers([]);
              setSelectedLayers([]);
            }} className="font-semibold underline" style={{ color: "var(--text-dim)" }}>
              None
            </button>
            {layers.map((layer) => {
              const selected = selectedLayers.includes(layer.slug);
              return (
                <button
                  type="button"
                  key={layer.slug}
                  onClick={() => toggleLayer(layer.slug)}
                  aria-pressed={selected}
                  className="rounded-full border px-3 py-1.5 font-semibold transition-opacity"
                  style={{
                    borderColor: layer.color,
                    backgroundColor: selected ? layer.color : "transparent",
                    color: selected ? "#fff" : "var(--text-dim)",
                    opacity: selected ? 1 : 0.6,
                  }}
                >
                  {layer.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-1 mb-4">
          {timeframes.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setLoading(true);
                setHoveredPoint(null);
                setTimeframe(item);
              }}
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
                <p className="font-semibold" style={{ color: "var(--text)" }}>
                  {chartMode === "layers" && selectedLayers.length === 0
                    ? "Select one or more layers to compare."
                    : "Market history is temporarily unavailable."}
                </p>
                {!(chartMode === "layers" && selectedLayers.length === 0) && (
                  <button type="button" onClick={() => {
                    setLoading(true);
                    setRetryVersion((version) => version + 1);
                  }} className="mt-2 text-sm underline" style={{ color: "var(--accent)" }}>
                    Try again
                  </button>
                )}
              </div>
            </div>
          )}

          {!loading && bounds && series.length > 0 && (
            <>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs">
                {series.map((item) => (
                  <span key={item.ticker} className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--text)" }}>
                    <span className="h-0.5 w-4" style={{ backgroundColor: item.color }} />
                    {item.ticker}
                    <span style={{ color: item.change >= 0 ? "var(--green)" : "var(--red)" }}>
                      {item.change >= 0 ? "+" : ""}{item.change.toFixed(1)}%
                    </span>
                  </span>
                ))}
              </div>
              <svg
                viewBox="0 0 1000 340"
                className="h-[330px] w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                role="img"
                tabIndex={0}
                aria-label={`Interactive percentage performance chart for ${series.map((item) => item.ticker).join(", ")}. Move the pointer or use the left and right arrow keys to inspect dates and prices.`}
                onPointerMove={inspectAtPointer}
                onPointerLeave={() => setHoveredPoint(null)}
                onFocus={() => {
                  if (!hoveredPoint) {
                    const anchor = series[0];
                    setHoveredPoint({ timestamp: anchor.points.at(-1)!.timestamp, activeTicker: anchor.ticker });
                  }
                }}
                onBlur={() => setHoveredPoint(null)}
                onKeyDown={inspectWithKeyboard}
                style={{ touchAction: "pan-y" }}
              >
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
                {series.map((item) => (
                  <path
                    key={item.ticker}
                    d={linePath(item, bounds.minTime, bounds.maxTime, bounds.minValue, bounds.maxValue)}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {hoverDetails && (
                  <g pointerEvents="none">
                    <line x1={hoverDetails.x} x2={hoverDetails.x} y1="18" y2="318" stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="58" x2="978" y1={hoverDetails.y} y2={hoverDetails.y} stroke="var(--text-dim)" strokeWidth="1" strokeDasharray="3 4" opacity="0.75" />
                    {hoverDetails.items.map((item) => {
                      const pointY = 18 + (1 - (item.value - bounds.minValue) / Math.max(bounds.maxValue - bounds.minValue, 1)) * 300;
                      return <circle key={item.ticker} cx={hoverDetails.x} cy={pointY} r="4" fill={item.color} stroke="var(--bg)" strokeWidth="2" />;
                    })}
                    <rect x={Math.min(Math.max(hoverDetails.x - 48, 58), 880)} y="316" width="96" height="22" rx="5" fill="var(--text)" />
                    <text x={Math.min(Math.max(hoverDetails.x, 106), 928)} y="331" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--bg)">
                      {new Date(hoverDetails.active.timestamp * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
                    </text>
                    <rect x="926" y={Math.min(Math.max(hoverDetails.y - 10, 18), 298)} width="72" height="20" rx="4" fill="var(--text)" />
                    <text x="962" y={Math.min(Math.max(hoverDetails.y + 4, 32), 312)} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--bg)">
                      {hoverDetails.active.value >= 0 ? "+" : ""}{hoverDetails.active.value.toFixed(1)}%
                    </text>
                    {(() => {
                      const panelWidth = 224;
                      const panelHeight = 34 + hoverDetails.items.length * 19;
                      const panelX = hoverDetails.x > 720 ? hoverDetails.x - panelWidth - 14 : hoverDetails.x + 14;
                      const panelY = 26;
                      return (
                        <g>
                          <rect x={panelX} y={panelY} width={panelWidth} height={panelHeight} rx="7" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.97" />
                          <text x={panelX + 12} y={panelY + 20} fontSize="11" fontWeight="800" fill="var(--text)">
                            {new Date(hoverDetails.active.timestamp * 1000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                          </text>
                          {hoverDetails.items.map((item, index) => (
                            <g key={item.ticker}>
                              <circle cx={panelX + 13} cy={panelY + 38 + index * 19} r="3" fill={item.color} />
                              <text x={panelX + 22} y={panelY + 42 + index * 19} fontSize="10.5" fontWeight={item.ticker === hoverDetails.active.ticker ? "800" : "600"} fill="var(--text)">{item.ticker}</text>
                              <text x={panelX + 104} y={panelY + 42 + index * 19} fontSize="10.5" textAnchor="end" fill="var(--text)">
                                {item.isLayer ? "equal weight" : `$${item.price.toFixed(2)}`}
                              </text>
                              <text x={panelX + 212} y={panelY + 42 + index * 19} fontSize="10.5" fontWeight="700" textAnchor="end" fill={item.value >= 0 ? "var(--green)" : "var(--red)"}>{item.value >= 0 ? "+" : ""}{item.value.toFixed(1)}%</text>
                            </g>
                          ))}
                        </g>
                      );
                    })()}
                  </g>
                )}
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
          {chartMode === "layers"
            ? "Layer lines are equal-weight averages of available constituent returns. Historical data via Yahoo Finance."
            : "Percentage return from the first available market close in the selected period. Historical data via Yahoo Finance."}
        </p>
      </div>
    </section>
  );
}
