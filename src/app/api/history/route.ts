import { NextRequest, NextResponse } from "next/server";

interface HistoryData {
  ticker: string;
  timestamps: number[];
  closes: number[];
}

const cache = new Map<string, { data: HistoryData; at: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "NVDA").toUpperCase();
  const range = req.nextUrl.searchParams.get("range") || "1y";

  if (!/^[A-Z.]{1,6}$/.test(ticker) || !/^(1mo|3mo|6mo|1y|2y|5y|ytd|max)$/.test(range)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  const key = `${ticker}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({
      ...hit.data,
      meta: {
        source: "Yahoo Finance chart endpoint (unofficial integration)",
        updatedAt: new Date(hit.at).toISOString(),
        delay: "Historical data may be delayed or adjusted",
      },
    });
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${range === "max" ? "1wk" : "1d"}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];

    const ts: number[] = [];
    const cl: number[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        ts.push(timestamps[i]);
        cl.push(Number(closes[i]!.toFixed(2)));
      }
    }
    if (!cl.length) throw new Error("empty series");

    const data: HistoryData = { ticker, timestamps: ts, closes: cl };
    cache.set(key, { data, at: Date.now() });
    return NextResponse.json({
      ...data,
      meta: {
        source: "Yahoo Finance chart endpoint (unofficial integration)",
        updatedAt: new Date().toISOString(),
        delay: "Historical data may be delayed or adjusted",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "history unavailable" },
      { status: 502 }
    );
  }
}
