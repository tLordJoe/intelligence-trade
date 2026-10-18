import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { RADAR_RULES } from "@/lib/radar";
import { currentRadar } from "@/lib/radar-data";
import "../../homepage.css";
export const metadata:Metadata={title:"How Outfox Radar works",alternates:{canonical:"/radar/how-it-works"}};
export const revalidate = 3600;
export default function RadarMethodology(){const view=currentRadar();return <><Navbar/><main className="home-shell instrument-page radar-methodology">
  <nav className="instrument-breadcrumb"><Link href="/radar">On the Radar</Link><span>/</span><span>How it works</span></nav>
  <header className="instrument-hero"><p className="kicker">Outfox Radar · Rules v{RADAR_RULES.version}</p><h1>Not a hunch.<br/>A pattern you can inspect.</h1><p className="instrument-summary">Radar automatically highlights repeat disclosed buying. Every name meets the same rules; fame, investment size and our personal preferences do not move it up the list.</p></header>
  <section className="sector-page-section"><h2>The entry rules</h2><ul className="radar-rules"><li><strong>More than one buyer.</strong> At least two distinct reporting filers in the past 90 calendar days.</li><li><strong>More than a one-off.</strong> At least three purchase records, with at least one filer buying on two different transaction dates. Split rows on one date do not count as repeat buying.</li><li><strong>A recent disclosure.</strong> At least one qualifying purchase filed in the past 30 calendar days. Transactions must also fall inside the 90-day window.</li><li><strong>A linked company.</strong> Exact ticker and issuer-CIK match in the published {view.universeSize}-company sector identity universe. Funds, options, unknown identities and quarantined rows are not candidates.</li></ul></section>
  <section className="sector-page-section"><h2>Six things to look at</h2><div className="radar-explain-grid">{[
    ["Breadth","How many distinct filers disclosed buying—not how many rows one person filed."],
    ["Repeat buying","How many returned on a different transaction date."],
    ["Source breadth","Whether eligible buyers appear in the House, Senate, or both."],
    ["The other side","Purchase records, sale records and distinct sellers. A mixed pattern stays labeled mixed."],
    ["Freshness","When the newest qualifying purchase filing became public."],
    ["Filing delay","The median days between a reported purchase and its filing. It is not a live execution feed."],
  ].map(([title,body])=><article className="home-panel" key={title}><h3>{title}</h3><p>{body}</p></article>)}</div>
  <p className="radar-scope">Order is deterministic: distinct buyers descending, repeat buyers descending, buying-chamber count descending, newest buy filing descending, then ticker alphabetically. At most ten qualify for display. Buying-versus-selling and filing delay are context, not hidden score bonuses. These thresholds are product rules, not a statistically validated predictive model.</p></section>
  <section className="sector-page-section"><h2>What the first version covers</h2><p>Reviewed House and Senate disclosures within the tracked company universe. One filer can report family accounts; distinct filers do not prove independent investment decisions. Amount brackets are preserved, never used to estimate exact dollars or rank wealth. All data is delayed and source coverage is incomplete.</p><p>Corporate insider releases currently cover a separate dated filing window. They are not scored as complete 90-day history. Institutional Form 13F reports are quarter-end holdings, not confirmed purchases; their CUSIPs are not fuzzy-matched to Radar tickers. Neither source contributes to this version’s ranking. <Link href="/insiders">Inspect insider filings</Link> or <Link href="/institutions">institutional holdings</Link> separately.</p></section>
  <section className="sector-page-section"><h2>Activity is not a promise</h2><p>A highlight is a research starting point, not a buy recommendation, personal profit claim or demonstrated trading edge. There is no performance badge until a separate point-in-time test records every qualifying signal, realistic entry dates after publication, costs, losses and benchmark comparisons. Rules and timestamps must be frozen before such a test.</p><p>Current view: {view.start}–{view.asOf}. The list is recomputed from published archives; it is not a stored historical signal ledger or an alert subscription.</p></section><Link className="home-text-link" href="/radar">Back to the Radar →</Link>
  </main><SiteFooter/></>;}
