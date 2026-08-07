import { NextRequest, NextResponse } from "next/server";
import liveData from "@/lib/congress-live.json";
import { getAllTickers } from "@/lib/data";
import { dedupeById } from "@/lib/congress-utils";

interface LiveTrade {
  id: string;
  politician: string;
  party: string | null;
  chamber: string;
  state: string;
  district: string;
  ticker: string;
  companyName: string;
  type: string;
  amount: string;
  transactionDate: string;
  filedDate: string;
  isOptions: boolean;
  source: string;
}

function daysAgo(iso: string): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const scope = req.nextUrl.searchParams.get("scope") || "stack";
  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") || "50");
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 250) : 50;

  let trades = dedupeById(liveData.trades as LiveTrade[]).map((t) => ({
    ...t,
    party: t.party ?? "?",
    daysAgo: daysAgo(t.filedDate),
  }));

  // Default to trades in the AI-stack universe; ?scope=all returns everything
  if (scope !== "all") {
    const universe = new Set(getAllTickers());
    trades = trades.filter((t) => universe.has(t.ticker));
  }

  if (ticker) {
    trades = trades.filter((t) => t.ticker === ticker);
  }

  trades.sort(
    (a, b) =>
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
  );

  const total = trades.length;

  return NextResponse.json({
    updatedAt: liveData.updatedAt,
    source: liveData.source,
    coverage: "U.S. House of Representatives",
    limitations: "House-only coverage; filings can be delayed, amended, or corrected by the filer.",
    total,
    trades: trades.slice(0, limit),
  });
}
