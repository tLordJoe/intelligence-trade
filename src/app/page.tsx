"use client";

import { useCallback, useEffect, useState } from "react";
import { layers, getLayerBySlug } from "@/lib/data";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import StackVisualization from "@/components/StackVisualization";
import LayerDetail from "@/components/LayerDetail";
import PerformanceChart from "@/components/PerformanceChart";
import LayerCards from "@/components/LayerCards";
import StockList from "@/components/StockList";
import NewsFeed from "@/components/NewsFeed";
import CongressTrades from "@/components/CongressTrades";
import TechnicalSignals from "@/components/TechnicalSignals";

export default function Home() {
  const [activeLayer, setActiveLayer] = useState<string>("processors");
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});

  const selectedLayer = getLayerBySlug(activeLayer) || layers[4];

  const handleSelectLayer = useCallback((slug: string) => {
    setActiveLayer(slug);
  }, []);

  useEffect(() => {
    const tickers = selectedLayer.stocks.map((s) => s.ticker).join(",");
    fetch(`/api/stocks?tickers=${tickers}`)
      .then((r) => r.json())
      .then(setPrices)
      .catch(() => {});
  }, [selectedLayer]);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3">
              <StackVisualization
                activeLayer={activeLayer}
                onSelectLayer={handleSelectLayer}
              />
            </div>
            <div className="lg:col-span-2 px-4 md:px-8 py-8">
              <LayerDetail layer={selectedLayer} prices={prices} />
            </div>
          </div>

          <CongressTrades />
          <PerformanceChart />
          <TechnicalSignals />
          <LayerCards activeLayer={activeLayer} onSelectLayer={handleSelectLayer} />
          <StockList layer={selectedLayer} prices={prices} />
          <NewsFeed ticker={selectedLayer.stocks[0]?.ticker} />
        </div>

        <footer
          className="border-t py-6 mt-8 text-center text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          <p>Intelligence Trade — Tracking the means of intelligence production</p>
          <p className="mt-1">Data provided by Finnhub. Not financial advice.</p>
        </footer>
      </main>
    </>
  );
}
