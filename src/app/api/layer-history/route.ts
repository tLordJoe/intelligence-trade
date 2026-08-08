import { NextRequest, NextResponse } from "next/server";
import { getLayerBySlug } from "@/lib/data";
import { percentagePerformance } from "@/lib/market-data";

interface YahooChartResult {
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
}

interface LayerHistory {
  layer: string;
  timestamps: number[];
  values: number[];
  constituents: number;
}

const cache = new Map<string, { data: LayerHistory; at: number }>();
const TTL = 60 * 60 * 1000;

async function fetchPerformance(ticker: string, range: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${range === "max" ? "1wk" : "1d"}`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 3600 } }
  );
  if (!response.ok) throw new Error(ticker);
  const json = await response.json();
  const result = json?.chart?.result?.[0] as YahooChartResult | undefined;
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const valid = closes.find((close): close is number => close !== null && Number.isFinite(close) && close > 0);
  if (!valid) throw new Error(ticker);

  const points = new Map<number, number>();
  closes.forEach((close, index) => {
    if (close !== null && Number.isFinite(close) && timestamps[index]) {
      points.set(timestamps[index], percentagePerformance(valid, close));
    }
  });
  return points;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("layer") ?? "";
  const range = request.nextUrl.searchParams.get("range") ?? "1y";
  const layer = getLayerBySlug(slug);
  if (!layer || !/^(1mo|3mo|6mo|1y|2y|5y|ytd|max)$/.test(range)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }

  const key = `${slug}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const tickers = [...new Set(layer.stocks.map((stock) => stock.ticker))];
  const results = await Promise.allSettled(tickers.map((ticker) => fetchPerformance(ticker, range)));
  const histories = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!histories.length) {
    return NextResponse.json({ error: "layer history unavailable" }, { status: 502 });
  }

  const totals = new Map<number, { total: number; count: number }>();
  histories.forEach((history) => {
    history.forEach((value, timestamp) => {
      const current = totals.get(timestamp) ?? { total: 0, count: 0 };
      totals.set(timestamp, { total: current.total + value, count: current.count + 1 });
    });
  });
  const entries = [...totals.entries()].sort(([a], [b]) => a - b);
  const data: LayerHistory = {
    layer: slug,
    timestamps: entries.map(([timestamp]) => timestamp),
    values: entries.map(([, value]) => value.total / value.count),
    constituents: histories.length,
  };
  cache.set(key, { data, at: Date.now() });
  return NextResponse.json(data);
}
