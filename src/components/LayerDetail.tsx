"use client";

import { Layer } from "@/lib/data";
import Link from "next/link";

interface Props {
  layer: Layer;
  prices: Record<string, { price: number; change: number }>;
}

export default function LayerDetail({ layer, prices }: Props) {
  const topHoldings = layer.stocks.slice(0, 4);

  return (
    <div className="fade-in rounded-lg border p-4 md:p-6"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>{layer.name}</h3>
        <Link
          href={`/layer/${layer.slug}`}
          className="text-xs flex items-center gap-1 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          cd ./details <span>→</span>
        </Link>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>{layer.description}</p>

      <div className="rounded-md p-3 mb-4" style={{ backgroundColor: "var(--terminal-bg)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-mono mb-1" style={{ color: "var(--accent)" }}># KEY_INSIGHT</div>
        <p className="text-sm" style={{ color: "var(--text)" }}>{layer.keyInsight}</p>
      </div>

      <div className="text-xs font-mono mb-3 uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
        top_holdings [{topHoldings.length}]
      </div>

      <div className="grid grid-cols-2 gap-2">
        {topHoldings.map((stock) => {
          const quote = prices[stock.ticker];
          const price = quote?.price ?? 0;
          const change = quote?.change ?? 0;

          return (
            <div
              key={stock.ticker}
              className="rounded-md p-3 border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{stock.ticker}</span>
                <span
                  className="text-xs font-mono"
                  style={{ color: change >= 0 ? "var(--green)" : "var(--red)" }}
                >
                  {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>{stock.name}</div>
              <div className="text-sm font-mono mt-1" style={{ color: "var(--text)" }}>
                ${price.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
