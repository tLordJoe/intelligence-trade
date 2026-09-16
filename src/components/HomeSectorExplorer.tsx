"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, Wallet, MessagesSquare, Heart, ShoppingCart, Factory, ShoppingBasket, Flame, Zap, Layers3, Building2 } from "lucide-react";
import { HOME_SECTORS, SECTOR_WEIGHTS, SECTOR_WEIGHT_DATE, SECTOR_WEIGHT_SOURCE, sectorDisplayWidth } from "@/lib/home-sectors";
import type { HomeCompany } from "@/lib/homepage-market";
import CompanyMark from "./CompanyMark";
import { sectorFunds } from "@/lib/sector-funds";

const icons = { monitor: Monitor, wallet: Wallet, messages: MessagesSquare, heart: Heart, cart: ShoppingCart,
  factory: Factory, basket: ShoppingBasket, flame: Flame, bolt: Zap, layers: Layers3, building: Building2 };
export default function HomeSectorExplorer({ companies }: { companies: HomeCompany[] }) {
  const [selected, setSelected] = useState<string>("healthcare");
  const [hovered, setHovered] = useState<string | null>(null);
  const active = HOME_SECTORS.find(s => s.id === (hovered ?? selected)) ?? HOME_SECTORS[3];
  const Icon = icons[active.icon];
  const activity = companies.filter(c => (active.tickers as readonly string[]).includes(c.ticker)).slice(0, 3);
  return <section className="home-sectors" aria-labelledby="home-sectors-title">
    <div className="home-section-intro"><h2 id="home-sectors-title">Find your next investment idea</h2><p><strong>Explore the market by sector.</strong> Sector sizes reflect S&amp;P 500 market weights—not buying activity. Select a sector to explore its companies and available disclosures.</p></div>
    <div className="home-sector-grid">
      <div className="home-sector-bars" role="group" aria-label="Explore sectors" onMouseLeave={() => setHovered(null)}>
        {HOME_SECTORS.map(sector => { const SectorIcon = icons[sector.icon]; return <button key={sector.id} type="button"
          className="stack-bar home-sector-bar" aria-pressed={selected === sector.id} aria-controls="home-sector-detail"
          style={{ width: `${sectorDisplayWidth(sector.id)}%`, background: `linear-gradient(120deg, ${sector.colors[0]}, ${sector.colors[1]})` }}
          onClick={() => { setSelected(sector.id); setHovered(null); }}
          onPointerEnter={e => { if (e.pointerType === "mouse") setHovered(sector.id); }}
          onFocus={() => setHovered(sector.id)} onBlur={() => setHovered(null)}>
          <span className="subcategory-bubble"><SectorIcon size={16} aria-hidden="true" /></span><span>{sector.name}</span><small>{SECTOR_WEIGHTS[sector.id].toFixed(2)}%</small>
        </button>; })}
        <p className="home-muted">S&amp;P 500 sector weights as of {SECTOR_WEIGHT_DATE}. Bar widths include a minimum display width for readability, as in the AI stack. <a href={SECTOR_WEIGHT_SOURCE} target="_blank" rel="noopener noreferrer" className="underline">Weight source ↗</a></p>
      </div>
      <div className="home-panel home-sector-detail" id="home-sector-detail">
        <div className="home-sector-heading"><span style={{ background: active.colors[0] }}><Icon size={28} aria-hidden="true" /></span><div><h3>{active.name}</h3><p>{active.description}</p></div></div>
        <h4>Disclosed buying · Year to date</h4>
        <p className="home-muted">Among selected companies tracked in this sector—not a sector-wide ranking.</p>
        {activity.length ? activity.map(company => <Link className="home-sector-company" key={company.ticker} href={`/stocks/${encodeURIComponent(company.ticker)}`}>
          <CompanyMark ticker={company.ticker} src={company.mark} /><span><strong>{company.ticker}</strong><small>{company.name}</small></span><span>{company.buyers}<small>buying {company.buyers === 1 ? "filer" : "filers"}</small></span>
        </Link>) : <p className="home-empty">No eligible YTD purchases found for these tracked companies. This is not a claim of no activity across the sector.</p>}
        <p className="home-muted">Companies in this sector</p><div className="home-sector-tickers">{active.tickers.slice(0, 3).map(ticker => <Link href={`/stocks/${encodeURIComponent(ticker)}`} key={ticker} aria-label={`Explore ${ticker} company overview`}>{ticker}</Link>)}</div>
        <h4 className="home-sector-fund-heading">ETFs covering this sector</h4>
        <p className="home-muted">Examples, not recommendations. Fund holdings differ.</p>
        <div className="home-sector-tickers">{sectorFunds(active.id).map(fund => <Link href={`/etfs/${fund.ticker}`} key={fund.ticker} aria-label={`Explore ${fund.ticker} ETF overview`}>{fund.ticker}<small>{fund.provider}</small></Link>)}</div>
        <Link className="home-text-link sector-explore-link" href={`/sectors/${active.id}`}>Explore {active.name} →</Link>
      </div>
    </div>
  </section>;
}
