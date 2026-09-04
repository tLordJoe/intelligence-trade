"use client";

import { useEffect, useRef, useState } from "react";

import { formatElapsed, parseApiNewsItems, type NewsItem } from "@/lib/news";

interface Props {
  ticker?: string;
}

type Status = "loading" | "ok" | "empty" | "error";

export default function NewsFeed({ ticker = "NVDA" }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [updatedAt, setUpdatedAt] = useState("");

  /**
   * Which ticker the newest request was for.
   *
   * `AbortController` stops an in-flight request, but a response that has
   * already resolved can still land after a newer one. Comparing against this
   * ref before setting state closes that window, so a slow NVDA response can
   * never overwrite a fast CRWD one.
   */
  const latestRequest = useRef(ticker);

  /**
   * Clear the previous company's headlines the moment the ticker changes.
   *
   * Done during render rather than in the effect. Leaving the old articles on
   * screen while the new request is in flight presented one company's news as
   * another's, which is the defect this component is being repaired for — but
   * resetting inside the effect body triggers a cascading render and is what
   * `react-hooks/set-state-in-effect` exists to prevent. Adjusting state during
   * render on a prop change is React's documented alternative, and it clears
   * the stale items a render earlier than the effect would.
   */
  const [renderedTicker, setRenderedTicker] = useState(ticker);
  if (ticker !== renderedTicker) {
    setRenderedTicker(ticker);
    setNews([]);
    setUpdatedAt("");
    setStatus("loading");
  }

  useEffect(() => {
    const controller = new AbortController();
    latestRequest.current = ticker;

    fetch(`/api/news?ticker=${encodeURIComponent(ticker)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (controller.signal.aborted || latestRequest.current !== ticker) return;

        // "The provider had no news" and "we could not read the response" are
        // different facts and must not share a message. Only a genuine empty
        // list is reported as empty; anything unreadable is a failure.
        if (!Array.isArray(data?.items)) {
          setStatus("error");
          return;
        }

        // The route has already resolved attribution; validate its shape,
        // never re-derive it (see parseApiNewsItems).
        const items = parseApiNewsItems(data.items);
        setNews(items);
        setUpdatedAt(typeof data?.meta?.updatedAt === "string" ? data.meta.updatedAt : "");
        setStatus(items.length > 0 ? "ok" : "empty");
      })
      .catch((error) => {
        if (controller.signal.aborted || (error as Error)?.name === "AbortError") return;
        if (latestRequest.current !== ticker) return;
        setStatus("error");
      });

    return () => controller.abort();
  }, [ticker]);

  const frameStyle = {
    borderColor: "var(--border)",
    color: "var(--text-dim)",
  };

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="kicker mb-1">Latest headlines</div>
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        In the news
      </h2>

      {status === "loading" && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={frameStyle}
          role="status"
          aria-live="polite"
        >
          Loading headlines for {ticker}…
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-lg border p-4 text-sm" style={frameStyle}>
          No recent headlines for {ticker} from our news provider.
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border p-4 text-sm" style={frameStyle} role="status">
          Headlines are temporarily unavailable. Outfox does not substitute
          generated headlines.
        </div>
      )}

      {status === "ok" && (
        <div className="space-y-2">
          {news.map((item) => {
            const elapsed = formatElapsed(item.datetime);
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border p-3 transition-colors hover:border-[var(--accent)]"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                  {item.headline}
                </h3>
                <div
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span>{item.source}</span>
                  {elapsed && (
                    <>
                      <span aria-hidden="true">|</span>
                      <span>{elapsed}</span>
                    </>
                  )}
                  {/*
                    Shown only when the provider actually associated the article
                    with this symbol. The previous version fell back to the
                    selected ticker, which invented an association the provider
                    had not made.
                  */}
                  {item.tickerAssociation && (
                    <>
                      <span aria-hidden="true">|</span>
                      <span
                        style={{ color: "var(--accent)" }}
                        title={`Returned by our news provider under ${item.tickerAssociation}. Provider association, not an Outfox relevance check.`}
                      >
                        ${item.tickerAssociation}
                      </span>
                    </>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      {(status === "ok" || status === "empty") && (
        <p className="mt-3 text-[10px]" style={{ color: "var(--text-dim)" }}>
          Source: Finnhub · News may be delayed
          {updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleString()}` : ""} ·
          Symbols show the association supplied by our news provider; Outfox does
          not independently verify that an article is about that company.
        </p>
      )}
    </section>
  );
}
