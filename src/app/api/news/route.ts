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

const MOCK_NEWS: NewsItem[] = [
  { id: 1, headline: "NVIDIA Earnings Beat Expectations as AI Demand Surges", source: "Reuters", datetime: Date.now() / 1000 - 3600, url: "#", related: "NVDA", summary: "" },
  { id: 2, headline: "CrowdStrike Expands AI-Powered Threat Detection Platform", source: "Bloomberg", datetime: Date.now() / 1000 - 7200, url: "#", related: "CRWD", summary: "" },
  { id: 3, headline: "TSMC Plans New Arizona Fab for Advanced AI Chips", source: "WSJ", datetime: Date.now() / 1000 - 10800, url: "#", related: "TSM", summary: "" },
  { id: 4, headline: "Microsoft Azure AI Revenue Grows 60% Year-Over-Year", source: "CNBC", datetime: Date.now() / 1000 - 14400, url: "#", related: "MSFT", summary: "" },
  { id: 5, headline: "AMD Launches Next-Gen MI400 AI Accelerator Series", source: "TechCrunch", datetime: Date.now() / 1000 - 18000, url: "#", related: "AMD", summary: "" },
];

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") || "NVDA";

  const cached = newsCache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data.slice(0, 5));
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json(MOCK_NEWS);
  }

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}&token=${FINNHUB_KEY}`
    );
    if (!res.ok) return NextResponse.json(MOCK_NEWS);
    const data: NewsItem[] = await res.json();
    newsCache.set(ticker, { data, ts: Date.now() });
    return NextResponse.json(data.slice(0, 5));
  } catch {
    return NextResponse.json(MOCK_NEWS);
  }
}
