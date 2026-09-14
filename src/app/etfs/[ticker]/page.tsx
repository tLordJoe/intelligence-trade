import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { HOME_SECTORS } from "@/lib/home-sectors";
import { allSectorFunds, findSectorFund, sectorFunds, SECTOR_FUND_CHECKED } from "@/lib/sector-funds";
import "../../homepage.css";

export function generateStaticParams() { return allSectorFunds().map(f => ({ ticker: f.ticker })); }
export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const fund = findSectorFund((await params).ticker);
  return { title: fund ? `${fund.ticker} · ${fund.name}` : "ETF not found",
    ...(fund ? { alternates: { canonical: `/etfs/${fund.ticker}` } } : {}) };
}
export default async function EtfPage({ params }: { params: Promise<{ ticker: string }> }) {
  const fund = findSectorFund((await params).ticker);
  if (!fund) notFound();
  const sector = HOME_SECTORS.find(s => s.id === fund.sectorId)!;
  const peers = sectorFunds(sector.id).filter(f => f.ticker !== fund.ticker);
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span>
      <Link href="/#home-sectors-title">Market sectors</Link><span aria-hidden="true">/</span><Link href={`/sectors/${sector.id}`}>{sector.name}</Link>
      <span aria-hidden="true">/</span><span aria-current="page">{fund.ticker} ETF</span></nav>
    <header className="instrument-hero"><p className="kicker">ETF overview · {sector.name}</p><h1>{fund.ticker}</h1><h2>{fund.name}</h2>
      <p>{fund.provider}</p><p className="instrument-summary">Explore the fund itself: its sector focus and published costs. This is not a congressional trading page.</p>
    </header>
    <nav className="sector-steps" aria-label="On this ETF page"><a href="#fund-facts">Fund facts</a><a href="#fund-holdings">Holdings &amp; performance</a><a href="#related-funds">Other sector ETFs</a></nav>
    <section id="fund-facts" className="sector-page-section" aria-labelledby="fund-facts-title">
      <div className="home-section-intro"><h2 id="fund-facts-title">Understand this fund</h2><p>Published fund basics, with dated sources—not sample figures.</p></div>
      <dl className="instrument-facts"><div><dt>Fund type</dt><dd>Sector ETF</dd></div><div><dt>Sector focus</dt><dd>{sector.name}</dd></div>
        <div><dt>{fund.expenseLabel}</dt><dd>{fund.expensePercent.toFixed(2)}%<small>Source dated {fund.expenseAsOf}</small></dd></div>
        <div><dt>Illustrative annual fund expense</dt><dd>${(fund.expensePercent * 100).toFixed(0)}<small>Per $10,000 held at a constant value</small></dd></div></dl>
      <p className="home-muted">The cost illustration is arithmetic, not a fee quote or performance forecast. It excludes trading costs and taxes. Expenses can change.</p>
      <div className="instrument-actions"><a className="home-text-link" href={fund.source} target="_blank" rel="noopener noreferrer">Fund documents ↗</a>
        <a className="home-text-link" href={fund.expenseSource} target="_blank" rel="noopener noreferrer">Expense source ↗</a></div>
      <p className="home-muted">Sources checked {SECTOR_FUND_CHECKED}. These are dated reference facts, not an automatic market-data feed.</p>
    </section>
    <section id="fund-holdings" className="home-panel sector-page-section" aria-labelledby="fund-holdings-title">
      <div className="home-section-intro"><h2 id="fund-holdings-title">What does {fund.ticker} own?</h2>
        <p>Holdings, weights, assets, prices and historical returns are not connected to Outfox yet. They are unavailable—not zero. Company examples elsewhere in this sector are not a holdings list for this ETF.</p></div>
      <a className="home-text-link" href={fund.source} target="_blank" rel="noopener noreferrer">Check {fund.ticker} with its issuer ↗</a>
    </section>
    <section id="related-funds" className="sector-page-section" aria-labelledby="related-funds-title">
      <div className="home-section-intro"><h2 id="related-funds-title">Another fund in {sector.name}</h2><p>Another way to research the sector—not a recommendation or a claim of identical holdings.</p></div>
      <div className="sector-fund-grid">{peers.map(peer => <Link key={peer.ticker} href={`/etfs/${peer.ticker}`} className="home-panel sector-fund-card">
        <h3>{peer.ticker}</h3><p>{peer.name}</p><small>{peer.provider}</small><span className="home-text-link">Explore fund →</span></Link>)}</div>
    </section>
    <Link className="home-text-link" href={`/sectors/${sector.id}#funds`}>← Back to {sector.name}</Link>
  </main><SiteFooter /></>;
}
