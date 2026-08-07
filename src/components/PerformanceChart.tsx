"use client";

import { useEffect, useRef, useState } from "react";

export default function PerformanceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState("1Y");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (typeof (window as unknown as Record<string, unknown>).TradingView === "undefined") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).TradingView.widget({
        autosize: true,
        symbol: "AMEX:SPY",
        interval: timeframe === "1M" ? "60" : timeframe === "3M" ? "D" : "W",
        timezone: "America/New_York",
        theme: dark ? "dark" : "light",
        style: "2",
        locale: "en",
        toolbar_bg: dark ? "#141414" : "#ffffff",
        enable_publishing: false,
        hide_top_toolbar: true,
        hide_legend: false,
        save_image: false,
        container_id: "tv-chart",
        backgroundColor: dark ? "#141414" : "#ffffff",
        gridColor: dark ? "#2a2a2a" : "#e5e7eb",
        studies: [],
        compareSymbols: [{ symbol: "NASDAQ:QQQ", position: "SameScale" }],
      });
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [timeframe, dark]);

  const timeframes = ["1M", "3M", "6M", "1Y", "YTD", "ALL"];

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="kicker mb-1">Benchmarks</div>
        <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>
          Market performance
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
          S&amp;P 500 (SPY) vs Nasdaq-100 (QQQ) — chart by TradingView
        </p>

        <div className="flex gap-1 mb-4">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                backgroundColor: timeframe === tf ? "var(--accent)" : "transparent",
                color: timeframe === tf ? "#fff" : "var(--text-dim)",
                border: timeframe === tf ? "none" : "1px solid var(--border)",
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        <div
          ref={containerRef}
          id="tv-chart"
          className="rounded overflow-hidden"
          style={{ height: "350px", backgroundColor: dark ? "#141414" : "#ffffff" }}
        />

        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: "var(--accent)" }} />
            SPY
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block bg-purple-400" />
            QQQ
          </span>
        </div>
      </div>
    </section>
  );
}
