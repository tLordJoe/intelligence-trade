"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getLayerBySlug } from "@/lib/data";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import StockList from "@/components/StockList";
import NewsFeed from "@/components/NewsFeed";
import type { DataMeta, StockQuoteResponse } from "@/lib/market-data";

export default function LayerPage() {
  const params = useParams();
  const slug = params.slug as string;
  const layer = getLayerBySlug(slug);
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [quoteMeta, setQuoteMeta] = useState<DataMeta | null>(null);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    if (!layer) return;
    const tickers = layer.stocks.map((s) => s.ticker).join(",");
    fetch(`/api/stocks?tickers=${tickers}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<StockQuoteResponse>;
      })
      .then((data) => {
        setPrices(data.quotes);
        setQuoteMeta(data.meta);
        setQuoteError(false);
      })
      .catch(() => setQuoteError(true));
  }, [layer]);

  if (!layer) {
    return (
      <>
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: "var(--text-dim)" }}>Layer not found</p>
        </main>
      </>
    );
  }

  const availableQuotes = layer.stocks.map((stock) => prices[stock.ticker]).filter(Boolean);
  const avgChange = availableQuotes.length
    ? availableQuotes.reduce((sum, quote) => sum + quote.change, 0) / availableQuotes.length
    : null;

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <div className="kicker mb-2">Sector</div>

          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: layer.color }}
            />
            <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
              {layer.name}
            </h1>
          </div>

          <p className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
            {layer.description}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div
              className="rounded-lg border p-4"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>COMPANIES</div>
              <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>
                {layer.stocks.length}
              </div>
            </div>
            <div
              className="rounded-lg border p-4"
              style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>AVG CHANGE</div>
              <div
                className="text-2xl font-bold font-mono"
                style={{ color: avgChange == null ? "var(--text-dim)" : avgChange >= 0 ? "var(--green)" : "var(--red)" }}
              >
                {avgChange == null ? "n/a" : `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`}
              </div>
            </div>
          </div>

          <div
            className="rounded-lg p-4 mb-8 border-l-4"
            style={{
              backgroundColor: "var(--bg-inset)",
              borderColor: "var(--accent)",
            }}
          >
            <div className="kicker mb-1" style={{ fontSize: "0.625rem" }}>
              Why it matters
            </div>
            <p className="text-sm" style={{ color: "var(--text)" }}>
              {layer.keyInsight}
            </p>
          </div>

          <StockList layer={layer} prices={prices} dataMeta={quoteMeta} dataUnavailable={quoteError} />
          <NewsFeed ticker={layer.stocks[0]?.ticker} />
        </div>
      </main>
    <SiteFooter />
    </>
  );
}
