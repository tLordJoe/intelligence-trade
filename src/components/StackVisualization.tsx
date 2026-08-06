"use client";

import { layers } from "@/lib/data";

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(0)}B`;
  return `$${(val / 1e6).toFixed(0)}M`;
}

const MARKET_CAPS: Record<string, number> = {
  "software-models": 10.8e12,
  "data-centers": 7.8e12,
  "energy-infrastructure": 386e9,
  networking: 1.5e12,
  processors: 10.4e12,
  "memory-storage": 575e9,
  foundries: 1.3e12,
  "semiconductor-equipment": 706e9,
  "raw-materials": 180e9,
  cybersecurity: 450e9,
};

interface Props {
  activeLayer: string | null;
  onSelectLayer: (slug: string) => void;
}

export default function StackVisualization({ activeLayer, onSelectLayer }: Props) {
  const maxCap = Math.max(...Object.values(MARKET_CAPS));

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-dim)" }}>
          <span style={{ color: "var(--accent)" }}>$</span>
          <span>render stack --market-cap</span>
        </div>

        <div className="space-y-2">
          {layers.map((layer) => {
            const cap = MARKET_CAPS[layer.slug] || 0;
            const width = Math.max((cap / maxCap) * 100, 8);
            const isActive = activeLayer === layer.slug;

            return (
              <div
                key={layer.slug}
                className="stack-bar rounded-md px-3 py-2.5 flex items-center justify-between transition-all"
                style={{
                  width: `${width}%`,
                  backgroundColor: layer.color,
                  opacity: activeLayer && !isActive ? 0.4 : 1,
                  border: isActive ? "2px solid white" : "none",
                  minWidth: "200px",
                }}
                onClick={() => onSelectLayer(layer.slug)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-xs md:text-sm uppercase tracking-wide">
                    {layer.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <span className="font-mono text-xs md:text-sm font-bold">
                    {formatMarketCap(cap)}
                  </span>
                  <span className="text-xs opacity-70">({layer.stocks.length})</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-2 md:gap-6 text-xs" style={{ color: "var(--text-dim)" }}>
          <span>bubble = subcategory</span>
          <span className="hidden md:inline">|</span>
          <span>bar width = total market cap</span>
        </div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
          click layer to inspect | hover bars for details
        </div>
      </div>
    </section>
  );
}
