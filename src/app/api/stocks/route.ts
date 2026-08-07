import { NextRequest, NextResponse } from "next/server";
import { normalizeTickers, type Quote, type StockQuoteResponse } from "@/lib/market-data";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

interface QuoteResponse {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
}

const cache = new Map<string, { data: StockQuoteResponse; ts: number }>();
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const rawTickers = req.nextUrl.searchParams.get("tickers")?.split(",") || [];
  const tickers = normalizeTickers(rawTickers);
  if (!tickers.length) {
    return NextResponse.json({ error: "Provide at least one valid ticker" }, { status: 400 });
  }

  const cacheKey = tickers.sort().join(",");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const results: Record<string, Quote> = {};

  if (!FINNHUB_KEY) {
    return NextResponse.json(
      { error: "Market quotes are temporarily unavailable" },
      { status: 503 }
    );
  }

  const batchSize = 10;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const promises = batch.map(async (ticker) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) return;
        const data: QuoteResponse = await res.json();
        if (data.c) {
          results[ticker] = { price: data.c, change: data.dp };
        }
      } catch {
        // skip failed ticker
      }
    });
    await Promise.all(promises);
  }

  if (!Object.keys(results).length) {
    return NextResponse.json({ error: "Market quote provider returned no data" }, { status: 502 });
  }

  const response: StockQuoteResponse = {
    quotes: results,
    unavailable: tickers.filter((ticker) => !results[ticker]),
    meta: {
      source: "Finnhub",
      updatedAt: new Date().toISOString(),
      delay: "Quotes may be delayed",
    },
  };
  cache.set(cacheKey, { data: response, ts: Date.now() });
  return NextResponse.json(response);
}
