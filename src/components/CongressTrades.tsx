"use client";

import { useEffect, useState } from "react";
import type { CongressTrade } from "@/lib/congress-data";

function AmountBadge({ amount }: { amount: string }) {
  const num = parseInt(amount.replace(/[^0-9]/g, ""));
  let intensity = "var(--green)";
  let bg = "rgba(16, 185, 129, 0.1)";
  if (num >= 500001) {
    intensity = "#F59E0B";
    bg = "rgba(245, 158, 11, 0.1)";
  }
  if (num >= 1000001) {
    intensity = "#EF4444";
    bg = "rgba(239, 68, 68, 0.1)";
  }
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded"
      style={{ color: intensity, backgroundColor: bg }}
    >
      {amount}
    </span>
  );
}

function PartyBadge({ party, chamber }: { party: "D" | "R"; chamber: string }) {
  const color = party === "D" ? "#3B82F6" : "#EF4444";
  const bg = party === "D" ? "rgba(59, 130, 246, 0.1)" : "rgba(239, 68, 68, 0.1)";
  return (
    <div className="flex items-center gap-1">
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
        style={{ color, backgroundColor: bg }}
      >
        {party}
      </span>
      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
        {chamber}
      </span>
    </div>
  );
}

export default function CongressTrades() {
  const [trades, setTrades] = useState<CongressTrade[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [filter, setFilter] = useState<"all" | "D" | "R">("all");

  useEffect(() => {
    fetch("/api/congress?limit=12")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setTrades(Array.isArray(d) ? d : d.trades || []);
        if (d.updatedAt) setUpdatedAt(d.updatedAt);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const filtered = filter === "all" ? trades : trades.filter((t) => t.party === filter);

  const buyCount = trades.filter((t) => t.type === "Buy").length;
  const totalTrades = trades.length;
  const uniquePoliticians = new Set(trades.map((t) => t.politician)).size;
  const uniqueTickers = new Set(trades.map((t) => t.ticker)).size;

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="kicker mb-1">Congress Watch</div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
              <span>🏛️</span> Congress Is Buying
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Recent trades by U.S. Congress members in AI supply chain stocks
            </p>
          </div>
          <div className="flex gap-1">
            {(["all", "D", "R"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    filter === f
                      ? f === "D" ? "#3B82F6" : f === "R" ? "#EF4444" : "var(--accent)"
                      : "transparent",
                  color: filter === f ? "#fff" : "var(--text-dim)",
                  border: filter === f ? "none" : "1px solid var(--border)",
                }}
              >
                {f === "all" ? "All" : f === "D" ? "Dem" : "Rep"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Trades (30d)</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--text)" }}>{totalTrades}</div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Buy Ratio</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--green)" }}>
              {totalTrades ? Math.round((buyCount / totalTrades) * 100) : 0}%
            </div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Politicians</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--text)" }}>{uniquePoliticians}</div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Tickers</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--text)" }}>{uniqueTickers}</div>
          </div>
        </div>

        {status === "loading" && (
          <div className="rounded-lg border p-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
            Loading congressional filings…
          </div>
        )}
        {status === "error" && (
          <div className="rounded-lg border p-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--red)" }}>
            Couldn&apos;t load trade data. Refresh the page to try again.
          </div>
        )}
        {status === "ok" && filtered.length === 0 && (
          <div className="rounded-lg border p-6 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
            No recent trades match this filter. Congress files on a delay of up to 45 days — check back soon.
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((trade) => (
            <div
              key={trade.id}
              className="rounded-lg border p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 transition-colors hover:border-[var(--accent)]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: trade.party === "D" ? "#3B82F6" : "#EF4444" }}
                >
                  {trade.politician.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>
                      {trade.politician}
                    </span>
                    <PartyBadge party={trade.party} chamber={trade.chamber} />
                    <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                      {trade.state}
                    </span>
                  </div>
                  {trade.committee && (
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--text-dim)" }}>
                      {trade.committee} Committee
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                <div
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    color: trade.type === "Buy" ? "var(--green)" : "var(--red)",
                    backgroundColor: trade.type === "Buy" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  }}
                >
                  {trade.type.toUpperCase()}
                </div>

                <div className="text-right">
                  <div className="font-bold text-sm" style={{ color: "var(--accent)" }}>
                    ${trade.ticker}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-dim)" }}>{trade.companyName}</div>
                </div>

                <AmountBadge amount={trade.amount} />

                <div className="text-xs text-right shrink-0" style={{ color: "var(--text-dim)" }}>
                  {trade.daysAgo}d ago
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            Source: Clerk of the U.S. House — official STOCK Act filings
            {updatedAt && ` • Updated ${new Date(updatedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>
    </section>
  );
}
