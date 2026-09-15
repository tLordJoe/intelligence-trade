import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CompanyMark from "@/components/CompanyMark";
import { companyMark } from "@/lib/company-marks";
import { CalendarDays } from "lucide-react";
import release from "@/lib/senate-live.json";
import { readApprovedSenateRelease, querySenateDisclosures, prepareSenatePublicRelease } from "@/lib/senate/public-view";
import { loadSenateCandidateReview } from "@/lib/senate/candidate-review";
import "../homepage.css";

export const metadata: Metadata = { title: "Senate disclosures · Outfox", description: "Inspect source-linked Senate security purchase and sale disclosures, with clear dates, owners and coverage limitations.", alternates: { canonical: "/senate" } };

export default async function SenatePage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; period?: string }> }) {
  let data = readApprovedSenateRelease(release);
  let preview = false;
  if (!data && process.env.NODE_ENV === "development" && process.env.ENABLE_LOCAL_SENATE_REVIEW === "1" && !process.env.VERCEL) {
    data = prepareSenatePublicRelease(loadSenateCandidateReview(process.cwd())).payload;
    preview = true;
  }
  if (!data) notFound();
  const params = await searchParams;
  const view = querySenateDisclosures(data, params, new Date().toISOString().slice(0, 10));
  const pageLink = (target: number) => `/senate?${new URLSearchParams({ q: view.q, page: String(target), period: view.period })}`;
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Senate disclosures</span></nav>
    <header className="instrument-hero"><p className="kicker">{preview ? "Local preview · Not published · " : ""}Senate · Partial source coverage</p><h1>What senators disclosed</h1><p className="instrument-summary">Reported security purchases and sales. See who filed, whose account was disclosed, and when the transaction became public.</p></header>
    <section className="home-panel"><h2>Understand this collection</h2><p>{data.limitations}</p><p>Received-date windows: {data.windows.map(window => `${window.from}–${window.to}`).join("; ")}.</p>
      <p>{data.records.length} displayed source rows. {data.omitted.paperOrUnparsedReports} paper/unparsed reports and {data.omitted.reconciliationIssues} reconciliation issues remain outside this view. {data.omitted.otherSourceRows} other parsed source rows are omitted. Missing coverage does not mean no trading occurred.</p></section>
    <section className="sector-page-section"><h2>Reported transactions</h2>
      <div className="home-controls" role="group" aria-label="Transaction date range">{[{ key: "ytd", label: "YTD" }, { key: "30", label: "30-day" }, { key: "90", label: "90-day" }].map(item => <Link className="home-source-link" key={item.key} aria-current={view.period === item.key ? "page" : undefined} href={`/senate?${new URLSearchParams({ q: view.q, period: item.key })}`}><CalendarDays size={18} aria-hidden="true" />{item.label}</Link>)}</div>
      <p>Transaction dates {view.start}–{view.end}. Recent disclosures can arrive later; this is not real-time trading coverage.</p>
      <form className="senate-search" action="/senate"><label htmlFor="senate-query">Search a senator, company or ticker</label><input id="senate-query" name="q" defaultValue={view.q} maxLength={100} /><input type="hidden" name="period" value={view.period} /><button type="submit">Search</button></form><p>{view.total} matching source rows · Page {view.page} of {view.pages}.</p>
      <div className="sector-fund-grid">{view.records.map(row => <article className="home-panel" key={row.id}>
        <div className="instrument-title"><CompanyMark ticker={row.ticker} src={companyMark(row.ticker, row.cik)} /><h3>{row.ticker} · Reported {row.type === "Buy" ? "purchase" : "sale"}</h3></div>
        <p>{row.assetNameAsFiled}</p><p>{row.politician} · Senator, {row.state}</p>
        <dl className="instrument-facts"><div><dt>Account owner as disclosed</dt><dd>{row.owner}</dd></div><div><dt>Transaction date</dt><dd>{row.transactionDate}</dd></div><div><dt>Filed</dt><dd>{row.filedDate}</dd></div><div><dt>Disclosed amount range</dt><dd>{row.amount}</dd></div></dl>
        {row.sourceComment && <p><strong>Filing note for this row:</strong> {row.sourceComment}</p>}
        {row.filingNotes.some(note => note !== row.sourceComment) && <details><summary>Other notes in the same filing</summary><p>These notes may concern other transactions; they are shown for context, not automatically assigned to this row.</p>{row.filingNotes.filter(note => note !== row.sourceComment).map((note, index) => <p key={index}>{note}</p>)}</details>}
        <p>Asset type as filed: {row.assetTypeAsFiled}. Stock/fund classification not independently established.</p><a className="home-text-link" href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Original Senate filing ↗</a>
      </article>)}</div><nav aria-label="Disclosure pages">{view.page > 1 && <Link href={pageLink(view.page - 1)}>Previous page</Link>}{" "}{view.page < view.pages && <Link href={pageLink(view.page + 1)}>Next page</Link>}</nav>
    </section></main><SiteFooter /></>;
}
