import { NextRequest, NextResponse } from "next/server";

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

const cache = new Map<string, { data: Record<string, { price: number; change: number }>; ts: number }>();
const CACHE_TTL = 60_000;

export async function GET(req: NextRequest) {
  const tickers = req.nextUrl.searchParams.get("tickers")?.split(",") || [];
  if (!tickers.length) return NextResponse.json({});

  const cacheKey = tickers.sort().join(",");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const results: Record<string, { price: number; change: number }> = {};

  if (!FINNHUB_KEY) {
    for (const t of tickers) {
      const seed = t.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const base = 50 + (seed % 400);
      const changePct = ((seed % 800) - 400) / 100;
      results[t] = { price: base, change: changePct };
    }
    return NextResponse.json(results);
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

  cache.set(cacheKey, { data: results, ts: Date.now() });
  return NextResponse.json(results);
}
