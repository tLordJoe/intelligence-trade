import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Layers3 } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import NewsletterSignup from "@/components/NewsletterSignup";
import DisclosureCard from "@/components/DisclosureCard";
import liveData from "@/lib/congress-live.json";
import type { DisclosureRecord } from "@/lib/congress-schema";
import { buildHomeDiscovery, displayFiler } from "@/lib/home-discovery";
import { previewAccessFromEnv } from "@/lib/funds/access";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Outfox — Financial intelligence for the rest of us",
  description: "See what U.S. House members disclosed buying, inspect original filings, and explore patterns across distinct filers. Financial intelligence for the rest of us.",
  alternates: { canonical: "/" },
  openGraph: { title: "Outfox — Trade smarter than the people in charge.", description: "Follow disclosed purchases. Inspect the evidence. Explore the bigger story.", url: "/" },
};

export default function Home() {
  const discovery = buildHomeDiscovery(liveData.trades as DisclosureRecord[], liveData.updatedAt, new Date().toISOString().slice(0, 10));
  return <>
    <Navbar showCompare={previewAccessFromEnv().allowed} />
    <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8">
      <section className="pt-12 md:pt-20 pb-10 md:pb-12">
        <p className="kicker mb-4">Financial intelligence for the rest of us</p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-[1.03] max-w-4xl" style={{ letterSpacing: "-0.035em" }}>
          Trade smarter than<br /><span style={{ color: "var(--accent)" }}>the people in charge.</span>
        </h1>
        <p className="max-w-2xl text-base md:text-lg leading-relaxed mt-6" style={{ color: "var(--text-dim)" }}>
          They have access. You deserve visibility. See what House members disclosed buying,
          spot the connections, and inspect the evidence for yourself.
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-7">
          <a href="#disclosed-purchases" className="inline-flex gap-3 items-center rounded-lg px-5 py-3 font-bold min-h-11" style={{ backgroundColor: "var(--accent)", color: "#fff" }}>See who&apos;s buying <ArrowDownRight size={18} aria-hidden="true" /></a>
          <Link href="/congress" className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold">Browse all {discovery.archiveCount.toLocaleString("en-US")} disclosures <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <p className="text-xs mt-5" style={{ color: "var(--text-dim)" }}>Original House filings · Purchase and sale evidence · No invented signals</p>
      </section>
      <div className="border-y py-3 mb-9 flex flex-wrap gap-x-6 gap-y-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
        <span>Archive refreshed <time dateTime={discovery.updatedAt}>{discovery.updatedAt.slice(0, 10)}</time></span>
        <span>House-only coverage · Disclosures are delayed, not live trades</span>
        {discovery.stale && <strong role="status" style={{ color: "var(--red)" }}>Archive refresh overdue. Recent activity may be missing.</strong>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 items-start">
        <section id="disclosed-purchases" className="scroll-mt-36">
          <p className="kicker mb-2">Follow the disclosures</p><h2 className="text-2xl md:text-3xl font-bold">Who bought what?</h2>
          <p className="text-sm leading-relaxed mt-3 mb-5" style={{ color: "var(--text-dim)" }}>Latest available purchase filings, newest filed first. A member&apos;s report can include family or jointly owned holdings.</p>
          <div className="space-y-3">{discovery.recentPurchases.map((record) => <DisclosureCard key={record.id} record={record} />)}</div>
          {discovery.recentPurchases.length === 0 && <p>No eligible purchase disclosures are available in this archive.</p>}
          <Link href="/congress" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold mt-4" style={{ color: "var(--accent)" }}>Browse the full archive <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </section>
        <section aria-labelledby="clusters-heading">
          <p className="kicker mb-2">Look for connections</p><h2 id="clusters-heading" className="text-2xl md:text-3xl font-bold">Where are buys clustering?</h2>
          <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--text-dim)" }}>Stocks with purchases reported by multiple distinct named House filers. Ranked by filers—not transaction count or estimated dollars.</p>
          <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>Filed {discovery.periodStart} through {discovery.periodEnd} · 30 calendar days</p>
          <p className="text-xs mt-2 mb-5" style={{ color: "var(--text-dim)" }}>Based on readable records in our House archive—not a complete Congress leaderboard. Senate activity and unreadable filings are not included.</p>
          <div className="space-y-3">
            {discovery.clusters.map((cluster) => <details key={cluster.ticker} className="rounded-xl border px-5" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
              <summary className="cursor-pointer py-5">
                <span className="inline-flex flex-wrap items-baseline justify-between gap-3 w-[calc(100%_-_1.5rem)] align-top">
                  <span><strong className="text-xl">{cluster.ticker}</strong><span className="block text-xs mt-1 max-w-64" style={{ color: "var(--text-dim)" }}>{cluster.companyName}</span></span>
                  <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>{cluster.buyers} purchasing filers</span>
                </span>
                <span className="block text-xs mt-3" style={{ color: "var(--text-dim)" }}>{cluster.purchases} purchases · {cluster.sales} sales · {cluster.sellers} selling filers</span>
              </summary>
              <div className="border-t py-4 text-sm leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
                <p>Multiple filers reported purchases of the same stock in this filing window. That is a connection to investigate, not evidence of coordination or a forecast.</p>
                <ul className="mt-4 space-y-3">{cluster.records.slice(0, 6).map((record) => <li key={record.id}>
                  <a href={record.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" style={{ color: "var(--text)" }}>{displayFiler(record.politician)} · {record.type === "Buy" ? "Purchase" : "Sale"} ↗</a>
                  <span className="block text-xs mt-1">Traded {record.transactionDate} · Filed {record.filedDate}</span>
                </li>)}</ul>
                <Link href={`/congress?ticker=${encodeURIComponent(cluster.ticker)}`} className="inline-flex min-h-11 items-center text-sm font-semibold mt-3" style={{ color: "var(--accent)" }}>Inspect all {cluster.ticker} disclosures →</Link>
              </div>
            </details>)}
          </div>
          {discovery.clusters.length === 0 && <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)" }}>No stocks meet the two-filer threshold in this filing window. This does not mean nobody bought; the archive may not yet contain their disclosures.</div>}
          <details className="text-xs leading-relaxed mt-4" style={{ color: "var(--text-dim)" }}>
            <summary className="cursor-pointer min-h-11 py-3">What these counts include</summary>
            <p>All archived House tickers are considered, not just the AI stack. Options, exchanges, quarantined records, unverified tickers, ambiguous issuers, future dates, and duplicate records are excluded. Filer names are scoped to their chamber and district, with explicitly reviewed name aliases combined; these are not official person IDs. Each filer counts once per ticker and direction; family holdings are not independent buyers. Dates refer to filing, not a claim that these trades happened today. This is not market-wide volume.</p>
          </details>
          <div className="rounded-xl p-6 mt-5" style={{ backgroundColor: "var(--bg-inset)" }}>
            <h3 className="font-bold text-lg">New to following disclosures?</h3>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--text-dim)" }}>Start with what the filing actually tells you—and what it leaves out.</p>
            <Link href="/learn/what-is-congressional-periodic-transaction-report" className="inline-flex min-h-11 items-center text-sm font-semibold mt-2" style={{ color: "var(--accent)" }}>Understand a House trade report →</Link>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border p-6 md:p-10 my-12 grid md:grid-cols-3 gap-8 items-center" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}>
        <div className="md:col-span-2"><p className="kicker mb-3">Explore the bigger story</p><h2 className="text-3xl md:text-4xl font-extrabold">One building.<br />An entire supply chain.</h2>
          <p className="max-w-xl text-sm md:text-base leading-relaxed mt-4" style={{ color: "var(--text-dim)" }}>Explore the ten industries behind the AI buildout—from power and materials to chips and software—and the companies with a financial stake in each.</p>
          <Link href="/explore" className="inline-flex items-center gap-2 min-h-11 font-bold text-sm mt-5" style={{ color: "var(--accent)" }}>Explore the AI buildout <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="rounded-xl p-6" style={{ backgroundColor: "var(--accent-soft)" }}><Layers3 size={44} aria-hidden="true" style={{ color: "var(--accent)" }} /><p className="font-semibold mt-4">Power. Chips. Infrastructure.<br />The story beneath the headlines.</p></div>
      </section>
      <NewsletterSignup variant="banner" />
    </main>
    <SiteFooter />
  </>;
}
