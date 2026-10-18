import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import InsiderDisclosureCards from "@/components/InsiderDisclosureCards";
import { publishedInsiders } from "@/lib/published-disclosures";
import { queryInsiders } from "@/lib/form4/public-view";
import "../homepage.css";
export const metadata: Metadata = { title: "Corporate insider disclosures · Outfox", description: "Inspect source-linked SEC purchases and sales with reporting owners, dates, reported prices and clear coverage.", alternates: { canonical: "/insiders" } };
export default async function InsidersPage({ searchParams }: { searchParams: Promise<{ q?: string; period?: string; side?: string; page?: string; window?: string }> }) {
  const data = publishedInsiders();
  if (!data) notFound();
  const view = queryInsiders(data, await searchParams, new Date().toISOString().slice(0, 10));
  const url = (updates: Record<string, string>) => `/insiders?${new URLSearchParams({ q: view.q, period: view.period, side: view.side, window: view.window, ...updates })}`;
  const pagination = <nav className="home-controls" aria-label="Result pages">{view.page > 1 && <Link className="home-source-link" href={url({ page: String(view.page - 1) })}>Previous page</Link>}{view.page < view.pages && <Link className="home-source-link" href={url({ page: String(view.page + 1) })}>Next page</Link>}</nav>;
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Corporate insider disclosures</span></nav>
    <header className="instrument-hero"><p className="kicker">Corporate insiders · SEC Form 4</p><h1>What corporate insiders disclosed</h1><p className="instrument-summary">Search {data.records.length.toLocaleString()} reported purchases and sales by company, ticker or reporting owner. Open the original filing behind every record.</p></header>
    <section className="home-panel"><details><summary>Collection dates, coverage and reported prices</summary><p>{data.limitations}</p><p>{data.heldIssuers.length} issuers held for correction review. {Object.values(data.excluded).reduce((n, count) => n + count, 0).toLocaleString()} source rows excluded from this purchase/sale view.</p><ul>{data.windows.map((w,i) => <li key={i}>Filed {w.from}–{w.to}{data.schemaVersion === 3 ? `: ${data.collectionScopes[i].collectedFilings.toLocaleString()} of ${w.expectedFilings.toLocaleString()} enumerated filings collected` : ""}</li>)}</ul></details></section>
    <section className="sector-page-section"><h2>Reported purchases and sales</h2>{data.schemaVersion === 1 && <div className="home-controls" role="group" aria-label="Transaction date range">{[{ key: "ytd", label: "YTD" }, { key: "30", label: "30-day" }, { key: "90", label: "90-day" }].map(item => <Link key={item.key} className="home-source-link" aria-current={view.period === item.key ? "page" : undefined} href={url({ period: item.key })}><CalendarDays size={18} aria-hidden="true" />{item.label}</Link>)}</div>}
    <p>{data.schemaVersion !== 1 ? "Collected disclosures filed" : "Transaction dates"} {view.from}–{view.to}. {data.schemaVersion === 3 && "Collection gaps remain. "}Filing dates are not execution dates.</p>
    <form action="/insiders" className="senate-search"><label htmlFor="insider-q">Search a company, ticker or reporting owner</label><input id="insider-q" name="q" maxLength={100} defaultValue={view.q} placeholder="Company, ticker or owner" /><label htmlFor="insider-window">Filing window</label><select id="insider-window" name="window" defaultValue={view.window}><option value="all">All collected filings</option>{[...new Map(data.windows.map(w=>[`${w.from}:${w.to}`,w])).values()].map(w=><option key={`${w.from}:${w.to}`} value={`${w.from}:${w.to}`}>{w.from}–{w.to}</option>)}</select><input type="hidden" name="period" value={view.period} /><input type="hidden" name="side" value={view.side} /><button type="submit">Search</button></form>
    <nav className="home-controls" aria-label="Transaction type">{[{ key: "all", label: "Purchases & sales" }, { key: "buy", label: "Purchases" }, { key: "sell", label: "Sales" }].map(item => <Link key={item.key} className="home-source-link" aria-current={view.side === item.key ? "page" : undefined} href={url({ side: item.key })}>{item.label}</Link>)}</nav>
    <p>{view.total.toLocaleString()} matching source rows · Page {view.page} of {view.pages}.</p>{pagination}<InsiderDisclosureCards records={view.records} />
    {!view.total && <p>No matching records in this collection. That does not establish that no activity occurred.</p>}
    {pagination}</section>
  </main><SiteFooter /></>;
}
