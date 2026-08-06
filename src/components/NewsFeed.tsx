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

  useEffect(() => {
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then(setNews)
      .catch(() => {});
  }, [ticker]);

  if (!news.length) return null;

  return (
    <section className="px-4 md:px-8 py-8">
      <h2 className="text-sm font-mono mb-4" style={{ color: "var(--text-dim)" }}>
        <span style={{ color: "var(--accent)" }}>$</span> tail -f ./news
      </h2>

      <div className="space-y-2">
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
      </div>
    </section>
  );
}
