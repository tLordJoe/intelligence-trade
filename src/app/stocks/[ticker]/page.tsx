import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CompanyMark from "@/components/CompanyMark";
import { companyMark } from "@/lib/company-marks";
import DisclosureCard from "@/components/DisclosureCard";
import { HOME_SECTORS } from "@/lib/home-sectors";
import { sectorFunds } from "@/lib/sector-funds";
import { resolveTicker } from "@/lib/security-master";
import { archiveRecords } from "@/lib/home-discovery";
import { buildHomeWindow } from "@/lib/homepage-market";
import type { DisclosureRecord } from "@/lib/congress-schema";
import master from "@/lib/sector-company-identities.json";
import liveData from "@/lib/congress-live.json";
import "../../homepage.css";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const stock = resolveTicker((await params).ticker, master);
  return { title: stock.title ? `${stock.ticker} · ${stock.title}` : "Stock not found",
    ...(stock.title ? { alternates: { canonical: `/stocks/${stock.ticker}` } } : {}) };
}
export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const stock = resolveTicker((await params).ticker, master);
  const sector = HOME_SECTORS.find(s => (s.tickers as readonly string[]).includes(stock.ticker));
  if (!stock.title || !sector) notFound();
  const asOf = new Date().toISOString().slice(0, 10);
  const records = archiveRecords(liveData.trades as DisclosureRecord[], asOf).filter(r => r.ticker === stock.ticker && r.cik === stock.cik);
  const activity = buildHomeWindow(records, "ytd", asOf).companies.find(c => c.ticker === stock.ticker);
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span>
      <Link href="/#home-sectors-title">Market sectors</Link><span aria-hidden="true">/</span><Link href={`/sectors/${sector.id}`}>{sector.name}</Link>
      <span aria-hidden="true">/</span><span aria-current="page">{stock.ticker}</span></nav>
    <header className="instrument-hero"><p className="kicker">Company overview · {sector.name}</p>
      <div className="instrument-title"><CompanyMark ticker={stock.ticker} src={companyMark(stock.ticker, stock.cik)} /><h1>{stock.ticker}</h1></div>
      <h2>{stock.title}</h2><p className="instrument-summary">Company identity, sector context and disclosed House activity. Not a price chart or a complete company research profile.</p>
    </header>
    <nav className="sector-steps" aria-label="On this company page"><a href="#company-context">Company context</a><a href="#company-disclosures">House disclosures</a><a href="#sector-etfs">Sector ETFs</a></nav>
    <section id="company-context" className="sector-page-section" aria-labelledby="company-context-title">
      <div className="home-section-intro"><h2 id="company-context-title">{sector.name}: the bigger picture</h2><p>{sector.description}</p></div>
      <p className="home-muted">Sector context is an editorial guide, not a description of every business this company operates. Issuer name and ticker matched to the SEC directory dated {master.updatedAt.slice(0, 10)}.</p>
      <a className="home-text-link" href={`https://www.sec.gov/edgar/browse/?CIK=${stock.cik}&owner=exclude`} target="_blank" rel="noopener noreferrer">Company filings at the SEC ↗</a>
    </section>
    <section id="company-disclosures" className="sector-page-section" aria-labelledby="company-disclosures-title">
      <div className="home-section-intro"><h2 id="company-disclosures-title">House disclosures for {stock.ticker}</h2><p>These are disclosures about the stock—not its price performance or the company’s own financial results.</p></div>
      {activity && <dl className="instrument-facts"><div><dt>YTD distinct buying filers</dt><dd>{activity.buyers}</dd></div><div><dt>YTD purchase records</dt><dd>{activity.purchases}</dd></div><div><dt>YTD sale records</dt><dd>{activity.sales}</dd></div></dl>}
      <div className="sector-fund-grid">{records.slice(0, 4).map(record => <DisclosureCard key={record.id} record={record} />)}</div>
      {!records.length && <p className="home-panel">No matching House records are available in this archive. This does not mean no trading occurred.</p>}
      <p className="home-muted">House only · Archive refreshed {liveData.updatedAt.slice(0, 10)} · Delayed and incomplete coverage. YTD counts use transaction dates through {asOf}; cards below show the latest filings across the archive.</p>
      <Link className="home-text-link" href={`/congress?ticker=${encodeURIComponent(stock.ticker)}`}>Open {stock.ticker} in the House disclosure archive →</Link>
    </section>
    <section id="sector-etfs" className="sector-page-section" aria-labelledby="stock-funds-title">
      <div className="home-section-intro"><h2 id="stock-funds-title">Explore ETFs in {sector.name}</h2><p>Sector fund examples—not verified holders of {stock.ticker}. Open a fund to understand its identity and published costs.</p></div>
      <div className="sector-fund-grid">{sectorFunds(sector.id).map(fund => <Link key={fund.ticker} href={`/etfs/${fund.ticker}`} className="home-panel sector-fund-card"><h3>{fund.ticker}</h3><p>{fund.name}</p><span className="home-text-link">Explore fund →</span></Link>)}</div>
    </section>
    <Link className="home-text-link" href={`/sectors/${sector.id}`}>← Back to {sector.name}</Link>
  </main><SiteFooter /></>;
}
