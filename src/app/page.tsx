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
import CongressChart from "@/components/CongressChart";
import TechnicalSignals from "@/components/TechnicalSignals";
import SiteFooter from "@/components/SiteFooter";

export default function Home() {
  const [activeLayer, setActiveLayer] = useState<string>("processors");
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});

  const selectedLayer = getLayerBySlug(activeLayer) || layers[4];
  // Hover previews a layer in the detail panel; click pins it for the whole page
  const previewLayer = getLayerBySlug(hoveredLayer ?? activeLayer) || selectedLayer;

  const handleSelectLayer = useCallback((slug: string) => {
    setActiveLayer(slug);
  }, []);

  const handleHoverLayer = useCallback((slug: string | null) => {
    setHoveredLayer(slug);
  }, []);

  useEffect(() => {
    const tickers = previewLayer.stocks.map((s) => s.ticker).join(",");
    fetch(`/api/stocks?tickers=${tickers}`)
      .then((r) => r.json())
      .then((data) => setPrices((prev) => ({ ...prev, ...data })))
      .catch(() => {});
  }, [previewLayer]);

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
                highlightLayer={hoveredLayer}
                onSelectLayer={handleSelectLayer}
                onHoverLayer={handleHoverLayer}
              />
            </div>
            <div className="lg:col-span-2 px-4 md:px-8 py-8">
              <LayerDetail layer={previewLayer} prices={prices} />
            </div>
          </div>

          <LayerCards activeLayer={activeLayer} onSelectLayer={handleSelectLayer} />
          <CongressTrades />
          <CongressChart />
          <TechnicalSignals />
          <PerformanceChart />
          <StockList layer={selectedLayer} prices={prices} />
          <NewsFeed ticker={selectedLayer.stocks[0]?.ticker} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
