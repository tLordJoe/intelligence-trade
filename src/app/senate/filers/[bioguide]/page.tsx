import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CompanyMark from "@/components/CompanyMark";
import release from "@/lib/senate-live.json";
import { companyMark } from "@/lib/company-marks";
import { previewAccessFromEnv } from "@/lib/funds/access";
import { resolvePortrait, srcOrNull } from "@/lib/image-library";
import { readApprovedSenateRelease } from "@/lib/senate/public-view";
import { buildSenateProfile, senateBioguideFromRoute, senateProfilePath } from "@/lib/senate-profile";
import "../../../homepage.css";

export default async function SenateFilerPage({ params, searchParams }: {
  params: Promise<{ bioguide: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const data = readApprovedSenateRelease(release);
  if (!data) notFound();
  const { bioguide: segment } = await params;
  const bioguide = senateBioguideFromRoute(segment);
  if (!bioguide) notFound();
  const profile = buildSenateProfile(data, bioguide, new Date().toISOString().slice(0, 10));
  if (!profile) notFound();
  const query = await searchParams;
  const pages = Math.max(1, Math.ceil(profile.records.length / 20));
  const requested = Number(query.page ?? "1");
  const page = Number.isInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const portrait = srcOrNull(resolvePortrait({ bioguide: profile.bioguide, name: profile.name, chamber: "Senate", state: profile.state, district: null }));
  return <><Navbar showCompare={previewAccessFromEnv().allowed} /><main className="home-shell instrument-page">
    <nav className="instrument-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/senate">Senate disclosures</Link><span>/</span><span aria-current="page">{profile.name}</span></nav>
    <header className="instrument-hero"><div className="instrument-title">
      {portrait && <Image src={portrait} alt={profile.name} width={90} height={110} className="rounded-xl" />}
      <div><p className="kicker">Senate disclosure profile</p><h1>{profile.name}</h1><p className="instrument-summary">Senator, {profile.state} · Source-linked transactions in Outfox’s available Senate disclosure collection.</p></div>
    </div></header>
    <section className="home-panel"><h2>What this page shows</h2><p>Disclosed purchases and sales, including reported family accounts. These are filing records—not a complete portfolio, real-time activity, or verified personal investment returns.</p>
      <dl className="instrument-facts"><div><dt>Purchase records</dt><dd>{profile.purchases}</dd></div><div><dt>Sale records</dt><dd>{profile.sales}</dd></div><div><dt>Distinct filings</dt><dd>{profile.filingCount}</dd></div></dl></section>
    <section className="sector-page-section"><h2>Disclosure history</h2><p>Newest filings first · Page {page} of {pages} · Original evidence linked on every record.</p>
      <div className="sector-fund-grid">{profile.records.slice((page - 1) * 20, page * 20).map(row => <article className="home-panel" key={row.id}>
        <div className="instrument-title"><CompanyMark ticker={row.ticker} src={companyMark(row.ticker, row.cik)} /><h3>{row.ticker} · Reported {row.type === "Buy" ? "purchase" : "sale"}</h3></div>
        <p>{row.assetNameAsFiled}</p><dl className="instrument-facts"><div><dt>Account owner as disclosed</dt><dd>{row.owner}</dd></div><div><dt>Transaction date</dt><dd>{row.transactionDate}</dd></div><div><dt>Filed</dt><dd>{row.filedDate}</dd></div><div><dt>Disclosed amount range</dt><dd>{row.amount}</dd></div></dl>
        <a className="home-text-link" href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Original Senate filing ↗</a>
      </article>)}</div>
      <nav aria-label="Profile disclosure pages">{page > 1 && <Link href={`${senateProfilePath(profile.bioguide)}?page=${page - 1}`}>← Previous</Link>} {page < pages && <Link href={`${senateProfilePath(profile.bioguide)}?page=${page + 1}`}>Next →</Link>}</nav>
    </section>
  </main><SiteFooter /></>;
}
