"use client";

import { useEffect, useState } from "react";
import type { CongressTrade } from "@/lib/congress-types";
import { isOfficialHouseFilingUrl } from "@/lib/congress-utils";
import { filterByParty, partyBreakdown, unknownPartyDisclosure } from "@/lib/party-stats";
import { amountExplanation, formatAmount, hasAmount } from "@/lib/amounts";
import { disclosureStats } from "@/lib/disclosure-stats";

/**
 * The amount cell.
 *
 * A record with no disclosed amount is labelled, never left blank and never
 * shown as `$0`. Its badge is deliberately neutral grey: colour here encodes
 * transaction size, and an unknown amount has no size to encode.
 */
function AmountBadge({ trade }: { trade: CongressTrade }) {
  if (!hasAmount(trade)) {
    const explanation = amountExplanation(trade.amountStatus);
    return (
      <span
        className="text-xs font-mono px-2 py-0.5 rounded italic"
        style={{ color: "var(--text-dim)", backgroundColor: "var(--bg-inset)" }}
        title={explanation ?? undefined}
      >
        {formatAmount(trade)}
      </span>
    );
  }

  // Bracket by the lower bound, which is a real disclosed number, rather than
  // by stripping punctuation out of the label — that read "$2,722.50" as
  // 272250 and bracketed an ordinary trade as a large one.
  const low = trade.amountLow as number;
  let intensity = "var(--green)";
  let bg = "rgba(16, 185, 129, 0.1)";
  if (low >= 500001) {
    intensity = "#F59E0B";
    bg = "rgba(245, 158, 11, 0.1)";
  }
  if (low >= 1000001) {
    intensity = "#EF4444";
    bg = "rgba(239, 68, 68, 0.1)";
  }
  return (
    <span
      className="text-xs font-mono px-2 py-0.5 rounded"
      style={{ color: intensity, backgroundColor: bg }}
    >
      {formatAmount(trade)}
    </span>
  );
}

function partyColors(party: CongressTrade["party"]) {
  if (party === "D") return { color: "#3B82F6", bg: "rgba(59, 130, 246, 0.1)" };
  if (party === "R") return { color: "#EF4444", bg: "rgba(239, 68, 68, 0.1)" };
  // Unverified party is neutral grey — never coloured as a side.
  return { color: "var(--text-dim)", bg: "var(--bg-inset)" };
}

function PartyBadge({ party, chamber }: { party: CongressTrade["party"]; chamber: string }) {
  const { color, bg } = partyColors(party);
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
  const [matchingTotal, setMatchingTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [filter, setFilter] = useState<"all" | "D" | "R" | "unknown">("all");

  useEffect(() => {
    fetch("/api/congress?limit=12")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d) => {
        setTrades(Array.isArray(d) ? d : d.trades || []);
        setMatchingTotal(typeof d.total === "number" ? d.total : null);
        if (d.updatedAt) setUpdatedAt(d.updatedAt);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, []);

  const filtered = filterByParty(trades, filter);
  const parties = partyBreakdown(trades);
  const partyNote = unknownPartyDisclosure(parties);

  const { totalTrades, buyRatio, uniquePoliticians, uniqueTickers } = disclosureStats(filtered);

  return (
    <section className="px-4 md:px-8 py-8">
      <div
        className="rounded-lg border p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="kicker mb-1">House Disclosure Watch</div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text)" }}>
              <span>🏛️</span> Recent House Stock Disclosures
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Transactions reported by U.S. House members involving AI supply-chain stocks
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "D", "R", "unknown"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1 rounded text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    filter === f
                      ? f === "D" ? "#3B82F6" : f === "R" ? "#EF4444" : f === "unknown" ? "#6B7280" : "var(--accent)"
                      : "transparent",
                  color: filter === f ? "#fff" : "var(--text-dim)",
                  border: filter === f ? "none" : "1px solid var(--border)",
                }}
              >
                {f === "all"
                  ? `All (${parties.total})`
                  : f === "D"
                    ? `Dem (${parties.democrat})`
                    : f === "R"
                      ? `Rep (${parties.republican})`
                      : `Unverified (${parties.unknown})`}
              </button>
            ))}
          </div>
        </div>

        {partyNote && (
          <p
            className="text-[11px] mb-3 rounded-md px-3 py-2"
            style={{ color: "var(--text-dim)", backgroundColor: "var(--bg-inset)" }}
          >
            {partyNote}
          </p>
        )}

        {status === "ok" && (
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
            Showing {filtered.length} of {trades.length} loaded disclosures after party filtering.
            {matchingTotal !== null && ` ${matchingTotal} AI-supply-chain disclosures match in the archive.`}
            {" "}Statistics below describe the visible rows only.
          </p>
        )}
        {status === "ok" && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Displayed disclosures</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--text)" }}>{totalTrades}</div>
          </div>
          <div className="rounded-md p-2 border" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] uppercase" style={{ color: "var(--text-dim)" }}>Buy Ratio</div>
            <div className="text-lg font-bold font-mono" style={{ color: "var(--green)" }}>
              {buyRatio === null ? "n/a" : `${buyRatio}%`}
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
        </div>}

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
            No recent trades match this filter. House filings can appear up to 45 days after a transaction.
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
                  style={{ backgroundColor: partyColors(trade.party).color }}
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

                <AmountBadge trade={trade} />

                <div className="text-[10px] text-right shrink-0" style={{ color: "var(--text-dim)" }}>
                  <div>Traded {trade.transactionDate}</div>
                  <div>Filed {trade.filedDate}</div>
                  {isOfficialHouseFilingUrl(trade.source) && (
                    <a
                      href={trade.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                      style={{ color: "var(--accent)" }}
                    >
                      Verify filing ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            Source: Clerk of the U.S. House — official STOCK Act filings · House coverage only
            {updatedAt && ` • Updated ${new Date(updatedAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>
    </section>
  );
}
