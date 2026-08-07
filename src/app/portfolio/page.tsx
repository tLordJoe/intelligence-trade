"use client";

import { useEffect, useState } from "react";
import { layers, getAllTickers } from "@/lib/data";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export default function PortfolioPage() {
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [portfolio, setPortfolio] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("portfolio");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!portfolio.length) return;
    fetch(`/api/stocks?tickers=${portfolio.join(",")}`)
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => {});
  }, [portfolio]);

  function removeTicker(ticker: string) {
    const next = portfolio.filter((t) => t !== ticker);
    setPortfolio(next);
    localStorage.setItem("portfolio", JSON.stringify(next));
  }

  function addAllFromLayer(slug: string) {
    const layer = layers.find((l) => l.slug === slug);
    if (!layer) return;
    const next = [...new Set([...portfolio, ...layer.stocks.map((s) => s.ticker)])];
    setPortfolio(next);
    localStorage.setItem("portfolio", JSON.stringify(next));
  }

  function addFullStack() {
    const all = getAllTickers();
    setPortfolio(all);
    localStorage.setItem("portfolio", JSON.stringify(all));
  }

  const totalValue = portfolio.reduce((sum, t) => sum + (prices[t]?.price || 0), 0);
  const avgChange =
    portfolio.length > 0
      ? portfolio.reduce((sum, t) => sum + (prices[t]?.change || 0), 0) / portfolio.length
      : 0;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="kicker mb-2">Watchlist</div>
          <h1 className="text-3xl font-extrabold mb-2" style={{ color: "var(--text)", letterSpacing: "-0.02em" }}>
            Your watchlist
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>
            Track your AI supply chain exposure. Saved on this device.
          </p>

          {portfolio.length === 0 ? (
            <div
              className="rounded-lg border p-8 text-center"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
                No tickers in your portfolio yet. Add stocks from the stack view or use a preset.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={addFullStack}
                  className="px-4 py-2 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  Add Full Stack ({getAllTickers().length} tickers)
                </button>
                {layers.slice(0, 5).map((l) => (
                  <button
                    key={l.slug}
                    onClick={() => addAllFromLayer(l.slug)}
                    className="px-3 py-2 rounded text-xs border"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                  >
                    + {l.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>POSITIONS</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>
                    {portfolio.length}
                  </div>
                </div>
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>TOTAL VALUE</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>
                    ${totalValue.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>AVG CHANGE</div>
                  <div
                    className="text-2xl font-bold font-mono"
                    style={{ color: avgChange >= 0 ? "var(--green)" : "var(--red)" }}
                  >
                    {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {portfolio.map((ticker) => {
                  const quote = prices[ticker];
                  const stock = layers
                    .flatMap((l) => l.stocks)
                    .find((s) => s.ticker === ticker);

                  return (
                    <div
                      key={ticker}
                      className="rounded-lg border p-3 flex items-center justify-between"
                      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
                    >
                      <div>
                        <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
                          {ticker}
                        </span>
                        <span className="text-xs ml-2" style={{ color: "var(--text-dim)" }}>
                          {stock?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm" style={{ color: "var(--text)" }}>
                          ${(quote?.price ?? 0).toFixed(2)}
                        </span>
                        <span
                          className="font-mono text-xs"
                          style={{
                            color: (quote?.change ?? 0) >= 0 ? "var(--green)" : "var(--red)",
                          }}
                        >
                          {(quote?.change ?? 0) >= 0 ? "+" : ""}
                          {(quote?.change ?? 0).toFixed(2)}%
                        </span>
                        <button
                          onClick={() => removeTicker(ticker)}
                          className="text-xs px-2 py-1 rounded border hover:bg-red-500 hover:text-white hover:border-red-500"
                          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    <SiteFooter />
    </>
  );
}
