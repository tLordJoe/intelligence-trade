"use client";

import { useEffect, useMemo, useState } from "react";
import { layers, getAllTickers } from "@/lib/data";

interface Props {
  activeLayer: string | null;
  onSelectLayer: (slug: string) => void;
}

export default function LayerCards({ activeLayer, onSelectLayer }: Props) {
  const [prices, setPrices] = useState<Record<string, { price: number; change: number }>>({});
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch(`/api/stocks?tickers=${getAllTickers().join(",")}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setPrices(d.quotes || {});
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const perf = useMemo(() => {
    const result: Record<string, { avg: number; n: number }> = {};
    for (const layer of layers) {
      let sum = 0;
      let n = 0;
      for (const s of layer.stocks) {
        const q = prices[s.ticker];
        if (q && q.price > 0) {
          sum += q.change;
          n++;
        }
      }
      result[layer.slug] = { avg: n ? sum / n : 0, n };
    }
    return result;
  }, [prices]);

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="kicker mb-1">Layer Performance</div>
      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text)" }}>
        Who&apos;s moving today
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
        Average daily change of the companies in each layer, from live quotes.
      </p>

      {status === "error" && (
        <div className="rounded-lg border p-6 text-center text-xs mb-2" style={{ borderColor: "var(--border)", color: "var(--red)" }}>
          Couldn&apos;t load live prices. Refresh the page to try again.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {layers.map((layer) => {
          const p = perf[layer.slug];
          const isActive = activeLayer === layer.slug;
          const hasData = status === "ok" && p.n > 0;

          return (
            <button
              key={layer.slug}
              onClick={() => onSelectLayer(layer.slug)}
              className="rounded-lg border p-3 text-left transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: isActive ? "var(--accent-soft)" : "var(--bg-card)",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                boxShadow: isActive ? `0 0 0 1px var(--accent)` : "var(--shadow)",
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: layer.color }} />
                <h3 className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                  {layer.name}
                </h3>
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                {layer.stocks.length} companies
              </div>
              <div
                className="text-sm font-bold mt-1"
                style={{
                  color: !hasData
                    ? "var(--text-dim)"
                    : p.avg >= 0
                      ? "var(--green)"
                      : "var(--red)",
                }}
              >
                {status === "loading"
                  ? "…"
                  : !hasData
                    ? "n/a"
                    : `${p.avg >= 0 ? "+" : ""}${p.avg.toFixed(2)}% today`}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
