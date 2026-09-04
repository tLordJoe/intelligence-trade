import { NextRequest, NextResponse } from "next/server";

import {
  isValidNewsPayload,
  normalizeNewsItems,
  type NewsItem,
} from "@/lib/news";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

/**
 * Cached per ticker, holding *normalized* items.
 *
 * Previously the raw upstream body was cached before anything checked its
 * shape, so one malformed response was served for the rest of the TTL.
 */
const newsCache = new Map<string, { data: NewsItem[]; ts: number }>();
const CACHE_TTL = 5 * 60_000;

const MAX_ITEMS = 5;
const UPSTREAM_TIMEOUT_MS = 8_000;

function payload(items: NewsItem[], updatedAtMs: number) {
  return {
    items: items.slice(0, MAX_ITEMS),
    meta: {
      source: "Finnhub",
      updatedAt: new Date(updatedAtMs).toISOString(),
      delay: "News may be delayed",
      /**
       * Says what the ticker on each item means. Finnhub returns articles under
       * the symbol that was queried; that is a provider association, not a
       * verified statement that the article concerns the company.
       */
      attribution: "provider-supplied association with the requested symbol",
    },
  };
}

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "NVDA").toUpperCase();
  if (!/^[A-Z.]{1,6}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const cached = newsCache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(payload(cached.data, cached.ts));
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json(
      { error: "News is temporarily unavailable" },
      { status: 503 }
    );
  }

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from.toISOString().split("T")[0]}&to=${now.toISOString().split("T")[0]}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }
    );
    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const body: unknown = await res.json();

    // Validated before it can reach the cache. A provider that starts
    // returning an error object or a bare string must not be stored and
    // replayed for the rest of the TTL.
    if (!isValidNewsPayload(body)) {
      throw new Error("upstream returned an unexpected shape");
    }

    const items = normalizeNewsItems(body, ticker);
    const ts = Date.now();
    newsCache.set(ticker, { data: items, ts });
    return NextResponse.json(payload(items, ts));
  } catch {
    return NextResponse.json(
      { error: "News provider is temporarily unavailable" },
      { status: 502 }
    );
  }
}
