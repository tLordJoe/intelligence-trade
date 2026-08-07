"use client";

import { useEffect, useMemo, useState } from "react";

interface Trade {
  id: string;
  politician: string;
  party: string;
  ticker: string;
  companyName: string;
  type: string;
  amount: string;
  transactionDate: string;
}

interface History {
  ticker: string;
  timestamps: number[];
  closes: number[];
}

const W = 820;
const H = 260;
const PAD = { top: 16, right: 56, bottom: 26, left: 14 };

export default function CongressChart() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [ticker, setTicker] = useState<string>("");
  const [history, setHistory] = useState<History | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/congress?limit=100")
      .then((r) => r.json())
      .then((d) => {
        const all: Trade[] = d.trades || [];
        setTrades(all);
        // default to the most-traded ticker
        const counts = new Map<string, number>();
        for (const t of all) counts.set(t.ticker, (counts.get(t.ticker) || 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (top) setTicker(top);
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (!ticker) return;
    fetch(`/api/history?ticker=${ticker}&range=1y`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setHistory(d);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [ticker]);

  const tickerOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of trades) counts.set(t.ticker, (counts.get(t.ticker) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [trades]);

  const tickerTrades = useMemo(
    () => trades.filter((t) => t.ticker === ticker && t.transactionDate),
    [trades, ticker]
  );

  const chart = useMemo(() => {
    if (!history || history.closes.length < 2) return null;
    const { timestamps, closes } = history;
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const span = max - min || 1;
    const x = (i: number) =>
      PAD.left + (i / (timestamps.length - 1)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

    const path = closes
      .map((c, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(c).toFixed(1)}`)
      .join(" ");

    const nearestIndex = (dateISO: string) => {
      const target = new Date(dateISO + "T12:00:00Z").getTime() / 1000;
      if (target < timestamps[0] || target > timestamps[timestamps.length - 1] + 86400) return -1;
      let best = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs(timestamps[i] - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      return best;
    };

    const last = closes[closes.length - 1];
    const markers = tickerTrades
      .map((t) => {
        const i = nearestIndex(t.transactionDate);
        if (i < 0) return null;
        const priceThen = closes[i];
        const pct = ((last - priceThen) / priceThen) * 100;
        return { trade: t, cx: x(i), cy: y(priceThen), priceThen, pct };
      })
      .filter(Boolean) as {
      trade: Trade;
      cx: number;
      cy: number;
      priceThen: number;
      pct: number;
    }[];

    return { path, min, max, last, markers, x, y };
  }, [history, tickerTrades]);

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="kicker mb-1">Trade Timing</div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              When Congress bought — and how it&apos;s going
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Each marker is a disclosed trade placed on the last 12 months of price
              action. Green = buy, red = sell.
            </p>
          </div>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="text-xs font-semibold rounded-md border px-2.5 py-2"
            style={{
              backgroundColor: "var(--bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            aria-label="Choose ticker"
          >
            {tickerOptions.map(([t, n]) => (
              <option key={t} value={t}>
                {t} · {n} trade{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        {status === "loading" && (
          <div
            className="rounded-lg border p-10 text-center text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            Loading price history…
          </div>
        )}
        {status === "error" && (
          <div
            className="rounded-lg border p-10 text-center text-xs"
            style={{ borderColor: "var(--border)", color: "var(--red)" }}
          >
            Price history is temporarily unavailable for {ticker || "this ticker"}.
          </div>
        )}

        {status === "ok" && chart && (
          <>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full"
                style={{ minWidth: "560px" }}
                role="img"
                aria-label={`${ticker} price with congressional trade markers`}
              >
                {/* price line */}
                <path d={chart.path} fill="none" stroke="var(--accent)" strokeWidth="2" />
                {/* last price label */}
                <text
                  x={W - PAD.right + 6}
                  y={chart.y(chart.last) + 4}
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--text)"
                >
                  ${chart.last.toFixed(0)}
                </text>
                {/* min/max labels */}
                <text x={W - PAD.right + 6} y={PAD.top + 8} fontSize="10" fill="var(--text-dim)">
                  ${chart.max.toFixed(0)}
                </text>
                <text x={W - PAD.right + 6} y={H - PAD.bottom} fontSize="10" fill="var(--text-dim)">
                  ${chart.min.toFixed(0)}
                </text>

                {/* trade markers */}
                {chart.markers.map((m) => {
                  const isBuy = m.trade.type === "Buy";
                  return (
                    <g
                      key={m.trade.id}
                      onMouseEnter={() => setHovered(m.trade.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <line
                        x1={m.cx}
                        y1={m.cy}
                        x2={m.cx}
                        y2={H - PAD.bottom}
                        stroke={isBuy ? "var(--green)" : "var(--red)"}
                        strokeWidth="1"
                        strokeDasharray="2 3"
                        opacity="0.5"
                      />
                      <circle
                        cx={m.cx}
                        cy={m.cy}
                        r={hovered === m.trade.id ? 7 : 5}
                        fill={isBuy ? "var(--green)" : "var(--red)"}
                        stroke="var(--bg-card)"
                        strokeWidth="1.5"
                      />
                      <title>
                        {`${m.trade.politician} (${m.trade.party}) ${isBuy ? "bought" : "sold"} ${m.trade.ticker} on ${m.trade.transactionDate} at ~$${m.priceThen.toFixed(2)} · since then: ${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}%`}
                      </title>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* trade scorecard */}
            <div className="mt-4 space-y-1.5">
              {chart.markers
                .slice()
                .sort((a, b) => b.trade.transactionDate.localeCompare(a.trade.transactionDate))
                .map((m) => {
                  const isBuy = m.trade.type === "Buy";
                  // for buys, gain = price up; for sells, "avoided" = price down
                  const wins = isBuy ? m.pct >= 0 : m.pct <= 0;
                  return (
                    <div
                      key={m.trade.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-xs"
                      style={{
                        borderColor: hovered === m.trade.id ? "var(--accent)" : "var(--border)",
                        backgroundColor: hovered === m.trade.id ? "var(--accent-soft)" : "transparent",
                      }}
                      onMouseEnter={() => setHovered(m.trade.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span
                        className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          color: "#fff",
                          backgroundColor: isBuy ? "var(--green)" : "var(--red)",
                        }}
                      >
                        {isBuy ? "BUY" : "SELL"}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>
                        {m.trade.politician}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>{m.trade.transactionDate}</span>
                      <span style={{ color: "var(--text-dim)" }}>~${m.priceThen.toFixed(2)} → ${chart.last.toFixed(2)}</span>
                      <span
                        className="font-bold ml-auto"
                        style={{ color: wins ? "var(--green)" : "var(--red)" }}
                      >
                        {isBuy
                          ? `${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}% since buy`
                          : `${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}% since sell`}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}>{m.trade.amount}</span>
                    </div>
                  );
                })}
              {chart.markers.length === 0 && (
                <div className="text-xs p-3 text-center" style={{ color: "var(--text-dim)" }}>
                  No disclosed trades for {ticker} fall inside the last 12 months of price data.
                </div>
              )}
            </div>

            <p className="mt-3 text-[10px]" style={{ color: "var(--text-dim)" }}>
              Trade prices are approximated from the daily close on the disclosed
              transaction date. Amount ranges are as filed under the STOCK Act.
              Price history via Yahoo Finance.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
