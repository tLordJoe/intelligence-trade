import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { TradeCards } from "@/components/RadarEvidencePage";
import { activityLabels } from "@/lib/radar-activity";
import { currentRadar, radarIdentity } from "@/lib/radar-data";
import "../../../homepage.css";

export default async function RadarActivityDetails({params}:PageProps<"/radar/activity/[ticker]">){
  const ticker=(await params).ticker.toUpperCase();
  if(!/^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker))notFound();
  const view=currentRadar(),item=view.activityItems.find(i=>i.tickers.includes(ticker));
  if(!item&&!radarIdentity(ticker))notFound();
  return <><Navbar/><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/radar">On the Radar</Link><span>/</span><span aria-current="page">{ticker}</span></nav>
    <header className="instrument-hero">
      <p className="kicker">Outfox Radar · Recent disclosures</p>
      <h1>{item?.tickers.join(" / ")??ticker}</h1><h2>{item?.name??radarIdentity(ticker)?.title}</h2>
      <p className="instrument-summary">{item?activityLabels[item.kind]:"Not in the current recent clusters"}</p>
    </header>
    {item?<><section className="home-panel mt-4">
      <h2>What put it here</h2>
      <p>{item.buyers} buying {item.buyers===1?"filer":"filers"} across {item.purchaseEvents} purchase events; {item.sellers} selling {item.sellers===1?"filer":"filers"} across {item.saleEvents} sale events. Supporting sources: {item.supportingSources.join(", ")}.</p>
      <p>These filings are dated {view.activityFiledFrom}–{view.asOf}, for trades in the last 90 days. The filing date is not the date someone traded, or necessarily the date the report first became publicly available.</p>
      {item.saleContextRows>0&&<p>{item.saleContextRows} sale {item.saleContextRows===1?"row is":"rows are"} shown as context only; the associated filings mention a trading plan or possible mechanical activity.</p>}
    </section>
    <section className="sector-page-section"><h2>The filings behind this cluster</h2><TradeCards rows={item.rows} showActivityContext/></section></>:<p className="radar-scope">This cluster may have rolled out of the current window. <Link href={`/activity?q=${encodeURIComponent(ticker)}`}>Search the reported activity archive</Link>.</p>}
    <p className="radar-scope">Coverage is partial. A cluster describes reported activity, not investor intent or a prediction. <Link className="home-text-link" href="/radar/how-it-works">See the published rules →</Link></p>
  </main><SiteFooter/></>;
}
