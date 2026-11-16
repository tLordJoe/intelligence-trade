import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { executiveRows, queryExecutiveRows, trumpReport } from "@/lib/executive-disclosures";
import "../homepage.css";

export const metadata: Metadata = {
  title: "Executive Branch disclosures · Outfox",
  description: "Search selected reported purchases and sales from President Donald J. Trump’s official financial disclosure, with links to the original.",
  alternates: { canonical: "/executive" },
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const readableDate = (iso: string) => date.format(new Date(iso));

export default async function ExecutivePage({ searchParams }: PageProps<"/executive">) {
  const view = queryExecutiveRows(await searchParams);
  const href = (page: number) => `/executive?${new URLSearchParams({ q: view.q, side: view.side, page: String(page) })}`;
  return <><Navbar /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb">
      <Link href="/">Home</Link><span>/</span><span aria-current="page">Executive Branch</span>
    </nav>
    <header className="instrument-hero">
      <p className="kicker">Executive Branch · OGE Form 278-T</p>
      <h1>What President Trump disclosed</h1>
      <p className="instrument-summary">Search reported purchases and sales by company or ticker. Every result links to its page in the official filing.</p>
    </header>
    <section className="home-panel mt-5 space-y-3" aria-labelledby="executive-coverage">
      <h2 id="executive-coverage">Partial coverage</h2>
      <p>{executiveRows.length} entries from pages {trumpReport.indexedPages[0]}–{trumpReport.indexedPages[1]} of one {trumpReport.pdfPages}-page report. This is not a complete transaction history. A disclosure doesn’t tell us who directed the trade, and the amounts are ranges, not exact values.</p>
      <p>Signed {readableDate(trumpReport.signedDate)} · Received by OGE {readableDate(trumpReport.ogeReceivedDate)}. The first public release date hasn’t been verified. These entries aren’t used in Radar rankings.</p>
      <a className="home-text-link" href={trumpReport.sourceUrl}>Read the full White House filing ↗</a>
    </section>
    <section className="sector-page-section" aria-labelledby="executive-transactions">
      <h2 id="executive-transactions">Reported purchases and sales</h2>
      <form action="/executive" className="senate-search">
        <label htmlFor="executive-q">Company or ticker</label>
        <input id="executive-q" name="q" type="search" maxLength={100} defaultValue={view.q} placeholder="e.g. Nvidia or NVDA" />
        <label htmlFor="executive-side">Transaction type</label>
        <select id="executive-side" name="side" defaultValue={view.side}>
          <option value="all">Purchases and sales</option>
          <option value="purchase">Purchases only</option>
          <option value="sale">Sales only</option>
        </select>
        <button type="submit">Search</button>
        {(view.q || view.side !== "all") && <Link className="home-text-link ml-2" href="/executive">Clear filters</Link>}
      </form>
      <p className="mb-4">{view.total} matching {view.total === 1 ? "entry" : "entries"}{view.pageCount > 1 && ` · Page ${view.page} of ${view.pageCount}`}</p>
      {!view.total && <p>No matches in the pages we’ve indexed. Other filings or pages may contain additional transactions.</p>}
      <ul className="grid gap-3 lg:grid-cols-2">
        {view.rows.map((row) => <li className="home-panel min-w-0" key={row.line}>
          <p className="kicker">{row.side === "sale" ? "Reported sale" : "Reported purchase"}</p>
          <h3 className="mt-1 break-words text-xl font-bold">{row.name}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-[var(--text-dim)]">Trade date</dt><dd>{readableDate(row.tradedAt)}</dd></div>
            <div><dt className="text-[var(--text-dim)]">Reported amount</dt><dd>{currency.format(row.amountLow)}–{currency.format(row.amountHigh)}</dd></div>
          </dl>
          <a className="home-text-link" href={row.sourceUrl}>Original filing · page {row.page}, row {row.line} ↗</a>
        </li>)}
      </ul>
      {view.pageCount > 1 && <nav className="result-pagination" aria-label="Result pages">
        {view.page > 1 && <Link href={href(view.page - 1)}>Previous page</Link>}
        {view.page < view.pageCount && <Link href={href(view.page + 1)}>Next page</Link>}
      </nav>}
    </section>
  </main><SiteFooter /></>;
}
