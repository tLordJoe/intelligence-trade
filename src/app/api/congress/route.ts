import { NextRequest, NextResponse } from "next/server";
import { MOCK_CONGRESS_TRADES } from "@/lib/congress-data";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "10");

  let trades = MOCK_CONGRESS_TRADES;

  if (ticker) {
    trades = trades.filter((t) => t.ticker === ticker);
  }

  return NextResponse.json(trades.slice(0, limit));
}
