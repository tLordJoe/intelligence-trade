import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CompanyMark from "@/components/CompanyMark";
import { companyMark } from "@/lib/company-marks";
import { loadInsiderCandidateReview } from "@/lib/form4/candidate-review";
import "../homepage.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Corporate insiders · Local source review",
  robots: { index: false, follow: false },
};

export default function InsiderReviewPage() {
  // Never expose the working archive through a hosted preview or production.
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_LOCAL_INSIDER_REVIEW !== "1" || process.env.VERCEL) notFound();
  let review: ReturnType<typeof loadInsiderCandidateReview>;
  try { review = loadInsiderCandidateReview(process.cwd()); } catch {
    return <main className="home-shell"><h1>Insider source review unavailable</h1><p>No verified local candidate could be loaded. No data has been published.</p></main>;
  }
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Corporate insider source review</span></nav>
    <header className="instrument-hero"><p className="kicker">Local review · Not published</p>
      <h1>Corporate insider disclosures</h1>
      <p className="instrument-summary">Real SEC filings, prepared for source review. This is a bounded collection—not a market-wide feed or an approved public release.</p>
    </header>
    <section className="home-panel" aria-labelledby="insider-coverage"><h2 id="insider-coverage">What this review covers</h2>
      <p>Filing windows: {review.runs.map(run => `${run.from}–${run.to}`).join("; ")}. Requested issuers: {review.issuers.join(", ")}.</p>
      <p>{review.filingCount} filings · {review.sourceRowCount} total source rows · {review.records.length} eligible non-derivative purchase/sale rows shown below. Awards, exercises, gifts and derivatives are not counted as purchases.</p>
      <p>These are reported rows, not a count of individual executions. No most-active ranking, estimated cash paid, or investment recommendation is calculated.</p>
      <p>Next release gates: source reconciliation, coverage review, amendment review, independent review and approved publication. The homepage insider tab remains unavailable.</p>
      <p>Broad source-window completion: {review.coverage.filter(window => window.universeSha256 && !window.missingAccessions.length).length} complete window snapshots. {review.coverage.filter(window => window.universeSha256).map(window => `${window.from}–${window.to}: ${window.expectedFilings - window.missingAccessions.length}/${window.expectedFilings} source filings collected`).join("; ")}.</p>
      {review.blockers.length > 0 && <p role="alert">{review.heldIssuers.length} issuers withheld: {review.blockers.length} reconciliation issues require review. Unrelated eligible issuers remain visible.</p>}
    </section>
    <section className="sector-page-section" aria-labelledby="insider-records"><div className="home-section-intro"><h2 id="insider-records">Inspect the reported activity</h2>
      <p>Sorted by filing date. Transaction dates and reported prices stay separate from filing dates and execution prices.</p></div>
      <div className="sector-fund-grid">{review.records.map(record => <article className="home-panel" key={record.id}>
        <div className="instrument-title"><CompanyMark ticker={record.ticker} src={companyMark(record.ticker, record.issuerCik)} /><h3>{record.ticker} · {record.classification === "reported_purchase" ? "Reported purchase" : "Reported sale"}</h3></div>
        <p>{record.issuerName} · {record.securityTitle}</p>
        <p>{record.reportingOwners.map(owner => `${owner.name ?? owner.cik}${owner.officerTitle ? ` — ${owner.officerTitle}` : ""}`).join("; ")}</p>
        <dl className="instrument-facts"><div><dt>Transaction date</dt><dd>{record.transactionDate}</dd></div><div><dt>Filed</dt><dd>{record.filedDate}</dd></div><div><dt>Reported shares</dt><dd>{record.reportedShares}</dd></div><div><dt>Reported price per share</dt><dd>{record.reportedPrice.value ?? "Not specified"}</dd></div></dl>
        <p>Price basis: {record.priceQuality === "weighted_average" ? "Weighted average—not an individual execution price" : record.priceQuality === "footnote_only" ? "See source footnotes" : record.priceQuality === "exact" ? "Source-reported numeric price" : "Not established"}. Ownership: {record.ownership}.</p>
        <p>Filing-level trading-plan indicator: {record.filingPlanIndicator === null ? "Not specified" : record.filingPlanIndicator ? "Indicated—not assigned to every row" : "Not indicated"}.</p>
        {Object.keys(record.footnotes).length > 0 && <details><summary>Source footnotes</summary>{Object.entries(record.footnotes).map(([id, note]) => <p key={id}><strong>{id}:</strong> {note}</p>)}</details>}
        <a className="home-text-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect original SEC filing ↗</a>
      </article>)}</div>
      {!review.records.length && <p>No eligible activity is displayed for this reviewed selection. This does not establish that no insider activity occurred.</p>}
    </section>
  </main><SiteFooter /></>;
}
