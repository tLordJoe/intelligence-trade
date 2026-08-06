import { NextRequest, NextResponse } from "next/server";
import { getTechnicalsForTicker, getAllSignals, getStrongBuys } from "@/lib/technicals";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const filter = req.nextUrl.searchParams.get("filter");

  if (ticker) {
    return NextResponse.json(getTechnicalsForTicker(ticker));
  }

  if (filter === "buys") {
    return NextResponse.json(getStrongBuys());
  }

  return NextResponse.json(getAllSignals());
}
