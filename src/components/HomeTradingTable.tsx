"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BuildoutStackIcon from "./BuildoutStackIcon";
import { HOME_FILER_IMAGES } from "@/lib/home-filer-images";
import { filerProfilePath } from "@/lib/filer-profile";
import { ArrowUpRight, Clock3, Layers3 } from "lucide-react";
import type { HomeFiler, HomePeriod, HomeWindow } from "@/lib/homepage-market";

const periods: { key: HomePeriod; label: string }[] = [
  { key: "ytd", label: "YTD" }, { key: "30", label: "30-day" }, { key: "90", label: "90-day" },
];
function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`;
}
function FilerLink({ person }: { person: HomeFiler }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const portrait = HOME_FILER_IMAGES[person.key];
  return <Link className="home-filer" href={filerProfilePath(person.key)}
    title={`${person.name} · ${person.district || person.state} · View disclosures`}
    aria-label={`View ${person.name}'s disclosures`}>
    <span aria-hidden="true">{initials(person.name)}</span>
    {portrait && !failed && <Image src={`/portraits/${portrait}.jpg`} alt="" width={38} height={38} style={{ opacity: loaded ? 1 : 0 }} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </Link>;
}
export function TickerTile({ ticker }: { ticker: string }) {
  return <span className="home-ticker-tile" aria-hidden="true">{ticker}</span>;
}

export default function HomeTradingTable({ windows, updatedAt, scans }: {
  windows: Record<HomePeriod, HomeWindow>; updatedAt: string; scans: number;
}) {
  const [period, setPeriod] = useState<HomePeriod>("ytd");
  const [source, setSource] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const current = windows[period];
  const companies = expanded ? current.companies : current.companies.slice(0, 5);
  const stale = !Number.isFinite(Date.parse(updatedAt)) || Date.parse(current.end) - Date.parse(updatedAt) > 14 * 86_400_000;
  return <>
    <section className="home-trading" aria-labelledby="home-trading-title">
      <div className="home-section-intro">
        <h2 id="home-trading-title">What they’re trading</h2>
        <p>Compare the stocks attracting buyers, then explore the people behind the activity.</p>
      </div>
      <div className="home-controls">
        <div className="home-source-controls" role="group" aria-label="Disclosure source">
          <button type="button" aria-pressed={source === "all"} onClick={() => setSource("all")}>All available</button>
          <button type="button" aria-pressed={source === "house"} onClick={() => setSource("house")}>House-only</button>
          {["Senate-only", "Corporate insiders", "Funds / institutions"].map(label =>
            <button type="button" key={label} disabled title="This source is not connected yet">{label}<small>Coming soon</small></button>)}
        </div>
        <div className="home-period-controls" role="group" aria-label="Transaction date range">
          {periods.map(item => <button key={item.key} type="button" aria-pressed={period === item.key}
            onClick={() => { setPeriod(item.key); setExpanded(false); }}>{item.label}</button>)}
        </div>
      </div>
      <p className="home-coverage" role="status"><Clock3 size={13} aria-hidden="true" /> House coverage only · Traded {current.start}–{current.end} · Delayed disclosures</p>
      <div className="home-table-frame">
        <table className="home-market-table">
          <caption className="sr-only">Stocks with disclosed House purchases, ranked by distinct purchasing filers. Sales in the same period are shown separately.</caption>
          <thead><tr><th scope="col">Company + ticker</th><th scope="col">Distinct buyers</th><th scope="col">Purchase records</th><th scope="col">Sale records</th><th scope="col">Buying filers</th></tr></thead>
          <tbody>{companies.map(company => <tr key={company.ticker}>
            <th scope="row"><Link className="home-company" href={`/congress?ticker=${encodeURIComponent(company.ticker)}`}>
              <TickerTile ticker={company.ticker} /><span><strong>{company.ticker}</strong><small>{company.name}</small></span>
            </Link></th>
            <td data-label="Distinct buyers" className="home-count">{company.buyers}</td>
            <td data-label="Purchase records" className="home-count">{company.purchases}</td>
            <td data-label="Sale records" className="home-count home-sales">{company.sales}</td>
            <td data-label="Buying filers"><div className="home-filers">{company.filers.slice(0, 4).map(person => <FilerLink key={person.key} person={person} />)}
              {company.filers.length > 4 && <details className="home-more-filers"><summary aria-label={`Show ${company.filers.length - 4} more buyers of ${company.ticker}`}>+{company.filers.length - 4}</summary>
                <ul>{company.filers.slice(4).map(person => <li key={person.key}><Link href={filerProfilePath(person.key)}>{person.name}</Link></li>)}</ul>
              </details>}
            </div></td>
          </tr>)}</tbody>
        </table>
        {!companies.length && <p className="home-empty">No eligible purchases are available for this transaction window. Recent periods may be incomplete because disclosures arrive later.</p>}
      </div>
      <div className="home-table-footer"><span>Named filers, not independent family accounts. Initials appear where a portrait is unavailable.</span>
        {current.companies.length > 5 && <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer stocks" : `View all ${current.companies.length} stocks`} <ArrowUpRight size={15} aria-hidden="true" /></button>}
      </div>
      <details className="home-method"><summary>Coverage and how we count</summary>
        <p>House records only. Ranked by distinct purchasing filers, then ticker. One buyer can contribute several purchase records. Sales are counted separately for these stocks. Options, exchanges, unresolved tickers, conflicting issuer identities, quarantined records and invalid dates are excluded. Each period uses transaction dates, not filing dates. Recent activity is incomplete, not zero.</p>
        <p>Archive refreshed {updatedAt.slice(0, 10)}. {scans > 0 && `${scans} scanned reports await recovery and are not included.`} {stale && <strong>Archive refresh overdue; recent activity may be missing.</strong>}</p>
        <Link href="/methodology">Read the methodology →</Link>
      </details>
    </section>
    <div className="home-latest-grid">
      <section className="home-panel" aria-labelledby="home-latest-title"><h2 id="home-latest-title">Latest disclosed purchases</h2>
        <p className="home-muted">Newest filings within the selected transaction window.</p>
        {current.recent.map(row => <article className="home-purchase" key={row.id}>
          <TickerTile ticker={row.ticker} /><FilerLink person={row.filer} /><div className="home-purchase-person"><Link href={filerProfilePath(row.filer.key)}>{row.filer.name}</Link><span>{row.ticker} · {row.amount}</span></div>
          <a href={row.source} target="_blank" rel="noopener noreferrer" aria-label={`Original ${row.ticker} filing by ${row.filer.name}`}><span>Traded {row.traded}</span><span>Filed {row.filed}</span></a>
        </article>)}
        {!current.recent.length && <p className="home-empty">No eligible purchases in this window.</p>}
        <Link className="home-text-link" href="/congress">View all disclosures →</Link>
      </section>
      <section className="home-buildout home-panel" aria-labelledby="home-buildout-title">
        <BuildoutStackIcon />
        <div><Layers3 size={19} aria-hidden="true" /><h2 id="home-buildout-title">Follow the AI buildout.</h2><p>From energy to chips to software.</p><Link className="home-text-link" href="/explore">Explore the buildout →</Link></div>
      </section>
    </div>
  </>;
}
