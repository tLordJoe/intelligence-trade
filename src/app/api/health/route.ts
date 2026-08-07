import { NextResponse } from "next/server";
import congressData from "@/lib/congress-live.json";
import { assessHouseDataset } from "@/lib/data-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const house = assessHouseDataset(congressData.trades, congressData.updatedAt);
  const marketProviderConfigured = Boolean(process.env.FINNHUB_API_KEY);
  const status = house.status === "ok" && marketProviderConfigured ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      checkedAt: new Date().toISOString(),
      services: {
        houseDisclosures: house,
        marketQuotes: {
          status: marketProviderConfigured ? "configured" : "unavailable",
          issues: marketProviderConfigured ? [] : ["FINNHUB_API_KEY is not configured"],
        },
      },
    },
    {
      status: house.status === "error" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
