import Link from "next/link";
import { ArrowUpRight, Radar } from "lucide-react";
import CompanyMark from "./CompanyMark";
import { companyMark } from "@/lib/company-marks";
import type { RadarV2View } from "@/lib/radar-engine";

export default function RadarCards({ view, preview = false }: { view: RadarV2View; preview?: boolean }) {
  const items = preview ? view.items.slice(0,3) : view.items;
  return <section className={`radar-section${preview ? " radar-preview" : ""}`} id="on-the-radar" aria-labelledby="radar-title">
    <div className="radar-section-heading"><div><p className="kicker"><Radar size={15} aria-hidden="true"/> Outfox Radar · Evidence v2</p><h2 id="radar-title">On the Radar</h2><p>Follow the conviction: who expanded their position, how much it matters to their reported portfolio, and who went the other way.</p></div>
      <Link href="/radar/how-it-works" className="home-text-link">What puts a stock here? <ArrowUpRight size={16}/></Link></div>
    <div className="radar-grid">{items.map((item,index) => <article key={item.key} className="radar-card">
      <div className="radar-card-top"><span className="radar-rank">{String(index+1).padStart(2,"0")}</span><CompanyMark ticker={item.ticker??"13F"} src={item.ticker?companyMark(item.ticker,item.cik??undefined):null}/><div><h3><Link href={item.href}>{item.tickers.length>1?item.tickers.join(" / "):item.ticker??item.name}</Link></h3><p>{item.name}</p></div><ArrowUpRight className="radar-card-arrow" size={20} aria-hidden="true"/></div>
      <p className="radar-reason">{item.headline}</p>
      <ul className="radar-conviction-reasons">{item.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
      <dl className="radar-stats"><div><dt>Expanding managers</dt><dd>{item.managers}</dd></div><div><dt>Buying / selling filers</dt><dd>{item.buyers} / {item.sellers}</dd></div><div><dt>{item.kind==="manager_convergence"?"Holdings quarter":"Latest evidence filed"}</dt><dd>{item.kind==="manager_convergence"?view.coverage.latestQuarter:item.latestEvidenceFiled}</dd></div></dl>
      <div className="radar-card-bottom"><span className="radar-tag">{item.kind==="manager_convergence"?item.newlyReportedOnly?"New reported exposure":"Fund convergence":item.kind==="cross_source"?"Cross-source buying":item.kind==="insider_cluster"?"Insider cluster":"Broad buying cluster"}</span><Link href={item.href} aria-label={`Why ${item.ticker??item.name} is on the Radar`}>Why it qualifies <ArrowUpRight size={14}/></Link></div>
      {item.kind==="manager_convergence"&&<p className="radar-card-clock">{item.newlyReportedOnly?"First reporting can follow an IPO or reporting change—not necessarily new buying.":"Quarterly reported holdings changes—not live purchases."} Selling and reductions are included in the evidence.</p>}
    </article>)}</div>
    {!items.length && <p className="home-panel">No stocks meet all Radar rules in this window. We don’t fill the list with weaker matches.</p>}
    {!preview&&!!view.watchItems.length&&<section className="radar-divided"><h3>Divided signals. Inspect both sides.</h3><p>Substantial reported expansions, but enough meaningful reductions to prevent a clear accumulation label. These are separate from the qualifying shortlist above.</p><div className="radar-grid">{view.watchItems.map(item=><article className="radar-card radar-opposing" key={item.key}><h3><Link href={item.href}>{item.ticker??item.name}</Link></h3><p className="radar-reason">{item.headline}</p><ul className="radar-conviction-reasons">{item.reasons.map(r=><li key={r}>{r}</li>)}</ul><Link className="home-text-link" href={item.href}>Inspect expansions and reductions →</Link></article>)}</div></section>}
    <div className="radar-section-footer"><span>{view.qualifyingCount} qualifying companies · Four source feeds evaluated · Different source clocks stay visible</span>{preview && <Link className="home-text-link" href="/radar">See all {view.qualifyingCount} Radar companies <ArrowUpRight size={16}/></Link>}</div>
  </section>;
}
