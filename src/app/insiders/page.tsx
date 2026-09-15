import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import InsiderDisclosureCards from "@/components/InsiderDisclosureCards";
import release from "@/lib/insider-live.json";
import { readApprovedInsiderRelease, queryInsiders } from "@/lib/form4/public-view";
import "../homepage.css";
export const metadata: Metadata = { title: "Corporate insider disclosures · Outfox", description: "Inspect source-linked SEC purchases and sales with reporting owners, dates, reported prices and clear coverage.", alternates: { canonical: "/insiders" } };
export default async function InsidersPage({ searchParams }: { searchParams: Promise<{ q?: string; period?: string; side?: string; page?: string }> }) {
  const data = readApprovedInsiderRelease(release);
  if (!data) notFound();
  const view = queryInsiders(data, await searchParams, new Date().toISOString().slice(0, 10));
  const url = (updates: Record<string, string>) => `/insiders?${new URLSearchParams({ q: view.q, period: view.period, side: view.side, ...updates })}`;
  return <><Navbar showCompare={false} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Corporate insider disclosures</span></nav>
    <header className="instrument-hero"><p className="kicker">SEC Form 4 · Bounded source coverage</p><h1>What corporate insiders disclosed</h1><p className="instrument-summary">Inspect reported purchases and sales, their reporting owners and the original filings.</p></header>
    <section className="home-panel"><h2>Understand this collection</h2><p>Collected filing windows from January 1, 2026 through {data.coverageThrough}, using a frozen directory of {data.universeSize.toLocaleString()} issuer identities.</p><p>{data.limitations}</p><p>{data.heldIssuers.length} issuers held for correction review. {Object.values(data.excluded).reduce((n, count) => n + count, 0)} source rows excluded from this purchase/sale view.</p></section>
    <section className="sector-page-section"><h2>Reported purchases and sales</h2><div className="home-controls" role="group" aria-label="Transaction date range">{[{ key: "ytd", label: "YTD" }, { key: "30", label: "30-day" }, { key: "90", label: "90-day" }].map(item => <Link key={item.key} className="home-source-link" aria-current={view.period === item.key ? "page" : undefined} href={url({ period: item.key })}><CalendarDays size={18} aria-hidden="true" />{item.label}</Link>)}</div>
    <p>Transaction dates {view.from}–{view.to}. Filing delays apply; this is not real-time trade execution data.</p>
    <form action="/insiders" className="senate-search"><label htmlFor="insider-q">Search a company, ticker or reporting owner</label><input id="insider-q" name="q" maxLength={100} defaultValue={view.q} /><input type="hidden" name="period" value={view.period} /><input type="hidden" name="side" value={view.side} /><button type="submit">Search</button></form>
    <nav className="home-controls" aria-label="Transaction type">{[{ key: "all", label: "Purchases & sales" }, { key: "buy", label: "Purchases" }, { key: "sell", label: "Sales" }].map(item => <Link key={item.key} className="home-source-link" aria-current={view.side === item.key ? "page" : undefined} href={url({ side: item.key })}>{item.label}</Link>)}</nav>
    <p>{view.total} matching source rows · Page {view.page} of {view.pages}.</p><InsiderDisclosureCards records={view.records} />
    {!view.total && <p>No matching records in this collection. That does not establish that no activity occurred.</p>}
    <nav aria-label="Result pages">{view.page > 1 && <Link href={url({ page: String(view.page - 1) })}>Previous page</Link>}{" "}{view.page < view.pages && <Link href={url({ page: String(view.page + 1) })}>Next page</Link>}</nav></section>
  </main><SiteFooter /></>;
}
