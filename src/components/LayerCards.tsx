"use client";

import { layers } from "@/lib/data";

const LAYER_PERF: Record<string, number> = {
  "software-models": 40.7,
  "data-centers": 16.8,
  "energy-infrastructure": 56.9,
  networking: 26.3,
  processors: 41.8,
  "memory-storage": 38.7,
  foundries: 38.0,
  "semiconductor-equipment": 51.2,
  "raw-materials": 39.2,
  cybersecurity: 34.5,
};

interface Props {
  activeLayer: string | null;
  onSelectLayer: (slug: string) => void;
}

export default function LayerCards({ activeLayer, onSelectLayer }: Props) {
  return (
    <section className="px-4 md:px-8 py-8">
      <div className="kicker mb-1">Explore</div>
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        Every sector, at a glance
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {layers.map((layer) => {
          const perf = LAYER_PERF[layer.slug] ?? 0;
          const isActive = activeLayer === layer.slug;

          return (
            <button
              key={layer.slug}
              onClick={() => onSelectLayer(layer.slug)}
              className="rounded-lg border p-3 text-left transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: isActive ? "var(--bg-card-hover)" : "var(--bg-card)",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                boxShadow: isActive ? `0 0 0 1px var(--accent)` : "var(--shadow)",
              }}
            >
              <h3 className="text-xs font-semibold mb-1 truncate" style={{ color: "var(--text)" }}>
                {layer.name}
              </h3>
              {isActive && (
                <span className="text-[10px] font-mono px-1 rounded mb-1 inline-block"
                  style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
                  ACTIVE
                </span>
              )}
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                {layer.stocks.length} tickers
              </div>
              <div
                className="text-sm font-bold font-mono mt-1"
                style={{ color: perf >= 0 ? "var(--green)" : "var(--red)" }}
              >
                {perf >= 0 ? "+" : ""}{perf.toFixed(1)}%
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
