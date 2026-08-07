"use client";

import { useEffect, useState } from "react";
import { getAllTickers } from "@/lib/data";

export default function HeroSection() {
  const [tradeCount, setTradeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/congress?limit=1&scope=all")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.total === "number") setTradeCount(d.total);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="px-4 md:px-8 pt-14 md:pt-20 pb-8 md:pb-12 text-center">
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-4xl md:text-6xl font-extrabold leading-[1.03] mb-5"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          Trade smarter than
          <br />
          <span style={{ color: "var(--accent)" }}>the people in charge.</span>
        </h1>

        <p className="text-base md:text-lg max-w-xl mx-auto mb-7" style={{ color: "var(--text-dim)" }}>
          Explore disclosed U.S. House trades involving AI supply-chain stocks,
          alongside market data for the companies that make AI possible.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-2">
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "var(--bg-inset)", color: "var(--text)" }}
          >
            🏛️ {tradeCount ?? "—"} House trades tracked
          </span>
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "var(--bg-inset)", color: "var(--text)" }}
          >
            📈 {getAllTickers().length} companies · 10 sectors
          </span>
          <span
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "var(--bg-inset)", color: "var(--text)" }}
          >
            <span style={{ color: "var(--green)" }}>●</span> Market data &amp; official House filings
          </span>
        </div>

        <p className="kicker mt-6">Financial intelligence for the rest of us</p>
      </div>
    </section>
  );
}
