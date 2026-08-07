"use client";

import { useEffect, useState } from "react";
import type { TechnicalData } from "@/lib/technicals";
import { getSignalColor, getSignalLabel } from "@/lib/technicals";

function RSIGauge({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color = pct > 70 ? "var(--red)" : pct < 30 ? "var(--green)" : "var(--accent)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function PriceBar({ label, value, current, color }: { label: string; value: number; current: number; color: string }) {
  const diff = ((current - value) / value) * 100;
  const isAbove = current > value;
  return (
    <div className="flex items-center justify-between text-xs">
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ color: "var(--text)" }}>${value.toFixed(2)}</span>
        <span className="font-mono text-[10px]" style={{ color: isAbove ? "var(--green)" : "var(--red)" }}>
          {isAbove ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

interface Props {
  ticker?: string;
}

export default function TechnicalSignals({ ticker }: Props) {
  const [data, setData] = useState<TechnicalData[]>([]);
  const [filter, setFilter] = useState<"all" | "buys" | "sells">("buys");

  useEffect(() => {
    const url = ticker ? `/api/technicals?ticker=${ticker}` : "/api/technicals";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : [d]))
      .catch(() => {});
  }, [ticker]);

  const filtered = data.filter((t) => {
    if (filter === "buys") return t.signal === "STRONG_BUY" || t.signal === "BUY";
    if (filter === "sells") return t.signal === "SELL" || t.signal === "STRONG_SELL";
    return true;
  });

  const buyCount = data.filter((t) => t.signal === "STRONG_BUY" || t.signal === "BUY").length;
  const sellCount = data.filter((t) => t.signal === "SELL" || t.signal === "STRONG_SELL").length;
  const neutralCount = data.filter((t) => t.signal === "NEUTRAL").length;

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="rounded-lg border p-4 md:p-6" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="kicker mb-1">Signals</div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
              <span>📊</span> Technical Signals
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Moving averages, RSI, MACD, and price targets for AI stack stocks
            </p>
          </div>
          <div className="flex gap-1">
            {(["buys", "all", "sells"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor: filter === f
                    ? f === "buys" ? "var(--green)" : f === "sells" ? "var(--red)" : "var(--accent)"
                    : "transparent",
                  color: filter === f ? "#fff" : "var(--text-dim)",
                  border: filter === f ? "none" : "1px solid var(--border)",
                }}
              >
                {f === "buys" ? `Buys (${buyCount})` : f === "sells" ? `Sells (${sellCount})` : `All (${data.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Buy Signals</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--green)" }}>{buyCount}</div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Neutral</div>
            <div className="text-lg font-bold font-mono" style={{ color: "#F59E0B" }}>{neutralCount}</div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Sell Signals</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--red)" }}>{sellCount}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.slice(0, 12).map((t) => (
            <div
              key={t.ticker}
              className="rounded-lg border p-3 transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base" style={{ color: "var(--text)" }}>{t.ticker}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    style={{ color: "#fff", backgroundColor: getSignalColor(t.signal) }}
                  >
                    {getSignalLabel(t.signal)}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      color: t.macdSignal === "bullish" ? "var(--green)" : t.macdSignal === "bearish" ? "var(--red)" : "#F59E0B",
                      backgroundColor: t.macdSignal === "bullish" ? "rgba(16,185,129,0.1)" : t.macdSignal === "bearish" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                    }}
                  >
                    MACD {t.macdSignal}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold" style={{ color: "var(--text)" }}>${t.price.toFixed(2)}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                    Target: <span style={{ color: "var(--accent)" }}>${t.priceTarget.toFixed(2)}</span>
                    <span className="ml-1" style={{ color: t.priceTarget > t.price ? "var(--green)" : "var(--red)" }}>
                      ({t.priceTarget > t.price ? "+" : ""}{(((t.priceTarget - t.price) / t.price) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-dim)" }}>Moving Averages</div>
                  <PriceBar label="SMA 20" value={t.sma20} current={t.price} color="var(--accent)" />
                  <PriceBar label="SMA 50" value={t.sma50} current={t.price} color="#8B5CF6" />
                  <PriceBar label="SMA 200" value={t.sma200} current={t.price} color="#F59E0B" />
                </div>
                <div>
                  <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-dim)" }}>RSI (14)</div>
                  <RSIGauge value={t.rsi} />
                  <div className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>
                    {t.rsi > 70 ? "Overbought" : t.rsi < 30 ? "Oversold" : "Normal range"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-dim)" }}>Support / Resistance</div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--green)" }}>S: ${t.support.toFixed(0)}</span>
                    <span style={{ color: "var(--red)" }}>R: ${t.resistance.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1 relative overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="absolute h-full rounded-full"
                      style={{
                        backgroundColor: "var(--accent)",
                        left: `${Math.max(0, Math.min(100, ((t.price - t.support) / (t.resistance - t.support)) * 100))}%`,
                        width: "4px",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase mb-1" style={{ color: "var(--text-dim)" }}>52-Week Range</div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-dim)" }}>${t.weekLow52.toFixed(0)}</span>
                    <span style={{ color: "var(--text-dim)" }}>${t.weekHigh52.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1 relative overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div
                      className="absolute h-full rounded-full"
                      style={{
                        backgroundColor: t.fromHigh52 > -10 ? "var(--green)" : t.fromHigh52 > -25 ? "#F59E0B" : "var(--red)",
                        left: `${Math.max(0, Math.min(100, ((t.price - t.weekLow52) / (t.weekHigh52 - t.weekLow52)) * 100))}%`,
                        width: "4px",
                      }}
                    />
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {t.fromHigh52.toFixed(1)}% from 52w high
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-2 pt-2 border-t text-[10px]" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
                <span>Vol 24h: {t.volume24h}</span>
                <span>Avg Vol: {t.avgVolume}</span>
                <span>Target Source: {t.priceTargetSource}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
