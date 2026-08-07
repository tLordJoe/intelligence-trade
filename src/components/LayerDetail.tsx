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
    <div className="fade-in rounded-xl border p-4 md:p-6"
      style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-bold" style={{ color: "var(--text)" }}>{layer.name}</h3>
        <Link
          href={`/layer/${layer.slug}`}
          className="text-xs font-semibold flex items-center gap-1 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Full sector view <span>→</span>
        </Link>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>{layer.description}</p>

      <div
        className="rounded-lg p-3.5 mb-5 border-l-4"
        style={{
          backgroundColor: "var(--bg-inset)",
          borderColor: "var(--accent)",
        }}
      >
        <div className="kicker mb-1" style={{ fontSize: "0.625rem" }}>Why it matters</div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{layer.keyInsight}</p>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-dim)" }}>
        Key companies
      </div>

      <div className="grid grid-cols-2 gap-2">
        {topHoldings.map((stock) => {
          const quote = prices[stock.ticker];
          const hasPrice = quote && quote.price > 0;

          return (
            <div
              key={stock.ticker}
              className="rounded-lg p-3 border"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{stock.ticker}</span>
                {hasPrice ? (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: quote.change >= 0 ? "var(--green)" : "var(--red)" }}
                  >
                    {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>—</span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>{stock.name}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: "var(--text)" }}>
                {hasPrice ? `$${quote.price.toFixed(2)}` : "n/a"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
