import Link from "next/link";
import { ArrowUpRight, Radar } from "lucide-react";
import CompanyMark from "./CompanyMark";
import { companyMark } from "@/lib/company-marks";
import type { RadarView } from "@/lib/radar";

export default function RadarCards({ view, preview = false }: { view: RadarView; preview?: boolean }) {
  const items = preview ? view.items.slice(0,3) : view.items;
  return <section className={`radar-section${preview ? " radar-preview" : ""}`} id="on-the-radar" aria-labelledby="radar-title">
    <div className="radar-section-heading"><div><p className="kicker"><Radar size={15} aria-hidden="true"/> Outfox Radar</p><h2 id="radar-title">On the Radar</h2><p>More than a one-off buy. Follow the patterns behind the names.</p></div>
      <Link href="/radar/how-it-works" className="home-text-link">What puts a stock here? <ArrowUpRight size={16}/></Link></div>
    <div className="radar-grid">{items.map((item,index) => <article key={item.ticker} className="radar-card">
      <div className="radar-card-top"><span className="radar-rank">{String(index+1).padStart(2,"0")}</span><CompanyMark ticker={item.ticker} src={companyMark(item.ticker,item.cik)}/><div><h3><Link href={`/radar/${item.ticker}`}>{item.ticker}</Link></h3><p>{item.name}</p></div><ArrowUpRight className="radar-card-arrow" size={20} aria-hidden="true"/></div>
      <p className="radar-reason">{item.buyers} buying filers. {item.repeatBuyers} came back on another date.</p>
      <dl className="radar-stats"><div><dt>Buy records</dt><dd>{item.purchases}</dd></div><div><dt>Sale records</dt><dd>{item.sales}</dd></div><div><dt>Latest buy filed</dt><dd>{item.latestBuyFiled.slice(5).replace("-","/")}</dd></div></dl>
      <div className="radar-card-bottom"><span className={`radar-tag${item.mixedActivity ? " radar-tag-mixed" : ""}`}>{item.mixedActivity ? "Mixed buying & selling" : "Repeat buying"}</span><Link href={`/radar/${item.ticker}`} aria-label={`Why ${item.ticker} is on the Radar`}>See the evidence <ArrowUpRight size={14}/></Link></div>
    </article>)}</div>
    {!items.length && <p className="home-panel">No stocks meet all Radar rules in this window. We don’t fill the list with weaker matches.</p>}
    <div className="radar-section-footer"><span>90-day disclosed activity · Tracked company universe</span>{preview && <Link className="home-text-link" href="/radar">Explore the full Radar <ArrowUpRight size={16}/></Link>}</div>
  </section>;
}
