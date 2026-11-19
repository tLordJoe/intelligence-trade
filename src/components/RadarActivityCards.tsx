import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CompanyMark from "./CompanyMark";
import { companyMark } from "@/lib/company-marks";
import { activityLabels, radarActivityPreview } from "@/lib/radar-activity";
import type { RadarV2View } from "@/lib/radar-engine";

const filingDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function RadarActivityCards({view,preview}:{view:RadarV2View;preview:boolean}){
  const items = preview ? radarActivityPreview(view.activityItems) : view.activityItems;
  if(!items.length) return null;
  return <section aria-labelledby="radar-activity-title" className={view.items.length ? "sector-page-section" : ""}>
    <h3 className="text-xl font-bold mb-2" id="radar-activity-title">Recent buying and selling clusters</h3>
    <p className="radar-scope mt-0">Multiple reporting filers, not just the newest trade. Based on filings dated {view.activityFiledFrom}–{view.asOf}. Coverage is partial.</p>
    <div className="radar-grid radar-activity-grid">
      {items.map(item=><article className="radar-card" key={item.key}>
        <div className="radar-card-top">
          <CompanyMark ticker={item.ticker} src={companyMark(item.ticker,item.cik)}/>
          <div><h3><Link href={`/radar/activity/${item.ticker}`}>{item.tickers.join(" / ")}</Link></h3><p>{item.name}</p></div>
          <ArrowUpRight className="radar-card-arrow" size={20} aria-hidden="true"/>
        </div>
        <p className="radar-reason">{activityLabels[item.kind]}</p>
        <ul className="radar-conviction-reasons">{item.examples.map(row=><li key={row.id}><strong>{row.name}</strong> · {row.side==="Buy"?"buy":"sale"}, {row.amount} <span className="text-[var(--text-dim)]">(filed {filingDate.format(new Date(row.filed))})</span></li>)}</ul>
        <dl className="radar-stats">
          <div><dt>Buying filers</dt><dd>{item.buyers}</dd></div>
          <div><dt>Selling filers</dt><dd>{item.sellers}</dd></div>
          <div><dt>Supporting feeds</dt><dd>{item.supportingSources.length}</dd></div>
        </dl>
        <p className="radar-card-clock">{item.supportingSources.join(" · ")}{item.saleContextRows>0&&" · Also includes separate sale context"}</p>
        <div className="radar-card-bottom"><Link href={`/radar/activity/${item.ticker}`}>See {item.ticker} filings <ArrowUpRight size={14}/></Link></div>
      </article>)}
    </div>
  </section>;
}
