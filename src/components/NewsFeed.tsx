"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  url: string;
  related: string;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  ticker?: string;
}

export default function NewsFeed({ ticker = "NVDA" }: Props) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        setNews(data.items || []);
        setUpdatedAt(data.meta?.updatedAt || "");
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [ticker]);

  if (status === "loading") return null;

  return (
    <section className="px-4 md:px-8 py-8">
      <div className="kicker mb-1">Latest headlines</div>
      <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text)" }}>
        In the news
      </h2>

      {status === "error" && (
        <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
          Verified news is temporarily unavailable. Outfox does not substitute generated headlines.
        </div>
      )}

      {status === "ok" && <div className="space-y-2">
        {news.map((item, i) => (
          <a
            key={item.id || i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border p-3 transition-colors hover:border-[var(--accent)]"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
              {item.headline}
            </h3>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
              <span>{item.source}</span>
              <span>|</span>
              <span>{timeAgo(item.datetime)}</span>
              <span>|</span>
              <span style={{ color: "var(--accent)" }}>${item.related || ticker}</span>
            </div>
          </a>
        ))}
      </div>}
      {status === "ok" && (
        <p className="mt-3 text-[10px]" style={{ color: "var(--text-dim)" }}>
          Source: Finnhub · News may be delayed{updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleString()}` : ""}
        </p>
      )}
    </section>
  );
}
