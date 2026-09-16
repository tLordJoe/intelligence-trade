import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import DisclosureCard from "@/components/DisclosureCard";
import NewsletterSignup from "@/components/NewsletterSignup";
import CongressTrades from "@/components/CongressTrades";
import CongressChart from "@/components/CongressChart";
import liveData from "@/lib/congress-live.json";
import type { DisclosureRecord } from "@/lib/congress-schema";
import { archiveRecords, queryArchive } from "@/lib/home-discovery";
import { previewAccessFromEnv } from "@/lib/funds/access";

export const metadata: Metadata = {
  title: "Congress trading and disclosure archive",
  description: "See recent congressional stock disclosures, place reported trades in market context, and search the full Outfox House disclosure archive.",
  alternates: { canonical: "/congress" },
};

export default async function CongressPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scalar = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const archive = archiveRecords(liveData.trades as DisclosureRecord[], new Date().toISOString().slice(0, 10));
  const result = queryArchive(archive, { q: scalar("q"), ticker: scalar("ticker"), page: scalar("page") });
  function pageUrl(page: number) {
    const query = new URLSearchParams({ page: String(page) });
    if (result.q) query.set("q", result.q);
    if (result.ticker) query.set("ticker", result.ticker);
    return `/congress?${query}`;
  }
  return (
    <>
      <Navbar showCompare={previewAccessFromEnv().allowed} />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-10">
          <p className="kicker mb-3">Follow the disclosed activity</p>
          <h1 className="text-3xl md:text-5xl font-extrabold">What Congress bought—and what happened next</h1>
          <p className="text-sm leading-relaxed mt-4 max-w-3xl" style={{ color: "var(--text-dim)" }}>Start with the newest House disclosures, see when reported transactions occurred, and place them against subsequent market prices. These are delayed public disclosures—not live trades, verified personal returns, or investment recommendations.</p>

          <CongressTrades />
          <CongressChart />

          <section className="mt-10 pt-8 border-t" style={{ borderColor: "var(--border)" }} aria-labelledby="house-archive-title">
            <p className="kicker mb-3">The evidence, open to everyone</p>
            <h2 id="house-archive-title" className="text-2xl md:text-4xl font-extrabold">House disclosure archive</h2>
            <p className="text-sm leading-relaxed mt-4 max-w-2xl" style={{ color: "var(--text-dim)" }}>Search all {archive.length.toLocaleString("en-US")} available disclosures—not just AI supply-chain stocks. Newest filings appear first. Reports can include family holdings and do not reveal a member&apos;s full portfolio.</p>
            <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>Archive refreshed {liveData.updatedAt.slice(0, 10)} · House only · Not a live trading feed</p>
            {liveData.counts.scannedFilings > 0 && <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>{liveData.counts.scannedFilings} scanned reports await recovery and review. Their transactions are not included; this archive is not complete House or Congress coverage.</p>}
            <form action="/congress" className="flex flex-wrap items-end gap-3 my-7">
              <label className="flex-1 min-w-48 text-sm font-semibold">Find a filer, ticker, or company
                <input type="search" name="q" defaultValue={result.q} maxLength={100} placeholder="Try NVDA or a member's name" className="block w-full border rounded-lg px-4 py-3 mt-2 text-base font-normal" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }} />
              </label>
              {result.ticker && <input type="hidden" name="ticker" value={result.ticker} />}
              <button type="submit" className="px-5 py-3 rounded-lg min-h-11 font-semibold" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>Search</button>
              <Link href="/congress" className="inline-flex items-center min-h-11 px-3 text-sm underline">Clear filters</Link>
            </form>
            <p role="status" className="text-sm mb-5">{result.total.toLocaleString("en-US")} matching disclosures{result.ticker ? ` for ${result.ticker}` : ""} · Page {result.page} of {result.pages}</p>
            <div className="grid md:grid-cols-2 gap-4">{result.records.map((record) => <DisclosureCard key={record.id} record={record} />)}</div>
            {result.total === 0 && <p className="border rounded-xl p-6" style={{ borderColor: "var(--border)" }}>No matching disclosures in this archive. This is not a claim that no trades occurred.</p>}
            <nav aria-label="Disclosure pages" className="flex flex-wrap gap-5 items-center my-7">
              {result.page > 1 && <Link className="inline-flex items-center min-h-11 font-semibold underline" href={pageUrl(result.page - 1)}>← Previous page</Link>}
              {result.page < result.pages && <Link className="inline-flex items-center min-h-11 font-semibold underline" href={pageUrl(result.page + 1)}>Next page →</Link>}
            </nav>
            <NewsletterSignup />
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
