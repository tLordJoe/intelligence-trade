import { NextRequest, NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  url: string;
  related: string;
  summary: string;
}

const newsCache = new Map<string, { data: NewsItem[]; ts: number }>();
const CACHE_TTL = 5 * 60_000;

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "NVDA").toUpperCase();
  if (!/^[A-Z.]{1,6}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const cached = newsCache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      items: cached.data.slice(0, 5),
      meta: { source: "Finnhub", updatedAt: new Date(cached.ts).toISOString(), delay: "News may be delayed" },
    });
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json({ error: "News is temporarily unavailable" }, { status: 503 });
  }

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data: NewsItem[] = await res.json();
    newsCache.set(ticker, { data, ts: Date.now() });
    return NextResponse.json({
      items: data.slice(0, 5),
      meta: { source: "Finnhub", updatedAt: new Date().toISOString(), delay: "News may be delayed" },
    });
  } catch {
    return NextResponse.json({ error: "News provider is temporarily unavailable" }, { status: 502 });
  }
}
