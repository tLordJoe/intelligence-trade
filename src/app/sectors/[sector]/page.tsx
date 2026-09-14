import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { HOME_SECTORS, SECTOR_WEIGHTS, SECTOR_WEIGHT_DATE, SECTOR_WEIGHT_SOURCE } from "@/lib/home-sectors";
import { sectorFunds, SECTOR_FUND_CHECKED } from "@/lib/sector-funds";
import { buildHomeWindow } from "@/lib/homepage-market";
import type { DisclosureRecord } from "@/lib/congress-schema";
import liveData from "@/lib/congress-live.json";
import "../../homepage.css";

export const revalidate = 3600;
export function generateStaticParams() { return HOME_SECTORS.map(s => ({ sector: s.id })); }
export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  const { sector } = await params;
  const entry = HOME_SECTORS.find(s => s.id === sector);
  return { title: entry ? `${entry.name}: companies & ETFs` : "Sector not found", ...(entry ? { alternates: { canonical: `/sectors/${entry.id}` } } : {}) };
}
export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  const active = HOME_SECTORS.find(s => s.id === sector);
  if (!active) notFound();
  const window = buildHomeWindow(liveData.trades as DisclosureRecord[], "ytd", new Date().toISOString().slice(0, 10));
  const funds = sectorFunds(active.id);
  return <><Navbar showCompare={false} /><main className="home-shell sector-page">
    <Link className="home-text-link" href="/#home-sectors-title">← Explore all sectors</Link>
    <header className="sector-page-hero" style={{ borderColor: active.colors[0] }}>
      <p className="kicker">Explore the market</p><h1>{active.name}</h1><p>{active.description}</p>
      <div className="sector-page-meta"><span><strong>{SECTOR_WEIGHTS[active.id].toFixed(2)}%</strong> of the S&amp;P 500 · {SECTOR_WEIGHT_DATE}</span><a href={SECTOR_WEIGHT_SOURCE} target="_blank" rel="noopener noreferrer">Weight source ↗</a></div>
    </header>
    <nav className="sector-steps" aria-label="On this sector page"><a href="#companies">1 · Explore companies</a><a href="#funds">2 · Explore ETFs</a><a href="#questions">3 · Know what to compare</a></nav>
    <section id="companies" className="sector-page-section" aria-labelledby="sector-companies-title">
      <div className="home-section-intro"><h2 id="sector-companies-title">Companies in this sector</h2><p>A starting list, not a ranking. Open a company overview for its identity, sector context and House disclosures.</p></div>
      <div className="sector-company-grid">{active.tickers.map(ticker => {
        const activity = window.companies.find(c => c.ticker === ticker);
        return <Link key={ticker} href={`/stocks/${encodeURIComponent(ticker)}`} className="sector-company-card">
          <span className="home-ticker-tile" aria-hidden="true">{ticker}</span><div><h3>{ticker}</h3>{activity && <p>{activity.name}</p>}
          <small>{activity ? `${activity.buyers} distinct buying ${activity.buyers === 1 ? "filer" : "filers"} · ${activity.purchases} purchase ${activity.purchases === 1 ? "record" : "records"}` : "No eligible YTD House purchases in this view"}</small><span className="home-text-link">Explore company →</span></div>
        </Link>;
      })}</div>
      <p className="home-muted">YTD House data only · {window.start} through {window.end}. Missing activity is not evidence of no investing. These editorial company examples are not a complete sector list or a verified holdings list for the funds below.</p>
    </section>
    <section id="funds" className="sector-page-section" aria-labelledby="sector-funds-title">
      <div className="home-section-intro"><h2 id="sector-funds-title">ETFs covering this sector</h2><p>Two ways to explore the sector through a fund. Examples—not recommendations, sponsors, or a complete fund directory.</p></div>
      <div className="sector-fund-grid">{funds.map(fund => <article className="home-panel sector-fund-card" key={fund.ticker}>
        <p className="kicker">Sector ETF</p><h3>{fund.ticker}</h3><p>{fund.name}</p><small>{fund.provider}</small>
        <Link className="home-text-link" href={`/etfs/${fund.ticker}`}>Explore {fund.ticker} →</Link>
        <a className="home-text-link" href={fund.source} target="_blank" rel="noopener noreferrer">Issuer source for {fund.ticker} ↗</a>
      </article>)}</div>
      <p className="home-muted">Names and sector associations checked against issuer sources on {SECTOR_FUND_CHECKED}. Open an ETF for published costs and fund details. These funds may cover different companies and use different weighting rules. Holdings, performance and overlap feeds are not yet connected.</p>
    </section>
    <section id="questions" className="home-panel sector-questions" aria-labelledby="sector-questions-title">
      <div className="home-section-intro"><h2 id="sector-questions-title">Same sector. Different exposure.</h2><p>Before narrowing your choices, use each issuer’s current fund documents to answer:</p></div>
      <div><article><h3>What does it own?</h3><p>Check the holdings, company sizes and largest positions—not just the fund’s name.</p></article><article><h3>What does it cost?</h3><p>Compare the expense ratio and trading costs using the same date.</p></article><article><h3>What do you already own?</h3><p>A new ticker can still duplicate companies held by your existing funds.</p></article></div>
      <p className="home-muted">Sector funds remain concentrated in one part of the market. This is an information directory, not a personalized recommendation. Holdings-based comparisons and rankings will appear only after their data is verified.</p>
    </section>
    <nav className="sector-switcher" aria-label="Other sectors">{HOME_SECTORS.map(s => <Link key={s.id} href={`/sectors/${s.id}`} aria-current={s.id === active.id ? "page" : undefined}>{s.name}</Link>)}</nav>
  </main><SiteFooter /></>;
}
