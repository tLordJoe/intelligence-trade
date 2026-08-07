"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAllTickers } from "@/lib/data";

interface Props {
  comparedTickers: string[];
  onAddTicker: (ticker: string) => void;
  onRemoveTicker: (ticker: string) => void;
}

const ETF_TICKERS = ["QQQ", "SMH", "SOXX", "VGT", "XLK", "CIBR", "HACK"];

const exchangeSymbols: Record<string, string> = {
  SPY: "AMEX:SPY",
  QQQ: "NASDAQ:QQQ",
  SMH: "NASDAQ:SMH",
  SOXX: "NASDAQ:SOXX",
  VGT: "AMEX:VGT",
  XLK: "AMEX:XLK",
  CIBR: "NASDAQ:CIBR",
  HACK: "AMEX:HACK",
};

function tradingViewSymbol(ticker: string) {
  return exchangeSymbols[ticker] ?? ticker;
}

export default function PerformanceChart({ comparedTickers, onAddTicker, onRemoveTicker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState("1Y");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [themeVersion, setThemeVersion] = useState(0);

  const availableTickers = useMemo(
    () => Array.from(new Set([...ETF_TICKERS, ...getAllTickers()])).sort(),
    []
  );
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeVersion((version) => version + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const host = containerRef.current;
    host.innerHTML = "";

    const renderWidget = () => {
      if (!host.isConnected || typeof (window as Window & { TradingView?: unknown }).TradingView === "undefined") return;
      // TradingView does not publish TypeScript declarations for this embedded widget.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).TradingView.widget({
        autosize: true,
        symbol: "AMEX:SPY",
        interval: timeframe === "1M" ? "60" : timeframe === "3M" ? "D" : "W",
        range: timeframe === "1Y" ? "12M" : timeframe,
        timezone: "America/New_York",
        theme: dark ? "dark" : "light",
        style: "2",
        locale: "en",
        toolbar_bg: dark ? "#141414" : "#ffffff",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: true,
        save_image: false,
        container_id: host.id,
        backgroundColor: dark ? "#141414" : "#ffffff",
        gridColor: dark ? "#2a2a2a" : "#e5e7eb",
        overrides: {
          "mainSeriesProperties.lineStyle.linewidth": 1,
          "mainSeriesProperties.lineStyle.linestyle": 0,
          "mainSeriesProperties.showPriceLine": false,
          "scalesProperties.showSeriesLastValue": false,
        },
        studies_overrides: {
          "compare.plot.linewidth": 1,
          "compare.plot.linestyle": 0,
        },
        studies: [],
        compareSymbols: comparedTickers.map((ticker) => ({
          symbol: tradingViewSymbol(ticker),
          position: "SameScale",
        })),
      });
    };

    const existingScript = document.getElementById("tradingview-widget-script") as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as Window & { TradingView?: unknown }).TradingView) renderWidget();
      else existingScript.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = "tradingview-widget-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => existingScript?.removeEventListener("load", renderWidget);
  }, [timeframe, dark, themeVersion, comparedTickers]);

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
          SPY is the benchmark. Add up to ten stocks or ETFs to see how they performed beside it.
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
          {timeframes.map((tf) => (
            <button
              type="button"
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: timeframe === tf ? "var(--accent)" : "transparent",
                color: timeframe === tf ? "#fff" : "var(--text-dim)",
                border: timeframe === tf ? "1px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        <div ref={containerRef} id="tv-market-performance-chart" className="rounded overflow-hidden" style={{ height: "390px", backgroundColor: dark ? "#141414" : "#ffffff" }} />
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-dim)" }}>
          Interactive chart by TradingView. You can also search for another primary symbol from the chart toolbar.
        </p>
      </div>
    </section>
  );
}
