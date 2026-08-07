"use client";

import { useCallback, useState, useEffect } from "react";
import { Layer } from "@/lib/data";
import Link from "next/link";

interface Props {
  layer: Layer;
  prices: Record<string, { price: number; change: number }>;
  chartTickers?: string[];
  onAddToChart?: (ticker: string) => void;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function StockList({ layer, prices, chartTickers = [], onAddToChart }: Props) {
  const [portfolio, setPortfolio] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("portfolio");
    const frame = requestAnimationFrame(() => {
      if (saved) setPortfolio(JSON.parse(saved));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const addToPortfolio = useCallback((ticker: string) => {
    setPortfolio((prev) => {
      if (prev.includes(ticker)) return prev;
      const next = [...prev, ticker];
      localStorage.setItem("portfolio", JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
          {layer.name}{" "}
          <span className="text-sm font-normal" style={{ color: "var(--text-dim)" }}>
            · {layer.stocks.length} companies
          </span>
        </h2>
        <Link
          href={`/layer/${layer.slug}`}
          className="text-xs font-semibold flex items-center gap-1 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          View all <span>→</span>
        </Link>
      </div>

      <div className="space-y-2">
        {layer.stocks.map((stock) => {
          const quote = prices[stock.ticker];
          const hasPrice = !!quote && quote.price > 0;
          const price = quote?.price ?? 0;
          const change = quote?.change ?? 0;

          return (
            <div
              key={stock.ticker}
              className="rounded-lg border p-3 flex items-center gap-3 transition-colors hover:border-[var(--accent)]"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: layer.color }}
              >
                {getInitials(stock.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{stock.ticker}</span>
                  <span className="text-[10px] px-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
                    {stock.country}
                  </span>
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{stock.name}</div>
                <div className="text-xs truncate" style={{ color: "var(--text-dim)" }}>{stock.description}</div>
              </div>

              <div className="text-right shrink-0">
                {hasPrice ? (
                  <>
                    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                      ${price.toFixed(2)}
                    </div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: change >= 0 ? "var(--green)" : "var(--red)" }}
                    >
                      {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                    price n/a
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                {onAddToChart && <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onAddToChart(stock.ticker); }}
                  disabled={chartTickers.includes(stock.ticker) || chartTickers.length >= 10}
                  className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:border-[var(--accent)] disabled:cursor-default disabled:opacity-60"
                  style={{
                    borderColor: chartTickers.includes(stock.ticker) ? "var(--accent)" : "var(--border)",
                    color: chartTickers.includes(stock.ticker) ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {chartTickers.includes(stock.ticker) ? "On chart" : "Add to chart"}
                </button>}
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); addToPortfolio(stock.ticker); }}
                  disabled={portfolio.includes(stock.ticker)}
                  className="text-xs px-2.5 py-1.5 rounded border transition-colors hover:border-[var(--accent)] disabled:cursor-default"
                  style={{
                    borderColor: portfolio.includes(stock.ticker) ? "var(--accent)" : "var(--border)",
                    color: portfolio.includes(stock.ticker) ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {portfolio.includes(stock.ticker) ? "Watching" : "Add to watchlist"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
