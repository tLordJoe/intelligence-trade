import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { loadSenateCandidateReview } from "@/lib/senate/candidate-review";
import "../homepage.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Senate · Local source review", robots: { index: false, follow: false } };

export default async function SenateReviewPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_LOCAL_SENATE_REVIEW !== "1" || process.env.VERCEL) notFound();
  let review: ReturnType<typeof loadSenateCandidateReview>;
  try { review = loadSenateCandidateReview(process.cwd()); } catch {
    return <main className="home-shell"><h1>Senate review unavailable</h1><p>The archived source evidence could not be verified. Nothing has been published.</p></main>;
  }
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 100);
  const rows = review.rows.filter(row => !query || `${row.filer} ${row.raw.tickerText} ${row.assetName}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.filedDate.localeCompare(a.filedDate) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const page = Math.min(pages, Math.max(1, /^\d+$/.test(params.page ?? "") ? Number(params.page) : 1));
  const pageLink = (target: number) => `/senate-review?${new URLSearchParams({ page: String(target), q: query })}`;
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Senate source review</span></nav>
    <header className="instrument-hero"><p className="kicker">Local source review · Not published</p><h1>Senate disclosures</h1>
      <p className="instrument-summary">Inspect actual reported rows and their original filings. This is not a reconciled activity feed, investment ranking, or complete Senate archive.</p></header>
    <section className="home-panel"><h2>Coverage and release checks</h2>
      <p>Received-date windows: {[...new Set(review.runs.map(run => `${run.from}–${run.to}`))].sort().join("; ")}. {review.filings.length} electronic reports; {review.rows.length} source rows before amendment reconciliation; {review.unresolved.length} reports require extraction or source review.</p>
      <p>{review.repeatedReports} repeated downloads counted once. {review.identityLinkedRows} rows linked to a verified Senate identity; {review.securityLinkedRows} rows matched to an SEC issuer. An issuer match does not establish whether the instrument is a company stock or a fund.</p>
      <p role="alert">{review.blockers.length} reconciliation issues are held by report family. {review.disclosureRows.length} source rows qualify for a partial listed-security disclosure view, pending release review. The full source rows below may include originals and amendments—do not add them together.</p>
      <details><summary>Review queue</summary><ul>{Object.entries(review.holdCounts).map(([reason, count]) => <li key={reason}>{reason.replaceAll("_", " ")}: {count}</li>)}</ul>
        <ul>{review.unresolved.map(report => <li key={report.id}><a href={report.sourceUrl} target="_blank" rel="noopener noreferrer">{report.filer}</a>: {report.reason.replaceAll("_", " ")}</li>)}</ul></details>
      <details><summary>Amendment reconciliation ({review.amendmentWorklist.length})</summary><ul>{review.amendmentWorklist.map(item => <li key={item.amendmentId}>
        <a href={item.amendmentSource} target="_blank" rel="noopener noreferrer">{item.filer} · {item.reportDate}</a>: {item.reason.replaceAll("_", " ")}
        <ul>{item.candidates.map(candidate => <li key={candidate.originalId}><a href={candidate.originalSource} target="_blank" rel="noopener noreferrer">Possible original</a>: {candidate.unchangedRows} unchanged rows; {candidate.removedOrChangedRows} removed/changed; {candidate.addedOrChangedRows} added/changed. Requires source review.</li>)}</ul>
      </li>)}</ul></details>
    </section>
    <section className="sector-page-section"><h2>Reported rows—not unique trades</h2><p>Transaction date, filing date, covered owner and reported amount remain separate. Open each original for its full context.</p>
      <form className="senate-search" action="/senate-review"><label htmlFor="senate-search">Find a filer, ticker or asset</label><input id="senate-search" name="q" defaultValue={query} maxLength={100} /><button type="submit">Search reports</button></form>
      <p>{rows.length} matching source rows · Page {page} of {pages}.</p>
      <div className="sector-fund-grid">{rows.slice((page - 1) * 50, page * 50).map(row => <article className="home-panel" key={row.id}>
        <h3>{row.raw.tickerText} · {row.raw.typeText}</h3><p>{row.assetName}</p><p>{row.filer} · Senate{row.amendment ? " · Amendment" : ""}</p>
        <dl className="instrument-facts"><div><dt>Owner as disclosed</dt><dd>{row.owner}</dd></div><div><dt>Transaction date</dt><dd>{row.transactionDate ?? row.raw.date}</dd></div><div><dt>Filed</dt><dd>{row.filedDate}</dd></div><div><dt>Amount as disclosed</dt><dd>{row.raw.amountText}</dd></div></dl>
        <details><summary>Source details and outstanding checks</summary><p>Asset type as filed: {row.assetType}. Source row: {row.sourceRowNumber}. Received: {row.receivedDate}.</p><p>{row.raw.comment}</p><ul>{row.holds.map(hold => <li key={hold}>{hold.replaceAll("_", " ")}</li>)}</ul></details>
        <a className="home-text-link" href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Inspect original Senate filing ↗</a>
      </article>)}</div>
      <nav aria-label="Source row pages">{page > 1 && <Link href={pageLink(page - 1)}>Previous page</Link>}{" "}{page < pages && <Link href={pageLink(page + 1)}>Next page</Link>}</nav>
    </section>
  </main><SiteFooter /></>;
}
